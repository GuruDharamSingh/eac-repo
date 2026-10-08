import { NextResponse } from "next/server";
import { refreshRequestDeviceToken } from "@elkdonis/auth-server";
import { DEVICE_APP } from "@/lib/auth";

/**
 * POST /api/mobile/v1/token — exchange the device token this request carries
 * for a fresh one, and revoke the old one. The app stores the new token and
 * uses it from then on; a token lapses after 30 days unused and 180 days after
 * it was minted, so calling this keeps a device linked. 401 when the token is
 * missing, unknown, revoked or expired: link the device again at /link-device.
 */
export async function POST() {
  const fresh = await refreshRequestDeviceToken(DEVICE_APP);
  if (!fresh) return NextResponse.json({ error: "Not linked" }, { status: 401 });
  return NextResponse.json({ token: fresh.token, expiresAt: fresh.expiresAt.toISOString() });
}
