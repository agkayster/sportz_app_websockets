import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, payload) {
  // if not open, do nothing
  if (socket.readyState !== WebSocket.OPEN) return;

  // else, send the payload as a string to the client
  socket.send(JSON.stringify(payload));
}

// create a broadcast function to send information to all connected clients
function broadcast(wss, payload) {
  // iterate through our clients
  // wss.clients contains all active connections
  for (const client of wss.clients) {
    // skip clients that aren't open
    if (client.readyState !== WebSocket.OPEN) continue;

    // else, if client is ready, send the message
    client.send(JSON.stringify(payload));
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

    sendJson(socket, { type: "Welcome" });

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
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
