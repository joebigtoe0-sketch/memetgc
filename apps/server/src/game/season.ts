import { prisma } from "@memetgc/db";

export interface ActiveSeason {
  id: string;
  number: number;
  name: string;
  startedAt: Date;
}

/** Returns the currently active season, or null if none is configured. */
export async function getActiveSeason(): Promise<ActiveSeason | null> {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    orderBy: { number: "desc" },
    select: { id: true, number: true, name: true, startedAt: true },
  });
  return season;
}

/** Convenience: active season id (or null). Safe to call in hot paths. */
export async function getActiveSeasonId(): Promise<string | null> {
  const season = await getActiveSeason();
  return season?.id ?? null;
}
