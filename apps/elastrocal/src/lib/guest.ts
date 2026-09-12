/**
 * Guest identity: keep charts without an account.
 *
 * A signed-out browser gets a cookie carrying a random id, HMAC-signed so a
 * visitor can't type someone else's id and read or delete their charts. The
 * id is the only thing stored — no guest table, no `users` row (see the
 * header of apps/pigeonshoot/src/lib/guest.ts for why minting real users for
 * anonymous visitors never works). When the guest signs in, their charts are
 * claimed by the account (claimGuestCharts in lib/charts.ts).
 *
 * The cookie is only SET from route handlers (a Server Component can't modify
 * cookies), which is fine: the first thing a guest does that needs an id is
 * save a chart, and that is a POST.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/base-path";

const COOKIE = "el_guest";
const MAX_AGE = 60 * 60 * 24 * 365; // one year, refreshed on each save

// Shared network signing secret; the fallback keeps a misconfigured dev
// container booting (cookies just stop verifying once the real one appears).
const SECRET = process.env.INTER_APP_JWT_SECRET ?? "elastrocal-dev-secret";

function sign(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("base64url");
}

function verify(id: string, sig: string): boolean {
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function parse(raw: string | undefined): string | null {
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  return id && sig && /^[A-Za-z0-9_-]{16,32}$/.test(id) && verify(id, sig) ? id : null;
}

/** The guest id this browser already carries, or null. Read-only; safe in Server Components. */
export async function getGuestId(): Promise<string | null> {
  try {
    return parse((await cookies()).get(COOKIE)?.value);
  } catch {
    return null;
  }
}

export function newGuestId(): string {
  return randomBytes(12).toString("base64url");
}

/** Attach the guest cookie to a response — fresh or refreshed. Scoped to this app's path. */
export function setGuestCookie(res: NextResponse, id: string): void {
  res.cookies.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: BASE_PATH || "/",
    maxAge: MAX_AGE,
  });
}
