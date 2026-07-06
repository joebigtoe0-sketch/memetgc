import { prisma } from "@memetgc/db";

export async function bumpPlatformStat(key: string, delta: number | bigint = 1): Promise<void> {
  const inc = typeof delta === "bigint" ? delta : BigInt(delta);
  await prisma.platformStat.upsert({
    where: { key },
    create: { key, value: inc },
    update: { value: { increment: inc } },
  });
}

export async function readPlatformStat(key: string): Promise<number> {
  const row = await prisma.platformStat.findUnique({ where: { key } });
  return row ? Number(row.value) : 0;
}
