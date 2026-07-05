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
import marketRouter, { startMarketSweeper } from "./routes/market.js";
import leaderboardRouter from "./routes/leaderboard.js";
import seasonRouter from "./routes/season.js";
import onlineRouter from "./routes/online.js";
import tournamentsRouter from "./routes/tournaments.js";
import { registerSocketHandlers, loadCardRegistry, startMatchmakingTicker, getCardRegistrySize } from "./game/socket.js";
import { getSolanaConfigStatus } from "./lib/solana.js";
import { ensureBots, startBotTicker } from "./bots/manager.js";
import { startTournamentTicker, setTournamentEngineIo } from "./tournaments/engine.js";
import { setTournamentIo } from "./tournaments/match.js";

// Bump this string whenever you want to confirm a fresh deploy is live via /health.
const BUILD_TAG = "2026-07-02-market-disconnect-fixes";
const STARTED_AT = new Date().toISOString();

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
app.use(express.json({ limit: "3mb" }));

app.use("/api/auth", authRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/decks", decksRouter);
app.use("/api/collection", collectionRouter);
app.use("/api/heroes", heroesRouter);
app.use("/api/economy", economyRouter);
app.use("/api/market", marketRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/season", seasonRouter);
app.use("/api/online", onlineRouter);
app.use("/api/tournaments", tournamentsRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    build: BUILD_TAG,
    startedAt: STARTED_AT,
    cards: getCardRegistrySize(),
    market: getSolanaConfigStatus(),
    timestamp: new Date().toISOString(),
  });
});

registerSocketHandlers(io);
setTournamentEngineIo(io);
setTournamentIo(io);

async function start(): Promise<void> {
  await loadCardRegistry();
  startMarketSweeper();
  startMatchmakingTicker(io);
  startTournamentTicker();

  // Disguised AI ladder players — seed accounts/decks, then let them fill
  // casual/ranked queues when humans are waiting.
  ensureBots()
    .then(() => startBotTicker())
    .catch((err) => console.error("[bots] setup failed:", err));

  httpServer.listen(PORT, () => {
    console.log(`🎮 Legends of the Memepool server running on port ${PORT}`);
    console.log(`   REST API: http://localhost:${PORT}/api`);
    console.log(`   WebSocket: ws://localhost:${PORT}`);
  });
}

start().catch(console.error);
