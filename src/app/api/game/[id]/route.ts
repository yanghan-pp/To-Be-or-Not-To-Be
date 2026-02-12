import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { prisma } = await import("@/lib/prisma");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      agent1: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          questionnaire: {
            select: { personalityTags: true },
          },
        },
      },
      agent2: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          questionnaire: {
            select: { personalityTags: true },
          },
        },
      },
      rounds: { orderBy: { roundNumber: "asc" } },
    },
  });

  if (!game) {
    return NextResponse.json({ error: "游戏不存在" }, { status: 404 });
  }

  return NextResponse.json({ game });
}
