import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("user_id");
  return NextResponse.redirect(new URL("/", request.url));
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("user_id");
  return NextResponse.redirect(new URL("/", request.url));
}
