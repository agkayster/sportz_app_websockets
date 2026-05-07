import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

// tracks which sockets are subscribed to which matches
// using Map() prevents a user from being added twice to the array
const matchSubscribers = new Map();

// implement helper function
function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  // to get all our subscribers
  const subscribers = matchSubscribers.get(matchId);

  // if there are no subscribers, do nothing
  if (!subscribers) return;

  // remove subscriber from the socket
  subscribers.delete(socket);

  if (subscribers.size === 0) {
    // we remove the connection from the list
    matchSubscribers.delete(matchId);
  }
}

// the most important helper function for stability
function cleanUpSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

// send data to people only interested in a specific match
// payload is what we want to broadcast
function broadcastToMatch(matchId, payload) {
  // get access to all subscribers
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  //else, get access to the message to send
  const message = JSON.stringify(payload);

  // map over all clients belonging to the specific match
  for (const client of subscribers) {
    // if client is open, send message
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function sendJson(socket, payload) {
  // if not open, do nothing
  if (socket.readyState !== WebSocket.OPEN) return;

  // else, send the payload as a string to the client
  socket.send(JSON.stringify(payload));
}

// create a broadcast function to send information to all connected clients
function broadcastToAll(wss, payload) {
  // iterate through our clients
  // wss.clients contains all active connections
  for (const client of wss.clients) {
    // skip clients that aren't open
    if (client.readyState !== WebSocket.OPEN) continue;

    // else, if client is ready, send the message
    client.send(JSON.stringify(payload));
  }
}

//create function to handle messages we send
function handleMessage(socket, data) {
  let message;

  try {
    message = JSON.parse(data.toString());

    if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
      // try to subscribe the user
      subscribe(message.matchId, socket);

      // track it locally on the socket
      socket.subscriptions.add(message.matchId);

      // sends JSON message to a specific socket
      sendJson(socket, {
        type: "subscribed",
        matchId: message.matchId,
      });
      // exit the function
      return;
    }

    // if message is of a type unsubscribe
    if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
      // try to unsubscribe the user
      unsubscribe(message.matchId, socket);

      // delete it locally, remove it from local tracking on the socket
      socket.subscriptions.delete(message.matchId);

      // send JSON message. user no longer wants to receive live updates
      sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
    }
  } catch (err) {
    console.error(err);
    sendJson(socket, { type: "error", message: "Invalid message format" });
  }
}

// Attach the websocket logic to our node server
export function attachWebSocketServer(server) {
  // create a new websocket server
  // to receive the http function created by Express
  const wss = new WebSocketServer({
    server,
    path: "/ws", // path handles websocket server request
    maxPayload: 1024 * 1024, // maximum size allowed for an incoming message 1mb
  });

  // we implement a "ping/pong" heartbeat as well to detect and clean up dead connections
  wss.on("connection", async (socket, req) => {
    // check whether wsArcjet exists
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        // check whether decision has been denied
        if (decision.isDenied()) {
          // 1013: try again later
          // 1008: policy violation
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Access denied";

          socket.close(code, reason);
          return;
        }
      } catch (e) {
        console.error("WS connection error", e);
        socket.close(1011, "Server security error");
        return;
      }
    }

    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    // add from handleMessage function
    // allows the socket to remember what it subscribed to
    socket.subscriptions = new Set();

    sendJson(socket, { type: "Welcome" });

    // handles the message and the data
    socket.on("message", (data) => handleMessage(socket, data));

    // handles the error
    socket.on("error", () => socket.terminate());

    // cleans out sockets that have closed
    socket.on("close", () => cleanUpSubscriptions(socket));

    // handle the errors to prevent server from crashing on bad disconnect
    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  // returns a clean function to the rest of the app
  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: "commentary", data: comment });
  }

  // broadcastCommentary will now be available in the rest of our application
  return { broadcastMatchCreated, broadcastCommentary };
}
