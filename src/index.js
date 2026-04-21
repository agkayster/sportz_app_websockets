import express from "express";
import { matchRouter } from "./routes/matches.js";
import { commentaryRouter } from "./routes/commentary.js";
import http from "http";
import { attachWebSocketServer } from "./ws/server.js";
import { securityMiddleware } from "./arcjet.js";

const PORT = Number(process.env.PORT) || 8000;

// host should always be a string
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

// wrap the express app in a standard Node HTTP server to allow us to attach the WebSocket server to it
const server = http.createServer(app);

// middleware that allows express to read JSON content/data
app.use(express.json());

// here we activate the arcjet middleware
app.use(securityMiddleware());

// backend home route
app.get("/", (req, res) => {
  res.json({ message: "Sportz App WebSockets server is running 🚀" });
});

// to get the list of matches
app.use("/matches", matchRouter);

app.use("/matches/:id/commentary", commentaryRouter);

// initialise websocket and get access to the broadcastMatchCreated function
const { broadcastMatchCreated } = attachWebSocketServer(server);

// app.locals is Express's global object accessible from any request
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`Server running on: ${baseUrl}`);

  console.log(
    `WebSocket server running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
