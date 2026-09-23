import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cachePut, findUser, jwtSecret, verifyHs256 } from "@/lib/oidc";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.nextUrl.searchParams.get("access_token");
}

/**
 * GET /api/oidc/userinfo. `preferred_username` is the users.id — sociallogin
 * prefixes it, which is where "elkdonis-<id>" Nextcloud uids come from.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const token = bearer(req);

  if (!token) {
    // Hybridauth sometimes repeats the request without the token.
    const userId = cacheGet<string>(`ip2user:${ip}`);
    const cached = userId ? cacheGet<Record<string, unknown>>(`userinfo:${userId}`) : null;
    if (cached) return NextResponse.json(cached);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payload = verifyHs256(token, jwtSecret());
    if (!payload.sub) throw new Error("no sub");
    const user = await findUser(String(payload.sub));
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const data = {
      sub: user.id,
      id: user.id,
      name: user.display_name,
      email: user.email,
      email_verified: true,
      preferred_username: user.id,
    };
    cachePut(`userinfo:${user.id}`, data);
    cachePut(`ip2user:${ip}`, user.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[oidc/userinfo] token rejected:", (err as Error).message);
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
}
