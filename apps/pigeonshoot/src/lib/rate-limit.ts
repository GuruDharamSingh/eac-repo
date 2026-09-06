/**
 * Rate limiting for anonymous write paths.
 *
 * Backed by Postgres (`pigeon_rate_events`), not Redis. Redis is available in
 * this monorepo, but getRedisClient() throws when REDIS_URL is unset, and the
 * convention here is fail-soft: a limiter that hard-fails the submit button
 * when the cache blinks is worse than an indexed COUNT(*) over a table that
 * will see a few thousand rows a month. The table also gives the owner's
 * moderation screens a visible abuse trail, which an expiring counter cannot.
 *
 * If volume ever justifies it, put a Redis INCR/EXPIRE in front of this as a
 * pre-check and keep the table as the record.
 */

import { db } from "@elkdonis/db";

export type Bucket = "upload" | "card" | "report" | "species";
type SubjectKind = "guest" | "ip" | "user";

/** [windowMinutes, maxInWindow] — every tuple must pass. */
type Window = [number, number];

const LIMITS: Record<Bucket, Record<SubjectKind, Window[]>> = {
  // Generous: one card can carry four photos, and people retry failed uploads.
  upload: { guest: [[60, 20], [1440, 60]], user: [[60, 60], [1440, 300]], ip: [[60, 90]] },
  card: { guest: [[60, 6], [1440, 20]], user: [[60, 20], [1440, 100]], ip: [[60, 30]] },
  report: { guest: [[60, 10], [1440, 30]], user: [[60, 30], [1440, 100]], ip: [[60, 40]] },
  species: { guest: [[1440, 3]], user: [[1440, 10]], ip: [[1440, 10]] },
};

export interface RateSubject {
  guestId?: string | null;
  userId?: string | null;
  ip?: string | null;
}

export type RateResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number; reason: string };

/**
 * Check every applicable window for this subject.
 *
 * IP limits are deliberately loose — a café or a campus behind one NAT is a
 * real thing and shouldn't be collectively punished for one enthusiast.
 *
 * Fails OPEN. If the limiter itself errors the write proceeds: a database
 * hiccup should not silently make the site read-only.
 */
export async function checkRate(bucket: Bucket, subject: RateSubject): Promise<RateResult> {
  const checks: Array<{ kind: SubjectKind; value: string; windows: Window[] }> = [];
  if (subject.guestId) checks.push({ kind: "guest", value: subject.guestId, windows: LIMITS[bucket].guest });
  if (subject.userId) checks.push({ kind: "user", value: subject.userId, windows: LIMITS[bucket].user });
  if (subject.ip) checks.push({ kind: "ip", value: subject.ip, windows: LIMITS[bucket].ip });
  if (checks.length === 0) return { ok: true };

  try {
    for (const check of checks) {
      for (const [minutes, max] of check.windows) {
        const rows = await db<{ n: string }[]>`
          SELECT COUNT(*) AS n FROM pigeon_rate_events
          WHERE bucket = ${bucket}
            AND subject_kind = ${check.kind}
            AND subject = ${check.value}
            AND outcome = 'ok'
            AND created_at > NOW() - (${minutes} * INTERVAL '1 minute')
        `;
        if (Number(rows[0]?.n ?? 0) >= max) {
          await record(bucket, check.kind, check.value, "denied");
          return {
            ok: false,
            retryAfterSeconds: minutes * 60,
            reason:
              minutes >= 1440
                ? "That's a lot of pigeons for one day. Try again tomorrow."
                : "Slow down a moment — try again shortly.",
          };
        }
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] checkRate:", err);
    return { ok: true };
  }
}

/** Log a successful write against every identity that performed it. */
export async function recordRate(bucket: Bucket, subject: RateSubject): Promise<void> {
  if (subject.guestId) await record(bucket, "guest", subject.guestId, "ok");
  if (subject.userId) await record(bucket, "user", subject.userId, "ok");
  if (subject.ip) await record(bucket, "ip", subject.ip, "ok");
  maybePrune();
}

async function record(
  bucket: Bucket,
  kind: SubjectKind,
  subject: string,
  outcome: "ok" | "denied" | "rejected"
): Promise<void> {
  try {
    await db`
      INSERT INTO pigeon_rate_events (bucket, subject_kind, subject, outcome)
      VALUES (${bucket}, ${kind}, ${subject}, ${outcome})
    `;
  } catch (err) {
    console.error("[pigeonshoot] recordRate:", err);
  }
}

/**
 * Opportunistic housekeeping — roughly 1% of writes drop rows older than the
 * longest window plus a wide margin. Deliberately not a cron job: this table
 * is small, and one more scheduled process to forget about is a worse trade
 * than an occasional cheap DELETE.
 */
function maybePrune(): void {
  if (Math.random() > 0.01) return;
  db`DELETE FROM pigeon_rate_events WHERE created_at < NOW() - INTERVAL '14 days'`.catch(
    (err) => console.error("[pigeonshoot] rate prune:", err)
  );
}
