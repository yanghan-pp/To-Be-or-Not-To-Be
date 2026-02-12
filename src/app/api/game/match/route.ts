import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateTotalRounds } from "@/lib/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: Find a match for the current user
export async function POST() {
  const { prisma } = await import("@/lib/prisma");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // Check if user has completed questionnaire
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { userId: user.id },
  });

  if (!questionnaire?.completed) {
    return NextResponse.json(
      { error: "请先完成性格问卷" },
      { status: 400 }
    );
  }

  // Check if user already has an active game
  const activeGame = await prisma.game.findFirst({
    where: {
      status: "playing",
      OR: [{ agent1Id: user.id }, { agent2Id: user.id }],
    },
    include: {
      agent1: { select: { id: true, name: true, avatarUrl: true } },
      agent2: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (activeGame) {
    return NextResponse.json({ game: activeGame, status: "already_playing" });
  }

  // Find another user who has completed questionnaire and is not in an active game
  const availableUsers = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      questionnaire: { completed: true },
      AND: [
        {
          gamesAsAgent1: { none: { status: "playing" } },
        },
        {
          gamesAsAgent2: { none: { status: "playing" } },
        },
      ],
    },
    take: 10,
  });

  if (availableUsers.length === 0) {
    return NextResponse.json({
      status: "waiting",
      message: "暂无可匹配的对手，请稍后再试",
    });
  }

  // Pick a random opponent
  const opponent =
    availableUsers[Math.floor(Math.random() * availableUsers.length)];

  // Create a new game
  const totalRounds = generateTotalRounds();
  const game = await prisma.game.create({
    data: {
      agent1Id: user.id,
      agent2Id: opponent.id,
      totalRounds,
      status: "playing",
    },
    include: {
      agent1: { select: { id: true, name: true, avatarUrl: true } },
      agent2: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ game, status: "matched" });
}
