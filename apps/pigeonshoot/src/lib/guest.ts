/**
 * Anonymous contributor identity.
 *
 * You do not need an account to post a pigeon. A signed-out visitor gets a row
 * in `pigeon_guests` and a signed cookie carrying its id, which is enough to
 * attribute their cards, let them edit their own, rate-limit them, and ban them
 * if it comes to that.
 *
 * They deliberately do NOT get a row in `users`.
 *
 * The tempting alternative is already in the tree: inner-gathering's forum
 * mints a real users row per anonymous visitor. It has never worked —
 * `users.auth_user_id` is NOT NULL with CHECK (auth_user_id = id) and no
 * trigger fills it, so the insert throws every time; there are zero such rows
 * in the database. Even fixed, it would put fake people in a table six other
 * apps read as "accounts". So every anonymous card is FK-owned by one seeded
 * sentinel user (siteConfig.sentinelUserId) and the real attribution lives in
 * pigeon_cards.guest_id.
 *
 * The cookie is HMAC-signed. An unsigned guest id would be a one-line
 * rate-limit bypass and would let anyone type someone else's id to claim or
 * delete their cards.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";

const COOKIE = "ps_guest";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Shared with the rest of the network's inter-service signing. It is always
 * set in compose; the fallback exists so a misconfigured dev container still
 * boots rather than crashing at import time — cookies signed with it simply
 * stop verifying once the real secret appears, which logs guests out and
 * costs nothing.
 */
const SECRET = process.env.INTER_APP_JWT_SECRET ?? "pigeonshoot-dev-secret";

const ADJECTIVES = [
  "Anonymous", "Passing", "Quiet", "Sudden", "Patient",
  "Distant", "Curious", "Restless", "Steady", "Fleeting",
];
const BIRDS = [
  "Kestrel", "Starling", "Grackle", "Sparrow", "Swift",
  "Crow", "Jay", "Wren", "Gull", "Finch",
];

function sign(id: string): string {
  return createHmac("sha256", SECRET).update(id).digest("base64url");
}

/** Constant-time compare, so the signature can't be brute-forced a byte at a time. */
function verify(id: string, sig: string): boolean {
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = BIRDS[Math.floor(Math.random() * BIRDS.length)];
  return `${a} ${b} ${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Client IP behind Nginx Proxy Manager: first hop of x-forwarded-for. */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return h.get("x-real-ip");
}

export interface Guest {
  id: string;
  displayName: string;
  handle: string | null;
  isBlocked: boolean;
  linkedUserId: string | null;
}

interface GuestRow {
  id: string;
  display_name: string;
  handle: string | null;
  is_blocked: boolean;
  linked_user_id: string | null;
}

const mapGuest = (r: GuestRow): Guest => ({
  id: r.id,
  displayName: r.display_name,
  handle: r.handle,
  isBlocked: r.is_blocked,
  linkedUserId: r.linked_user_id,
});

/**
 * The current guest, if this browser already has one. Read-only and safe in
 * Server Components — it never sets a cookie, so it can't fail the "cookies
 * modified during render" check.
 */
export async function getGuest(): Promise<Guest | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE)?.value;
    if (!raw) return null;

    const [id, sig] = raw.split(".");
    if (!id || !sig || !verify(id, sig)) return null;

    const rows = await db<GuestRow[]>`
      SELECT id, display_name, handle, is_blocked, linked_user_id
      FROM pigeon_guests WHERE id = ${id} LIMIT 1
    `;
    return rows.length > 0 ? mapGuest(rows[0]) : null;
  } catch (err) {
    console.error("[pigeonshoot] getGuest:", err);
    return null;
  }
}

/**
 * The current guest, minting one if this browser doesn't have it yet.
 *
 * Sets a cookie, so this may only be called from a Route Handler or Server
 * Action — never during a page render.
 */
export async function getOrCreateGuest(): Promise<Guest> {
  const existing = await getGuest();
  const ip = await getClientIp();

  if (existing) {
    // Touch last_seen/last_ip, but never let a bookkeeping failure break a
    // write the caller is in the middle of.
    db`
      UPDATE pigeon_guests
      SET last_seen_at = NOW(), last_ip = ${ip}::inet
      WHERE id = ${existing.id}
    `.catch((err) => console.error("[pigeonshoot] guest touch:", err));
    return existing;
  }

  const id = nanoid();
  const displayName = randomName();
  const jar = await cookies();
  const h = await headers();

  await db`
    INSERT INTO pigeon_guests (id, display_name, first_ip, last_ip, user_agent)
    VALUES (${id}, ${displayName}, ${ip}::inet, ${ip}::inet, ${h.get("user-agent")})
  `;

  jar.set(COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return { id, displayName, handle: null, isBlocked: false, linkedUserId: null };
}

export type WritableGuest =
  | { ok: true; guest: Guest }
  | { ok: false; reason: string };

/** Guest identity for a write path, refusing blocked contributors. */
export async function requireWritableGuest(): Promise<WritableGuest> {
  const guest = await getOrCreateGuest();
  if (guest.isBlocked) {
    return { ok: false, reason: "This browser has been blocked from contributing." };
  }
  return { ok: true, guest };
}

/**
 * Attach this browser's anonymous history to a real account.
 *
 * Called after sign-in. Moves ownership of every card the guest submitted:
 * pigeon_cards.submitter_user_id, and threads.author_id off the sentinel so
 * the card reads as authored by a real person everywhere in the network.
 * Returns how many cards were claimed.
 */
export async function claimGuestCards(userId: string): Promise<number> {
  const guest = await getGuest();
  if (!guest || guest.isBlocked || guest.linkedUserId) return 0;

  try {
    return await db.begin(async (tx) => {
      await tx`
        UPDATE pigeon_guests
        SET linked_user_id = ${userId}
        WHERE id = ${guest.id} AND linked_user_id IS NULL
      `;
      const rows = await tx<{ thread_id: string }[]>`
        UPDATE pigeon_cards
        SET submitter_user_id = ${userId}, updated_at = NOW()
        WHERE guest_id = ${guest.id} AND submitter_user_id IS NULL
        RETURNING thread_id
      `;
      if (rows.length > 0) {
        await tx`
          UPDATE threads
          SET author_id = ${userId}, updated_at = NOW()
          WHERE id = ANY(${rows.map((r) => r.thread_id)})
        `;
      }
      return rows.length;
    });
  } catch (err) {
    console.error("[pigeonshoot] claimGuestCards:", err);
    return 0;
  }
}
