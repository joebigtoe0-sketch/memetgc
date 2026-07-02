import { prisma } from "@memetgc/db";
import { QUEST_FRAGMENTS } from "./matchRewards.js";

type QuestTier = "low" | "medium" | "high";

interface QuestTemplate {
  type: string;
  description: string;
  target: number;
  tier: QuestTier;
}

const TIER_REWARD: Record<QuestTier, number> = {
  low: QUEST_FRAGMENTS.low,
  medium: QUEST_FRAGMENTS.medium,
  high: QUEST_FRAGMENTS.high,
};

/** Pool of quest templates — five are picked per user per UTC day. */
const QUEST_POOL: QuestTemplate[] = [
  { type: "play_games", description: "Play 2 games (Casual or Ranked)", target: 2, tier: "low" },
  { type: "play_casual", description: "Play 2 Casual games", target: 2, tier: "low" },
  { type: "win_casual", description: "Win 1 Casual game", target: 1, tier: "low" },
  { type: "play_games", description: "Play 4 games (Casual or Ranked)", target: 4, tier: "medium" },
  { type: "win_games", description: "Win 2 games (Casual or Ranked)", target: 2, tier: "medium" },
  { type: "destroy_minions", description: "Destroy 10 minions (Casual or Ranked)", target: 10, tier: "medium" },
  { type: "play_ranked", description: "Play 2 Ranked games", target: 2, tier: "medium" },
  { type: "win_ranked", description: "Win 1 Ranked game", target: 1, tier: "medium" },
  { type: "win_games", description: "Win 3 games (Casual or Ranked)", target: 3, tier: "high" },
  { type: "destroy_minions", description: "Destroy 20 minions (Casual or Ranked)", target: 20, tier: "high" },
  { type: "win_ranked", description: "Win 2 Ranked games", target: 2, tier: "high" },
  { type: "play_ranked", description: "Play 3 Ranked games", target: 3, tier: "high" },
];

function dailyRng(userId: string, salt: number): number {
  const date = new Date().toISOString().slice(0, 10);
  let h = salt;
  for (const c of userId + date) h = (Math.imul(31, h) + c.charCodeAt(0)) >>> 0;
  return h;
}

function pickQuestsForUser(userId: string): QuestTemplate[] {
  const usedTypes = new Set<string>();
  const picked: QuestTemplate[] = [];
  const tierPlan: QuestTier[] = ["low", "medium", "medium", "high", "high"];

  for (let i = 0; i < tierPlan.length; i++) {
    const tier = tierPlan[i]!;
    const pool = QUEST_POOL.filter((q) => q.tier === tier);
    const unique = pool.filter((q) => !usedTypes.has(q.type));
    const alreadyPicked = new Set(picked.map((p) => p.description));
    const source =
      unique.length > 0
        ? unique
        : pool.filter((q) => !alreadyPicked.has(q.description));
    if (source.length === 0) continue;

    const idx = dailyRng(userId, i * 31 + 7) % source.length;
    const quest = source[idx]!;
    usedTypes.add(quest.type);
    picked.push(quest);
  }

  return picked;
}

export async function generateDailyQuests(userId: string): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const quests = pickQuestsForUser(userId);

  for (const q of quests) {
    await prisma.dailyQuest.create({
      data: {
        userId,
        type: q.type,
        description: q.description,
        target: q.target,
        rewardJson: { fragments: TIER_REWARD[q.tier] },
        expiresAt: tomorrow,
        completed: false,
        progress: 0,
      },
    });
  }
}

export async function updateQuests(
  userId: string,
  opts: { isWinner: boolean; minionsDestroyed: number; mode: string },
  now: Date
): Promise<void> {
  const { isWinner, minionsDestroyed, mode } = opts;
  const quests = await prisma.dailyQuest.findMany({
    where: { userId, expiresAt: { gt: now }, claimedAt: null },
  });

  for (const q of quests) {
    let inc = 0;
    switch (q.type) {
      case "play_games":
        inc = 1;
        break;
      case "win_games":
        if (isWinner) inc = 1;
        break;
      case "destroy_minions":
        inc = minionsDestroyed;
        break;
      case "play_ranked":
        if (mode === "ranked") inc = 1;
        break;
      case "win_ranked":
        if (mode === "ranked" && isWinner) inc = 1;
        break;
      case "play_casual":
        if (mode === "casual") inc = 1;
        break;
      case "win_casual":
        if (mode === "casual" && isWinner) inc = 1;
        break;
      default:
        break;
    }
    if (inc <= 0) continue;

    const progress = Math.min(q.target, q.progress + inc);
    await prisma.dailyQuest.update({
      where: { id: q.id },
      data: { progress, completed: progress >= q.target },
    });
  }
}
