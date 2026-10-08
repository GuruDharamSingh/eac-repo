import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Next 16 request hook. A device token (Authorization: Bearer eacd_…, the
 * Jerusalem app) is accepted on the mobile API only. Anywhere else (pages,
 * server actions such as /link-device, the other APIs) it is refused, so a
 * token cannot mint further tokens or act as a web session. See
 * packages/auth-server/src/device-tokens.ts.
 */
export default function proxy(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer eacd_") && !req.nextUrl.pathname.startsWith("/api/mobile/")) {
    return NextResponse.json({ error: "Device tokens are accepted on /api/mobile/ only" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
