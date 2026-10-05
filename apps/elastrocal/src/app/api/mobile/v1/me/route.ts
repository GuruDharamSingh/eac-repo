import { NextResponse } from "next/server";
import { revokeRequestDeviceToken } from "@elkdonis/auth-server";
import { getViewer } from "@/lib/auth";

/**
 * GET /api/mobile/v1/me — who the app is signed in as. Works with the
 * device token (Authorization: Bearer eacd_…) like every route that reads
 * the session; 401 when the token is missing, unknown or revoked.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not linked" }, { status: 401 });
  return NextResponse.json({ userId: viewer.userId, email: viewer.email, role: viewer.role, owner: viewer.role === "owner" });
}

/** DELETE /api/mobile/v1/me — unlink: revoke the device token this request carries. */
export async function DELETE() {
  const revoked = await revokeRequestDeviceToken();
  return NextResponse.json({ revoked });
}
