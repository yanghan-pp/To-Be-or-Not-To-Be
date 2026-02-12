import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const topPlayers = await prisma.user.findMany({
    where: { gamesPlayed: { gt: 0 } },
    orderBy: { totalScore: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      totalScore: true,
      gamesPlayed: true,
    },
  });

  return NextResponse.json({ leaderboard: topPlayers });
}
