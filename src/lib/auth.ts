import { cookies } from "next/headers";
import { prisma } from "./prisma";

const OAUTH_URL = process.env.SECONDME_OAUTH_URL!;
const CLIENT_ID = process.env.SECONDME_CLIENT_ID!;
const CLIENT_SECRET = process.env.SECONDME_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SECONDME_REDIRECT_URI!;
const TOKEN_ENDPOINT = process.env.SECONDME_TOKEN_ENDPOINT!;
const API_BASE_URL = process.env.SECONDME_API_BASE_URL!;

export function getLoginUrl() {
  const scopes = "user.info,user.info.shades,user.info.softmemory,chat,note.add";
  return `${OAUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
}

export async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(`${TOKEN_ENDPOINT}/code`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const raw = await res.json();

  // Response wrapped in { code: 0, data: { accessToken, refreshToken, ... } }
  const data = raw.code === 0 && raw.data ? raw.data : raw;
  if (!data.accessToken) {
    throw new Error(`Token exchange failed: ${JSON.stringify(raw)}`);
  }
  return data;
}

export async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch(`${TOKEN_ENDPOINT}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const raw = await res.json();

  const data = raw.code === 0 && raw.data ? raw.data : raw;
  if (!data.accessToken) {
    throw new Error(`Token refresh failed: ${JSON.stringify(raw)}`);
  }
  return data;
}

export async function getSecondMeUserInfo(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/secondme/user/info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Failed to get user info: ${JSON.stringify(data)}`);
  }
  return data.data;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value;
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (new Date() > user.tokenExpiresAt) {
    try {
      const tokenData = await refreshAccessToken(user.refreshToken);
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || user.refreshToken,
          tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });
      return updated;
    } catch {
      return null;
    }
  }

  return user;
}

export async function getUserAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (new Date() > user.tokenExpiresAt) {
    try {
      const tokenData = await refreshAccessToken(user.refreshToken);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || user.refreshToken,
          tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });
      return tokenData.accessToken;
    } catch {
      return null;
    }
  }

  return user.accessToken;
}
