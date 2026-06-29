import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import type { ServerToClientEvents, ClientToServerEvents } from "@memetgc/types";

import cardsRouter from "./routes/cards.js";
import authRouter from "./routes/auth.js";
import decksRouter from "./routes/decks.js";
import collectionRouter from "./routes/collection.js";
import heroesRouter from "./routes/heroes.js";
import economyRouter from "./routes/economy.js";
import { registerSocketHandlers, loadCardRegistry } from "./game/socket.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

// Allow multiple origins (comma-separated) or wildcard
const corsOrigin: string | string[] | boolean =
  CLIENT_ORIGIN === "*"
    ? true
    : CLIENT_ORIGIN.includes(",")
    ? CLIENT_ORIGIN.split(",").map((o) => o.trim())
    : CLIENT_ORIGIN;

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: CLIENT_ORIGIN !== "*",
  },
});

app.use(cors({ origin: corsOrigin, credentials: CLIENT_ORIGIN !== "*" }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/decks", decksRouter);
app.use("/api/collection", collectionRouter);
app.use("/api/heroes", heroesRouter);
app.use("/api/economy", economyRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

registerSocketHandlers(io);

async function start(): Promise<void> {
  await loadCardRegistry();

  httpServer.listen(PORT, () => {
    console.log(`🎮 Degen TCG server running on port ${PORT}`);
    console.log(`   REST API: http://localhost:${PORT}/api`);
    console.log(`   WebSocket: ws://localhost:${PORT}`);
  });
}

start().catch(console.error);
