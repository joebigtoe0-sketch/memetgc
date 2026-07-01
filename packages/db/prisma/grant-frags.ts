import { PrismaClient } from "@prisma/client";

const wallet = process.argv[2];
const amount = Number(process.argv[3] ?? "50000");

if (!wallet) {
  console.error("Usage: tsx prisma/grant-frags.ts <walletAddress> [amount]");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { walletAddress: wallet },
        { walletAddress: wallet.toLowerCase() },
      ],
    },
  });

  if (!user) {
    console.error(`No user found for wallet: ${wallet}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { fragments: { increment: amount } },
    select: { id: true, username: true, walletAddress: true, fragments: true },
  });

  console.log(`Added ${amount} frags to ${updated.username} (${updated.walletAddress})`);
  console.log(`New balance: ${updated.fragments}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
