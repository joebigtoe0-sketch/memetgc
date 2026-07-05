import type { Response, NextFunction } from "express";
import { prisma } from "@memetgc/db";
import type { AuthRequest } from "./auth.js";

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

export function isAdminWallet(walletAddress: string | null | undefined): boolean {
  if (!walletAddress || ADMIN_WALLETS.length === 0) return false;
  return ADMIN_WALLETS.includes(walletAddress);
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  });
  return isAdminWallet(user?.walletAddress);
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const admin = await isUserAdmin(req.user.userId);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
