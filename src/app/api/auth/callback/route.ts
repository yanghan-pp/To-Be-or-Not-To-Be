import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getSecondMeUserInfo } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    const accessToken = tokenData.accessToken;
    const refreshToken = tokenData.refreshToken;

    const userInfo = await getSecondMeUserInfo(accessToken);

    const secondmeUserId = userInfo.route || userInfo.email || String(Date.now());

    const user = await prisma.user.upsert({
      where: { secondmeUserId },
      update: {
        name: userInfo.name || userInfo.email,
        email: userInfo.email,
        avatarUrl: userInfo.avatarUrl,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
      create: {
        secondmeUserId,
        name: userInfo.name || userInfo.email,
        email: userInfo.email,
        avatarUrl: userInfo.avatarUrl,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    const cookieStore = await cookies();
    cookieStore.set("user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    // Check if user has completed questionnaire
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { userId: user.id },
    });

    if (questionnaire?.completed) {
      return NextResponse.redirect(new URL("/match", request.url));
    }

    return NextResponse.redirect(new URL("/questionnaire", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
