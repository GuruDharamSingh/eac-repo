import { db } from '@elkdonis/db';
import { recurrenceIntervalMs } from '@elkdonis/utils';
import { SCHEDULED_KINDS } from './org-calendar';

// ============================================================================
// The standing meeting, as the hub card needs it.
//
// `org-calendar.ts` answers WHICH gathering leads the hub. This answers the
// three things a member and a guide then want from it:
//
//   1. an RSVP with nuance — "early yes", "hesitant yes", "not this week" —
//      each of which commits to one of the four canonical statuses, so every
//      existing count keeps working unchanged;
//   2. whether it is actually happening — a green / yellow / red light, set
//      by a host or derived from whether the minimum attendance is met;
//   3. what happened LAST time — the previous occurrence and the materials
//      and recordings it produced.
//
// Nothing here is kind-specific: the same functions serve a meeting, an event
// or a workshop, for the reason thread-rsvp.ts gives — `thread_rsvps` has no
// `kind` column and `min_attendees` / `attendee_limit` are plain columns on
// every thread. The calling route owns the permission check, as it does for
// every other service in this package.
// ============================================================================

// ─── Nuanced RSVPs ───────────────────────────────────────────────────────────

/** The canonical statuses. Unchanged: `thread_rsvps`'s CHECK still owns them. */
export type RsvpFlavourStatus = 'yes' | 'no' | 'maybe'

export interface RsvpFlavour {
  /** Stored in `thread_rsvps.flavour`. */
  key: string;
  /** What the menu reads. */
  label: string;
  /** Only the two definite answers are a real RSVP — see RSVP_FLAVOURS. */
  full?: boolean;
  /** What this commits to. Counting reads THIS and never the flavour. */
  status: RsvpFlavourStatus;
}

/**
 * The answers on offer, in the order they are shown.
 *
 * Deliberately six, running from firmest to softest, so the list reads as one
 * scale rather than a menu of unrelated options. Four of them are a yes —
 * which is the point: a hesitant yes is a yes and is counted as one, it is
 * simply a yes that tells a guide something.
 *
 * The vocabulary lives here, not in the database (see migration 130), because
 * it is still settling. A stored flavour that no longer appears in this list
 * still reads correctly as its status.
 */
export const RSVP_FLAVOURS: RsvpFlavour[] = [
  // Six answers, in one descending line from certain to not coming.
  //
  // Labels only — the explanatory second line each of these carried is gone.
  // A menu of six items with a sentence under each is more text than the
  // question deserves, and the labels are already the plain words a person
  // would use.
  //
  // `full` marks the two that are an actual RSVP: "Yes — 100%" and "Won't
  // make it". Those write a canonical `yes`/`no` and move the "N coming"
  // count. The four in between write `maybe`, because that is honestly what
  // they are — an early or hesitant yes is not a seat taken. They still feed
  // the traffic light, which counts yes AND maybe, so a gathering with five
  // soft yeses does not show red for want of commitment.
  { key: 'certain', label: 'Yes — 100%', status: 'yes', full: true },
  { key: 'early', label: 'Early yes', status: 'maybe' },
  { key: 'hesitant', label: 'Hesitant yes', status: 'maybe' },
  { key: 'maybe', label: 'Maybe', status: 'maybe' },
  { key: 'next_time', label: 'No, next time', status: 'maybe' },
  { key: 'wont', label: "Won't make it", status: 'no', full: true },
]
;

/** The flavour with this key, or null. */
export function rsvpFlavour(key: string | null | undefined): RsvpFlavour | null {
  if (!key) return null;
  return RSVP_FLAVOURS.find((f) => f.key === key) ?? null;
}

export interface MeetingAttendance {
  status: string;
  flavour: string | null;
  /**
   * Set alongside `flavour = 'next_time'` only — a soft commitment to the
   * occurrence after this one. Migration 155. Never true under any other
   * flavour; `setMeetingAttendance` enforces that on every write.
   */
  promiseNext: boolean;
}

/** What this person has said about this thread, or null if they never have. */
export async function getMeetingAttendance(
  threadId: string,
  userId: string
): Promise<MeetingAttendance | null> {
  const [row] = await db<Array<{ status: string; flavour: string | null; promise_next: boolean }>>`
    SELECT status, flavour, promise_next FROM thread_rsvps
    WHERE thread_id = ${threadId} AND user_id = ${userId}
  `;
  return row ? { status: row.status, flavour: row.flavour ?? null, promiseNext: row.promise_next } : null;
}

/**
 * Record a nuanced answer.
 *
 * The row is KEPT for a no, unlike the plain hub RSVP route, which deletes it:
 * "we'll make it next time" is information a guide asked for, and throwing the
 * row away throws the sentence away with it. Counting is unaffected — every
 * count in the network reads `status = 'yes'`, and these rows are 'no'.
 *
 * The caller has already established that this person may RSVP to this thread
 * (that it is their org's, that RSVPs are open, that there is room). This
 * writes what it is told.
 */
export async function setMeetingAttendance(
  threadId: string,
  userId: string,
  flavourKey: string,
  /** Only ever stored when `flavourKey` is `'next_time'` — forced false otherwise. */
  promiseNext = false
): Promise<MeetingAttendance | null> {
  const flavour = rsvpFlavour(flavourKey);
  if (!flavour) return null;
  const promise = flavour.key === 'next_time' && promiseNext;

  await db`
    INSERT INTO thread_rsvps (thread_id, user_id, status, flavour, promise_next)
    VALUES (${threadId}, ${userId}, ${flavour.status}, ${flavour.key}, ${promise})
    ON CONFLICT (thread_id, user_id)
    DO UPDATE SET status = EXCLUDED.status,
                  flavour = EXCLUDED.flavour,
                  promise_next = EXCLUDED.promise_next,
                  updated_at = NOW()
  `;
  return { status: flavour.status, flavour: flavour.key, promiseNext: promise };
}

/** Take the answer back entirely — not the same as answering no. */
export async function clearMeetingAttendance(
  threadId: string,
  userId: string
): Promise<void> {
  await db`
    DELETE FROM thread_rsvps WHERE thread_id = ${threadId} AND user_id = ${userId}
  `;
}

// ─── The light ───────────────────────────────────────────────────────────────

export type MeetingLightState = 'green' | 'yellow' | 'red';

export interface MeetingLight {
  state: MeetingLightState;
  /** Why, in words. The card shows this — a colour alone says nothing. */
  reason: string;
  /**
   * `host` — a guide said so; `derived` — read off the attendance minimum;
   * `default` — nothing says otherwise, so it is on.
   */
  source: 'host' | 'derived' | 'default';
  /** The day the host's word applies to, YYYY-MM-DD, when they named one. */
  occurrence?: string | null;
}

/** `threads.metadata` key holding a host's override. */
const LIGHT_KEY = 'meetingLight';

interface StoredLight {
  state?: string;
  note?: string | null;
  occurrence?: string | null;
  setBy?: string | null;
  setAt?: string | null;
}

function isState(value: unknown): value is MeetingLightState {
  return value === 'green' || value === 'yellow' || value === 'red';
}

/** Local YYYY-MM-DD. The granularity a host's word is given at. */
export function occurrenceKey(at: Date | string): string {
  const date = typeof at === 'string' ? new Date(at) : at;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

const DEFAULT_REASON: Record<MeetingLightState, string> = {
  green: 'Going ahead as scheduled.',
  yellow: 'It may or may not run this week.',
  red: 'Not running this week.',
};

/**
 * Is it happening?
 *
 * Green means it runs regardless, yellow means it may or may not, red means it
 * is off. Yellow is DERIVED whenever a gathering has a minimum attendance and
 * has not reached it — which is the honest reading of a meeting that needs
 * five people and has three — and a host's own word overrides that in either
 * direction, because only a person knows that this particular week is off.
 *
 * A host's word names the occurrence it is about, so it expires by itself: it
 * is a statement about THIS week, not a setting on the series. Asking about a
 * different occurrence than the one they spoke about gets the derived answer.
 */
export async function resolveMeetingLight(
  threadId: string,
  options: { occurrence?: Date | string | null } = {}
): Promise<MeetingLight> {
  const [row] = await db<
    Array<{
      min_attendees: number | null;
      is_rsvp_enabled: boolean;
      metadata: Record<string, unknown> | null;
      confirmed: number;
    }>
  >`
    SELECT t.min_attendees, t.is_rsvp_enabled, t.metadata,
           -- yes AND maybe. The four soft answers ("early yes", "hesitant
           -- yes", "maybe", "no, next time") store 'maybe' because they are
           -- not a seat taken, but they ARE people leaning in — and this is
           -- the number that decides whether the gathering shows amber for
           -- want of attendance. Counting only the definite yeses would show
           -- amber to a room of eight people who all intend to come.
           (SELECT COUNT(*)::int FROM thread_rsvps r
             WHERE r.thread_id = t.id AND r.status IN ('yes', 'maybe')) AS confirmed
    FROM threads t WHERE t.id = ${threadId}
  `;

  if (!row) {
    return { state: 'green', reason: DEFAULT_REASON.green, source: 'default' };
  }

  const asked = options.occurrence ? occurrenceKey(options.occurrence) : null;
  const stored = (row.metadata?.[LIGHT_KEY] ?? null) as StoredLight | null;

  if (stored && isState(stored.state)) {
    // No occurrence on the stored word means it is about the series, so it
    // applies whenever. One that names a day applies to that day only.
    const applies = !stored.occurrence || !asked || stored.occurrence === asked;
    if (applies) {
      return {
        state: stored.state,
        reason: (stored.note ?? '').trim() || DEFAULT_REASON[stored.state],
        source: 'host',
        occurrence: stored.occurrence ?? null,
      };
    }
  }

  const min = row.min_attendees;
  if (row.is_rsvp_enabled && min && min > 0 && row.confirmed < min) {
    return {
      state: 'yellow',
      reason: `${row.confirmed} of the ${min} needed have leaned in — it runs once ${min} are there.`,
      source: 'derived',
    };
  }

  return { state: 'green', reason: DEFAULT_REASON.green, source: 'default' };
}

/**
 * A host's word on this occurrence, written into `threads.metadata`.
 *
 * Metadata rather than a column of its own, deliberately: the shape of this
 * feature is still settling, and a jsonb key can change without a migration
 * and without every other reader of `threads` learning a new column. When it
 * settles, it moves.
 */
export async function setMeetingLight(
  threadId: string,
  input: {
    state: MeetingLightState;
    /** Why, in the host's own words. Shown on hover and focus. */
    note?: string | null;
    /** The day this is about. Omit to speak about the series. */
    occurrence?: Date | string | null;
    setBy?: string | null;
  }
): Promise<MeetingLight> {
  const stored: StoredLight = {
    state: input.state,
    note: (input.note ?? '').trim().slice(0, 240) || null,
    occurrence: input.occurrence ? occurrenceKey(input.occurrence) : null,
    setBy: input.setBy ?? null,
    setAt: new Date().toISOString(),
  };

  await db`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({
      [LIGHT_KEY]: stored,
    } as never)},
        updated_at = NOW()
    WHERE id = ${threadId}
  `;

  return {
    state: input.state,
    reason: stored.note || DEFAULT_REASON[input.state],
    source: 'host',
    occurrence: stored.occurrence,
  };
}

/** Take the host's word back; the light falls to whatever is derived. */
export async function clearMeetingLight(threadId: string): Promise<void> {
  await db`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb) - ${LIGHT_KEY},
        updated_at = NOW()
    WHERE id = ${threadId}
  `;
}

// ─── What last time produced ─────────────────────────────────────────────────

export type MeetingMaterialKind = 'image' | 'video' | 'audio' | 'document';

export interface MeetingMaterial {
  id: string;
  name: string;
  /** A platform URL — `/api/media/...` — or an external link for a recording. */
  url: string;
  kind: MeetingMaterialKind;
  mimeType?: string | null;
  size?: number | null;
  /** True when the URL leaves the network: a Zoom recording, a shared doc. */
  external?: boolean;
}

export interface PastMeetingOccurrence {
  threadId: string;
  title: string;
  kind: string;
  /** ISO. The occurrence, not the series' first date. */
  at: string;
  /** Whether this is an earlier occurrence of the same series, or another thread. */
  sameSeries: boolean;
  materials: MeetingMaterial[];
}

interface MeetingRow {
  id: string;
  title: string;
  kind: string;
  scheduled_at: string | null;
  recurrence_pattern: string | null;
  document_url: string | null;
  nextcloud_doc_url: string | null;
  video_url: string | null;
  video_link: string | null;
}

const MEETING_COLUMNS = `id, title, kind, scheduled_at, recurrence_pattern,
  document_url, nextcloud_doc_url, video_url, video_link`;

/**
 * The occurrence before `before`, and what it left behind.
 *
 * Two shapes of "last week's meeting" exist on this network and this handles
 * both. A RECURRING thread keeps one row and many occurrences, so stepping
 * back means stepping back one interval on the same row — its materials are
 * the series', which is what a member means by "the notes" for a gathering
 * that has met weekly for a year. A series kept as one thread PER WEEK means
 * stepping back to the previous scheduled thread in the org, which has its
 * own materials.
 *
 * Returns null when there is nothing behind it, which is the ordinary state
 * of a gathering's first week and not an error.
 */
export async function getPreviousMeetingOccurrence(
  orgId: string,
  input: { threadId: string; before: Date | string }
): Promise<PastMeetingOccurrence | null> {
  const before = typeof input.before === 'string' ? new Date(input.before) : input.before;
  if (Number.isNaN(before.getTime())) return null;

  const [thread] = await db<Array<MeetingRow>>`
    SELECT ${db.unsafe(MEETING_COLUMNS)} FROM threads
    WHERE id = ${input.threadId} AND org_id = ${orgId}
  `;
  if (!thread) return null;

  const pattern = thread.recurrence_pattern;
  if (pattern && pattern !== 'NONE' && thread.scheduled_at) {
    const start = new Date(thread.scheduled_at);
    const previous = stepBack(before, pattern);
    // Only if it is still inside the series. Before the first occurrence the
    // series simply did not exist yet, and the org's earlier gatherings are
    // the honest answer — so fall through rather than inventing a date.
    if (previous && previous.getTime() >= start.getTime()) {
      return {
        threadId: thread.id,
        title: thread.title,
        kind: thread.kind,
        at: previous.toISOString(),
        sameSeries: true,
        materials: await listMeetingMaterials(orgId, thread),
      };
    }
  }

  const [earlier] = await db<Array<MeetingRow>>`
    SELECT ${db.unsafe(MEETING_COLUMNS)} FROM threads
    WHERE org_id = ${orgId}
      AND status = 'published'
      AND kind = ANY(${SCHEDULED_KINDS as unknown as string[]})
      AND scheduled_at IS NOT NULL
      AND scheduled_at < ${before.toISOString()}
      AND id <> ${input.threadId}
    ORDER BY scheduled_at DESC
    LIMIT 1
  `;
  if (!earlier || !earlier.scheduled_at) return null;

  return {
    threadId: earlier.id,
    title: earlier.title,
    kind: earlier.kind,
    at: new Date(earlier.scheduled_at).toISOString(),
    sameSeries: false,
    materials: await listMeetingMaterials(orgId, earlier),
  };
}

/** One step back, by the pattern's own arithmetic — monthly keeps its date. */
function stepBack(from: Date, pattern: string): Date | null {
  if (pattern === 'MONTHLY') {
    const out = new Date(from);
    out.setMonth(out.getMonth() - 1);
    return out;
  }
  const ms = recurrenceIntervalMs(pattern);
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(from.getTime() - ms);
}

/**
 * Everything attached to a gathering: what was handed out and what came of it.
 *
 * Three sources, because the network has three. `media` rows attached to the
 * thread are uploads made against it; `document_url` / `nextcloud_doc_url` is
 * the notes document; `video_url` / `video_link` is the recording. A thread
 * with none of them returns an empty list, which the card says plainly rather
 * than pretending to be loading.
 */
export async function listMeetingMaterials(
  orgId: string,
  thread: string | MeetingRow
): Promise<MeetingMaterial[]> {
  let row: MeetingRow | null = null;
  if (typeof thread === 'string') {
    const [found] = await db<Array<MeetingRow>>`
      SELECT ${db.unsafe(MEETING_COLUMNS)} FROM threads
      WHERE id = ${thread} AND org_id = ${orgId}
    `;
    row = found ?? null;
  } else {
    row = thread;
  }
  if (!row) return [];

  const out: MeetingMaterial[] = [];

  try {
    const files = await db<
      Array<{
        id: string;
        filename: string | null;
        url: string;
        type: string | null;
        mime_type: string | null;
        size_bytes: number | null;
      }>
    >`
      SELECT id, filename, url, type, mime_type, size_bytes
      FROM media
      WHERE org_id = ${orgId}
        AND attached_to_type = 'thread'
        AND attached_to_id = ${row.id}
      ORDER BY created_at ASC
      LIMIT 40
    `;
    for (const file of files) {
      out.push({
        id: file.id,
        name: file.filename ?? 'Attachment',
        url: file.url,
        kind: materialKind(file.type, file.mime_type, file.filename),
        mimeType: file.mime_type,
        size: file.size_bytes,
      });
    }
  } catch (error) {
    // A missing attachment list costs the list, not the card.
    console.error(`[standing-meeting] materials for ${row.id}:`, error);
  }

  const doc = row.document_url || row.nextcloud_doc_url;
  if (doc) {
    out.push({
      id: `${row.id}:doc`,
      name: 'Notes document',
      url: doc,
      kind: 'document',
      external: isExternal(doc),
    });
  }

  const video = row.video_url || row.video_link;
  if (video) {
    out.push({
      id: `${row.id}:video`,
      name: 'Recording',
      url: video,
      kind: 'video',
      external: isExternal(video),
    });
  }

  return out;
}

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function materialKind(
  type: string | null,
  mime: string | null,
  name: string | null
): MeetingMaterialKind {
  if (type === 'image' || type === 'video' || type === 'audio') return type;
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('audio/')) return 'audio';
  if (name && /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name)) return 'image';
  if (name && /\.(mp4|mov|webm|mkv)$/i.test(name)) return 'video';
  if (name && /\.(mp3|wav|m4a|flac|ogg)$/i.test(name)) return 'audio';
  return 'document';
}
