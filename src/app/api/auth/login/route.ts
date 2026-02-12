import { NextResponse } from "next/server";
import { getLoginUrl } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const loginUrl = getLoginUrl();
  return NextResponse.redirect(loginUrl);
}
