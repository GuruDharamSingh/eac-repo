import { NextRequest, NextResponse } from "next/server";
import { captureCreate, captureStatus } from "@elkdonis/services/recordings";
import { getCurrentUser } from "@/lib/session";

/**
 * Phone capture, the computer's side (@elkdonis/studio/capture PhoneHandoff):
 *   POST            → {code, expiresAt}     a code for /c/<code>, 30 minutes, used once
 *   GET ?code=      → {status, result?}     where the phone is; result when the file is in
 * Only the person who made a code can read it.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(captureCreate(user.id));
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const s = captureStatus(user.id, request.nextUrl.searchParams.get("code") ?? "");
  return s ? NextResponse.json(s) : NextResponse.json({ error: "No such code" }, { status: 404 });
}
