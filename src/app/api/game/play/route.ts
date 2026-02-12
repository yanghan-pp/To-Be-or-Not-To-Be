import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getUserAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateRoundScore,
  buildGameContext,
  type Choice,
} from "@/lib/game";
import { GAME_DECISION_ACTION_CONTROL } from "@/lib/questionnaire";
import { actWithSecondMe } from "@/lib/secondme";

// POST: Play a round in a game
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { gameId } = await request.json();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      agent1: {
        select: { id: true, name: true, avatarUrl: true },
      },
      agent2: {
        select: { id: true, name: true, avatarUrl: true },
      },
      rounds: { orderBy: { roundNumber: "asc" } },
    },
  });

  if (!game) {
    return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
  }

  if (game.status !== "playing") {
    return NextResponse.json({ error: "游戏已结束" }, { status: 400 });
  }

  if (game.agent1Id !== user.id && game.agent2Id !== user.id) {
    return NextResponse.json({ error: "你不是此游戏的参与者" }, { status: 403 });
  }

  const nextRound = game.currentRound + 1;

  // Get personality tags for both agents
  const [agent1Questionnaire, agent2Questionnaire] = await Promise.all([
    prisma.questionnaire.findUnique({ where: { userId: game.agent1Id } }),
    prisma.questionnaire.findUnique({ where: { userId: game.agent2Id } }),
  ]);

  const agent1Tags = agent1Questionnaire?.personalityTags
    ? (JSON.parse(agent1Questionnaire.personalityTags).tags || [])
    : [];
  const agent2Tags = agent2Questionnaire?.personalityTags
    ? (JSON.parse(agent2Questionnaire.personalityTags).tags || [])
    : [];

  // Build history from agent1's perspective
  const agent1History = game.rounds.map((r) => ({
    round: r.roundNumber,
    myChoice: r.agent1Choice as Choice,
    opponentChoice: r.agent2Choice as Choice,
    myPoints: r.agent1Points,
    opponentPoints: r.agent2Points,
  }));

  // Build history from agent2's perspective
  const agent2History = game.rounds.map((r) => ({
    round: r.roundNumber,
    myChoice: r.agent2Choice as Choice,
    opponentChoice: r.agent1Choice as Choice,
    myPoints: r.agent2Points,
    opponentPoints: r.agent1Points,
  }));

  const agent1Context = buildGameContext(
    game.agent2.name || "对手",
    nextRound,
    game.totalRounds,
    agent1History,
    agent1Tags
  );

  const agent2Context = buildGameContext(
    game.agent1.name || "对手",
    nextRound,
    game.totalRounds,
    agent2History,
    agent2Tags
  );

  // Get access tokens for both agents
  const [agent1Token, agent2Token] = await Promise.all([
    getUserAccessToken(game.agent1Id),
    getUserAccessToken(game.agent2Id),
  ]);

  if (!agent1Token || !agent2Token) {
    return NextResponse.json(
      { error: "无法获取 Agent Token" },
      { status: 500 }
    );
  }

  // Both agents make decisions simultaneously
  const [agent1Decision, agent2Decision] = await Promise.all([
    actWithSecondMe(agent1Token, agent1Context, GAME_DECISION_ACTION_CONTROL),
    actWithSecondMe(agent2Token, agent2Context, GAME_DECISION_ACTION_CONTROL),
  ]);

  const agent1Choice = (
    (agent1Decision.result.choice as string) === "defect"
      ? "defect"
      : "cooperate"
  ) as Choice;
  const agent2Choice = (
    (agent2Decision.result.choice as string) === "defect"
      ? "defect"
      : "cooperate"
  ) as Choice;

  const score = calculateRoundScore(agent1Choice, agent2Choice);

  // Save the round
  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      roundNumber: nextRound,
      agent1Choice,
      agent2Choice,
      agent1Reason: (agent1Decision.result.reason as string) || "",
      agent2Reason: (agent2Decision.result.reason as string) || "",
      agent1Points: score.agent1Points,
      agent2Points: score.agent2Points,
    },
  });

  const isGameOver = nextRound >= game.totalRounds;

  // Update game
  await prisma.game.update({
    where: { id: game.id },
    data: {
      currentRound: nextRound,
      agent1Score: game.agent1Score + score.agent1Points,
      agent2Score: game.agent2Score + score.agent2Points,
      status: isGameOver ? "finished" : "playing",
    },
  });

  // If game is over, update user scores
  if (isGameOver) {
    await Promise.all([
      prisma.user.update({
        where: { id: game.agent1Id },
        data: {
          totalScore: { increment: game.agent1Score + score.agent1Points },
          gamesPlayed: { increment: 1 },
        },
      }),
      prisma.user.update({
        where: { id: game.agent2Id },
        data: {
          totalScore: { increment: game.agent2Score + score.agent2Points },
          gamesPlayed: { increment: 1 },
        },
      }),
    ]);
  }

  return NextResponse.json({
    round: {
      roundNumber: nextRound,
      agent1Choice,
      agent2Choice,
      agent1Reason: agent1Decision.result.reason || "",
      agent2Reason: agent2Decision.result.reason || "",
      agent1Points: score.agent1Points,
      agent2Points: score.agent2Points,
    },
    game: {
      currentRound: nextRound,
      totalRounds: game.totalRounds,
      agent1Score: game.agent1Score + score.agent1Points,
      agent2Score: game.agent2Score + score.agent2Points,
      isGameOver,
    },
    agent1: { id: game.agent1.id, name: game.agent1.name },
    agent2: { id: game.agent2.id, name: game.agent2.name },
  });
}
