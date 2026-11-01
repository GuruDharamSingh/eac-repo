"use server";

import { revalidatePath } from "next/cache";
import {
  createThread,
  ensureOrgCalendar,
  getOrgCalendarUri,
  pushThreadToCalendar,
  statusForNewThread,
  createTalkRoom,
  createCollaborativeDocument,
  getMeetingRota,
  listRotaCandidates,
  assignMeetingRole,
  clearMeetingRole,
  removeThreadFromCalendar,
  SERIES_KIND,
  saveSeriesSchedule,
  saveSeriesSettings,
  ensureSeriesTalkRoom,
  SeriesError,
  validTimeZone,
} from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { sanitizePostBody } from "@elkdonis/utils";
import { siteConfig } from "@/config/site";
import { getHubViewer } from "@/lib/hub-auth";

/**
 * The zone IFAC's compose form shows dates in when the form names none
 * (`components/hub/HubSurfaces.tsx` passes it to defaultThreadToAnswers).
 */
const COMPOSE_TIME_ZONE = "America/Toronto";

/** Same minute: the form has minute precision, `timestamptz` keeps microseconds. */
function sameMinute(a: string | Date | null | undefined, b: string | Date | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  if (Number.isNaN(x) || Number.isNaN(y)) return false;
  return Math.floor(x / 60_000) === Math.floor(y / 60_000);
}

/** `YYYY-MM-DDTHH:mm` as the wall clock in `timeZone`: the compose form's own format. */
function wallClockInput(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * IFAC's content save path.
 *
 * Before this, the app had exactly one thread writer: /api/manage/events, a raw
 * INSERT with `duration_minutes` hardcoded to 75, no slug-collision handling,
 * no cover image, no recurrence, and `kind = 'event'` — a kind that appears
 * nowhere else in the live data (there are 16 `meeting` rows and zero `event`
 * rows network-wide). That route stays for now; nothing new should use it.
 *
 * This goes through `createThread` in @elkdonis/services, the shared write
 * path. It was `createPost` with `kind` hardcoded to 'post' until this needed
 * events — which is precisely why five apps had hand-rolled their own INSERT
 * and each lost slug-collision handling and excerpt derivation on the way.
 *
 * A dated, published thread is pushed to the org's Nextcloud calendar on the
 * way out. That push is best-effort: an event that saved but didn't mirror is
 * a sync problem, not a lost event, and failing the save would throw away the
 * member's writing over an upstream hiccup.
 */

export type SaveContentResult =
  | {
      ok: true;
      id: string;
      slug: string;
      status?: "draft" | "pending" | "published";
      /** What could not be attached — a Talk room, a document. The thread saved. */
      warnings?: string[];
      /** Where to go next, when not back to the chooser: a published series' planner. */
      href?: string;
    }
  | { ok: false; error: string };

export interface SaveContentInput {
  /**
   * `workshop` joined the list when compose moved into the hub's surface: the
   * shared catalogue offers it in `dialog` mode for a site with no template
   * wizard, and IFAC is such a site. `threads.kind` has no CHECK constraint
   * and six workshop rows already exist network-wide, so this writes a kind
   * the schema and the rest of the platform already understand rather than
   * inventing one. It is dated, like an event and a meeting.
   */
  kind: "post" | "event" | "meeting" | "workshop" | "series";
  title: string;
  body?: string;
  excerpt?: string;
  status?: "draft" | "published";
  section?: string | null;
  coverImageUrl?: string | null;
  // Dated kinds. Instants (ISO with an offset): compose-adapter.ts converts
  // the form's wall clock in `timeZone` before this is called.
  /** The zone the form showed its dates in. */
  timeZone?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  format?: "in_person" | "online" | "hybrid" | null;
  meetingUrl?: string | null;
  isRsvpEnabled?: boolean;
  attendeeLimit?: number | null;
  recurrencePattern?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  recurrenceUntil?: string | null;
  /** Free text describing an irregular schedule. Never parsed. */
  recurrenceCustomRule?: string | null;
  /** Make the gathering a Nextcloud Talk room (public, joinable by link). */
  createTalkRoom?: boolean;
  /** Make it a collaborative Nextcloud document. */
  createDocument?: boolean;
  /** Host of the NEXT occurrence. undefined = not asked; "" = nobody. */
  hostUserId?: string;
  /** Co-host of the NEXT occurrence, same convention. */
  coHostUserId?: string;
  /** Kind `series` only: what services' saveSeriesSchedule / saveSeriesSettings take. */
  series?: SeriesComposeInput;
}

export interface SeriesComposeInput {
  /** From an edit form: schedule, joining, zones and letter are the planner's and are not written. */
  editing: boolean;
  /** Null when the form's first session or zone is missing. */
  schedule: {
    weekday: number;
    time: string;
    timeZone: string;
    firstDate: string;
    lastDate: string | null;
    durationMinutes: number | null;
    alsoZones: string[];
  } | null;
  lede: string | null;
  /** `undefined` leaves the stored value alone (an edit). */
  joinUrl?: string | null;
  meetingId?: string | null;
  passcode?: string | null;
  otherWaysToJoin?: string | null;
  reminderDays?: number | null;
  alsoZones?: string[];
}

/**
 * Give a gathering its Talk room and/or its collaborative document.
 *
 * Modelled on innergathering's `attachRooms` — same two calls, same
 * best-effort posture: whatever fails comes back as a sentence for the author
 * rather than an exception, because the thread is already saved by this point
 * and losing it to a Nextcloud hiccup would be the worse outcome.
 *
 * A Talk room is made PUBLIC (type 3), which is the type a person without a
 * Nextcloud account can join from a link — most people at an IFAC gathering.
 */
async function attachRooms(
  threadId: string,
  title: string,
  input: SaveContentInput
): Promise<string[]> {
  const warnings: string[] = [];
  const wantTalk = Boolean(input.createTalkRoom) && input.kind !== "post";
  const wantDoc = Boolean(input.createDocument);
  if (!wantTalk && !wantDoc) return warnings;

  // What it already has. The switches mean "there should be one", not "make
  // another": re-saving an edited meeting must not spawn a second Talk room,
  // and the edit form now opens with the switch ON for a thread that has one
  // (defaultThreadToAnswers), so this runs on nearly every edit.
  const [current] = await db<
    Array<{ nextcloud_talk_token: string | null; document_url: string | null }>
  >`SELECT nextcloud_talk_token, document_url FROM threads WHERE id = ${threadId}`;

  if (wantTalk && !current?.nextcloud_talk_token) {
    try {
      // Whoever wrote the thread becomes a MODERATOR of its room, and the
      // room is listed for Nextcloud users. Without this the author was a
      // transient link-visitor in their own meeting's room: unable to add
      // people, and gone from their conversation list once they left. The
      // author is read from the thread, which is already saved by now; an
      // author with no linked Nextcloud account just skips promotion.
      const [author] = await db<{ nextcloud_user_id: string | null }[]>`
        SELECT u.nextcloud_user_id FROM threads t
        JOIN users u ON u.id = t.author_id
        WHERE t.id = ${threadId}
      `;
      const token = await createTalkRoom(title, "public", {
        moderator: author?.nextcloud_user_id ?? null,
        listable: 1,
      });
      if (token) {
        await db`UPDATE threads SET nextcloud_talk_token = ${token} WHERE id = ${threadId}`;
      } else {
        warnings.push("The Talk room could not be created.");
      }
    } catch (err) {
      console.error("[ifac] createTalkRoom:", err);
      warnings.push("The Talk room could not be created.");
    }
  }

  if (wantDoc && !current?.document_url) {
    try {
      const doc = await createCollaborativeDocument(siteConfig.orgId, title, threadId);
      if (doc?.url) {
        await db`UPDATE threads SET document_url = ${doc.url} WHERE id = ${threadId}`;
      } else {
        warnings.push("The document could not be created.");
      }
    } catch (err) {
      console.error("[ifac] createCollaborativeDocument:", err);
      warnings.push("The document could not be created.");
    }
  }

  return warnings;
}

/**
 * Put the form's "Who's hosting" onto the rota, for the next occurrence.
 *
 * The rota (meeting_hosts) is the ONE place a host lives — Plan ahead reads
 * and writes the same rows — so the form writes there rather than keeping a
 * second copy on the thread that could drift from it. "Next" is the rota's own
 * idea of the next occurrence, which is right for a one-off (its only date)
 * and for a weekly meeting (the coming week) alike.
 *
 * undefined leaves the rota alone (the form had no hosting fields); "" clears
 * the role; an id assigns it. Only someone in this org's candidate list can be
 * put down, so a crafted request cannot name an outsider as host.
 */
async function assignNextHosts(
  threadId: string,
  input: SaveContentInput,
  actorUserId: string
): Promise<string[]> {
  if (input.hostUserId === undefined && input.coHostUserId === undefined) return [];
  const warnings: string[] = [];
  try {
    const rota = await getMeetingRota(threadId, { from: new Date(), count: 1 });
    const next = rota.occurrences[0];
    if (!next) return warnings; // nothing ahead to host
    const allowed = new Set((await listRotaCandidates(siteConfig.orgId)).map((c) => c.userId));

    for (const [role, userId] of [
      ["host", input.hostUserId],
      ["co-host", input.coHostUserId],
    ] as const) {
      if (userId === undefined) continue;
      if (userId === "") {
        await clearMeetingRole(threadId, next.at, role);
      } else if (allowed.has(userId)) {
        await assignMeetingRole({ threadId, occurrenceAt: next.at, role, userId, actorUserId });
      } else {
        warnings.push(`That ${role} isn't a member here, so they weren't put down.`);
      }
    }
  } catch (err) {
    console.error("[ifac] assignNextHosts:", err);
    warnings.push("The host could not be saved to the rota.");
  }
  return warnings;
}

/**
 * Save an edit onto the thread that already exists.
 *
 * Deliberately narrow: it writes the fields the composer owns and leaves
 * everything else — author, created_at, the slug people may already have
 * linked, published_at — alone. `status` still goes through the review rule,
 * so a member editing their own piece under a queue sends it back for a look
 * rather than republishing it themselves.
 */
async function updateExisting(
  threadId: string,
  input: SaveContentInput,
  title: string,
  dated: boolean,
  status: "draft" | "pending" | "published",
  viewerId: string
): Promise<SaveContentResult> {
  const [existing] = await db<
    Array<{
      id: string;
      slug: string;
      author_id: string;
      kind: string;
      scheduled_at: Date | null;
      duration_minutes: number | null;
      recurrence_pattern: string | null;
      recurrence_until: Date | null;
      recurrence_custom_rule: string | null;
      status: string;
      is_series: boolean;
    }>
  >`
    SELECT id, slug, author_id, kind, status, scheduled_at, duration_minutes,
           recurrence_pattern, recurrence_until, recurrence_custom_rule,
           (kind = ${SERIES_KIND}
            OR COALESCE(jsonb_typeof(metadata->'series') = 'object', false)) AS is_series
    FROM threads
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
    LIMIT 1
  `;
  if (!existing) return { ok: false, error: "That item no longer exists" };

  const viewer = await getHubViewer();
  // Its author, or an editor. A member may not rewrite someone else's piece.
  if (!viewer?.canEdit && existing.author_id !== viewerId) {
    return { ok: false, error: "Only its author or an editor can change this" };
  }

  // A meeting series (kind 'series', or a meeting carrying `metadata.series`
  // as an object until the kind flip; writing threads carry a string there)
  // keys its weeks' hosts, notes and topics on occurrence instants derived
  // from its schedule. A schedule written from here would move the weeks
  // without their content, so its kind, schedule and recurrence are the
  // planner's alone (`saveSeriesSchedule`); this save keeps them as stored.
  const seriesWarnings: string[] = [];
  if (existing.is_series) {
    const planner = `/hub/series/${existing.id}`;
    if (input.kind !== existing.kind) {
      return {
        ok: false,
        error: `This is a series; its kind cannot be changed here. Its schedule is set in the series planner (${planner}). Nothing was saved.`,
      };
    }
    // The form's dates arrive as instants (compose-adapter.ts converts the
    // wall clock in the form's zone). The form fills them from the stored
    // instants in that same zone (defaultThreadToAnswers), so an untouched
    // date compares equal. `recurrence_until` is a date in the form, so it is
    // compared as the date it reads in that zone.
    const zone = validTimeZone(input.timeZone) ?? COMPOSE_TIME_ZONE;
    const asDate = (d: string | Date | null | undefined) => (d ? wallClockInput(new Date(d), zone).slice(0, 10) : null);
    // A series' own form (kind `series`) hides the schedule and says where it
    // is changed, so there is nothing to warn about there.
    const dateChanged =
      input.kind !== SERIES_KIND &&
      (!sameMinute(input.scheduledAt, existing.scheduled_at) ||
        (input.recurrencePattern ?? null) !== existing.recurrence_pattern ||
        asDate(input.recurrenceUntil) !== asDate(existing.recurrence_until) ||
        (input.durationMinutes ?? 60) !== (existing.duration_minutes ?? 60));
    if (dateChanged) {
      seriesWarnings.push(
        `This is a series: its date, length and repeat are set in the series planner (${planner}). Those changes were not saved; everything else was.`
      );
    }
  } else if (input.kind === SERIES_KIND) {
    // A series is made new from Compose, where its schedule is laid down by
    // saveSeriesSchedule; relabelling a meeting would skip that.
    return {
      ok: false,
      error: "A meeting cannot be turned into a series here. Make the series from Compose › Meeting › Series. Nothing was saved.",
    };
  }
  // For a series the UPDATE below leaves kind, schedule and recurrence as stored.
  const keep = existing.is_series;
  // The series form (kind `series`) carries none of the meeting's own fields
  // (body, place, join link, RSVP limit): leave them as stored.
  const seriesForm = input.kind === SERIES_KIND;

  // Renaming a published series re-titles its weeks' topics as well, which
  // saveSeriesSettings does only when it sees the old title, so it runs
  // before the UPDATE below writes the new one. It also writes the lede.
  if (seriesForm && existing.status === "published") {
    try {
      await saveSeriesSettings({
        orgId: siteConfig.orgId,
        threadId,
        title,
        ...(input.series && input.series.lede !== undefined ? { lede: input.series.lede } : {}),
      });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not save the series" };
    }
  }

  // Members can edit their own posts, so the body is untrusted. createThread
  // sanitises the create path; this hand-written UPDATE has to do it itself.
  const body = input.body?.trim() ? sanitizePostBody(input.body.trim()) : null;

  await db`
    UPDATE threads SET
      kind             = ${keep ? db`kind` : input.kind},
      title            = ${title},
      body             = ${seriesForm ? db`body` : body || null},
      excerpt          = ${input.excerpt?.trim() || null},
      status           = ${status},
      section          = ${input.section || null},
      scheduled_at     = ${keep ? db`scheduled_at` : dated ? input.scheduledAt : null},
      duration_minutes = ${keep ? db`duration_minutes` : dated ? (input.durationMinutes ?? 60) : null},
      location         = ${seriesForm ? db`location` : input.location || null},
      format           = ${seriesForm ? db`format` : dated ? (input.format ?? "online") : null},
      meeting_url      = ${seriesForm ? db`meeting_url` : input.meetingUrl || null},
      is_rsvp_enabled  = ${seriesForm ? db`is_rsvp_enabled` : dated ? (input.isRsvpEnabled ?? true) : false},
      attendee_limit   = ${seriesForm ? db`attendee_limit` : input.attendeeLimit ?? null},
      recurrence_pattern     = ${keep ? db`recurrence_pattern` : dated ? (input.recurrencePattern ?? null) : null},
      recurrence_until       = ${keep ? db`recurrence_until` : dated ? (input.recurrenceUntil ?? null) : null},
      recurrence_custom_rule = ${keep ? db`recurrence_custom_rule` : dated ? (input.recurrenceCustomRule ?? null) : null},
      published_at     = CASE
        WHEN ${status} = 'published' AND published_at IS NULL THEN NOW()
        ELSE published_at
      END,
      updated_at       = NOW()
    WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
  `;

  // A draft series published from here: its lede was written above only if
  // it was already published, so write it now that loadSeries can see it.
  if (seriesForm && existing.status !== "published" && status === "published" && input.series) {
    await saveSeriesSettings({ orgId: siteConfig.orgId, threadId, lede: input.series.lede }).catch((err) => {
      console.error("[ifac] saveSeriesSettings after publish:", err);
    });
  }

  if (input.coverImageUrl !== undefined) {
    await db`
      UPDATE threads
      SET metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('coverImageUrl', ${input.coverImageUrl ?? null}::text)
      WHERE id = ${threadId} AND org_id = ${siteConfig.orgId}
    `;
  }

  const warnings = [
    ...seriesWarnings,
    ...(await attachRooms(threadId, title, input)),
    // A series' hosts are set per week in the planner, not from here.
    ...(dated && !keep ? await assignNextHosts(threadId, input, viewerId) : []),
  ];

  if (dated && status === "published") {
    await mirrorToCalendar(threadId);
  } else {
    // Back to a draft, or waiting on a guide: not on anyone's calendar.
    await removeThreadFromCalendar(siteConfig.orgId, threadId).catch(() => {});
  }

  revalidatePath("/hub");
  revalidatePath("/");
  return { ok: true, id: threadId, slug: existing.slug, status, warnings };
}

export async function saveContentAction(
  input: SaveContentInput,
  /**
   * The thread being EDITED. The shared compose surface has always passed it
   * (`connectors.saveThread({ …, threadId })`) and this action used to ignore
   * it, so every edit inserted a second thread — and, before attachRooms
   * became idempotent, a second Talk room with it. Absent means "new".
   */
  threadId?: string
): Promise<SaveContentResult> {
  const viewer = await getHubViewer();
  if (!viewer) return { ok: false, error: "Members only" };
  // Who may write what (owner's call, 2026-09-19): a MEMBER may post in the
  // hub — that is what membership is for — while anything DATED puts a
  // gathering on the collective's calendar and stays with owners and guides.
  // The catalogue mirrors this with `canPublishDated`, so a member is never
  // shown a form this then refuses.
  if (!viewer.canEdit && input.kind !== "post") {
    return { ok: false, error: "Only owners and guides can publish a dated item" };
  }

  const title = (input.title ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Give it a title" };

  const dated = input.kind !== "post";
  if (dated && !input.scheduledAt) {
    return { ok: false, error: "Pick a date and time" };
  }

  // Straight up, or into the submissions queue? The shared rule (services'
  // statusForNewThread): a moderator publishes outright, a member's post
  // waits only if IFAC has asked for a look first — which it has not, by
  // default. Saving a draft stays a draft either way.
  const status = await statusForNewThread(
    viewer.userId,
    siteConfig.orgId,
    input.status === "draft" ? "draft" : "published"
  );

  try {
    if (threadId) return await updateExisting(threadId, input, title, dated, status, viewer.userId);
    if (input.kind === SERIES_KIND) return await createSeries(input, title, status, viewer.userId);

    const thread = await createThread({
      kind: input.kind,
      orgId: siteConfig.orgId,
      authorId: viewer.userId,
      title,
      body: input.body?.trim() || undefined,
      excerpt: input.excerpt?.trim() || undefined,
      status,
      visibility: "PUBLIC",
      section: input.section || null,
      scheduledAt: dated ? input.scheduledAt : null,
      durationMinutes: dated ? (input.durationMinutes ?? 60) : null,
      location: input.location || null,
      format: dated ? (input.format ?? "online") : null,
      meetingUrl: input.meetingUrl || null,
      isRsvpEnabled: dated ? (input.isRsvpEnabled ?? true) : null,
      attendeeLimit: input.attendeeLimit ?? null,
    });

    // `createThread` covers the columns every kind shares. Recurrence belongs
    // only to dated kinds, so it is set here rather than widening the shared
    // signature for one app's case. Note 'NONE' is NOT a legal value — the
    // CHECK accepts NULL or one of four patterns.
    if (dated && (input.recurrencePattern || input.recurrenceCustomRule)) {
      await db`
        UPDATE threads SET
          recurrence_pattern = ${input.recurrencePattern},
          recurrence_until = ${input.recurrenceUntil ?? null},
          recurrence_custom_rule = ${input.recurrenceCustomRule ?? null}
        WHERE id = ${thread.id} AND org_id = ${siteConfig.orgId}
      `;
    }
    if (input.coverImageUrl) {
      await db`
        UPDATE threads
        SET metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object('coverImageUrl', ${input.coverImageUrl}::text)
        WHERE id = ${thread.id} AND org_id = ${siteConfig.orgId}
      `;
    }

    // The rooms a gathering can be given. Both need the thread's id, so they
    // happen after it exists; both are best-effort, because a Nextcloud that
    // is slow or down must not lose the meeting someone just wrote.
    const rooms = [
      ...(await attachRooms(thread.id, title, input)),
      ...(dated ? await assignNextHosts(thread.id, input, viewer.userId) : []),
    ];

    if (dated && (input.status ?? "published") === "published") {
      await mirrorToCalendar(thread.id);
    }

    revalidatePath("/hub");
    revalidatePath("/");
    return { ok: true, id: thread.id, slug: thread.slug, status, warnings: rooms };
  } catch (error) {
    console.error("[ifac] saveContentAction:", error);
    return { ok: false, error: "Could not save that" };
  }
}

/** An http(s) URL, or null. Same rule as saveSeriesSettings, checked before anything is written. */
function httpUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * A new meeting series from Compose (2026-10-10,
 * docs/open/SERIES_KIND_DESIGN_2026-10-10.md §5).
 *
 * `createThread` with kind `series` and the whole row at once: the first
 * session (an instant, from the adapter), WEEKLY with its exclusive end, and
 * `metadata` with the zone, cover, lede, display zones, letter days and join
 * details, so a draft series is complete. A published one then goes through
 * the series services, which read only published rows: `saveSeriesSchedule`
 * (not a dry run) recomputes the first session and end from the schedule
 * strings in the series' zone and stores the display zones;
 * `saveSeriesSettings` writes the lede, join details and letter days through
 * their own validation; `ensureSeriesTalkRoom` makes the room when asked and
 * no join link was given. A draft gets its room from `attachRooms`, which
 * works on any status. No hosts: weeks are planned in /hub/series/<id>.
 *
 * Everything that can be refused is checked before the row is written, so a
 * refusal leaves nothing behind. A failure after the row exists is reported
 * as a warning on a saved series, not as a lost one.
 */
async function createSeries(
  input: SaveContentInput,
  title: string,
  status: "draft" | "pending" | "published",
  viewerId: string
): Promise<SaveContentResult> {
  const series = input.series;
  const schedule = series?.schedule ?? null;
  if (!series || !schedule) return { ok: false, error: "Pick the first session and the time zone the series meets in" };
  const zone = validTimeZone(schedule.timeZone);
  if (!zone) return { ok: false, error: "Pick a time zone from the list" };
  if (!input.scheduledAt || Number.isNaN(Date.parse(input.scheduledAt))) {
    return { ok: false, error: "Pick the date and time of the first session" };
  }
  if (input.recurrenceUntil && Date.parse(input.recurrenceUntil) <= Date.parse(input.scheduledAt)) {
    return { ok: false, error: "The last session is before the first" };
  }
  const joinUrl = series.joinUrl ?? null;
  if (!httpUrl(joinUrl)) return { ok: false, error: "The join link must start with https://" };
  const duration = input.durationMinutes ?? 60;
  if (duration < 15 || duration > 600) return { ok: false, error: "A session lasts between 15 minutes and 10 hours" };
  const alsoZones = (series.alsoZones ?? []).map((z) => validTimeZone(z)).filter((z): z is string => Boolean(z)).slice(0, 6);
  const reminderDays = Math.max(0, Math.min(14, Math.round(series.reminderDays ?? 2)));
  const lede = series.lede?.trim().slice(0, 1000) || null;

  const thread = await createThread({
    kind: SERIES_KIND,
    orgId: siteConfig.orgId,
    authorId: viewerId,
    title,
    excerpt: lede ?? undefined,
    status,
    visibility: "PUBLIC",
    section: input.section || null,
    scheduledAt: input.scheduledAt,
    durationMinutes: duration,
    format: "online",
    isRsvpEnabled: true,
    metadata: {
      timeZone: zone,
      ...(input.coverImageUrl ? { coverImageUrl: input.coverImageUrl } : {}),
      series: { lede, alsoZones, reminderDays },
      joinDetails: {
        url: joinUrl,
        meetingId: series.meetingId ?? null,
        passcode: series.passcode ?? null,
        other: series.otherWaysToJoin ?? null,
      },
    },
  });
  await db`
    UPDATE threads SET
      recurrence_pattern = 'WEEKLY',
      recurrence_until = ${input.recurrenceUntil ?? null}::timestamptz
    WHERE id = ${thread.id} AND org_id = ${siteConfig.orgId}
  `;

  const warnings: string[] = [];
  const wantTalk = Boolean(input.createTalkRoom) && !joinUrl;
  if (status === "published") {
    try {
      await saveSeriesSchedule({
        orgId: siteConfig.orgId,
        threadId: thread.id,
        schedule: { ...schedule, timeZone: zone, durationMinutes: duration, alsoZones },
      });
    } catch (err) {
      console.error("[ifac] saveSeriesSchedule:", err);
      warnings.push(
        err instanceof SeriesError
          ? `The series saved, but its schedule was not confirmed: ${err.message} Check it in the planner.`
          : "The series saved, but its schedule was not confirmed. Check it in the planner."
      );
    }
    try {
      await saveSeriesSettings({
        orgId: siteConfig.orgId,
        threadId: thread.id,
        lede,
        joinUrl,
        meetingId: series.meetingId ?? null,
        passcode: series.passcode ?? null,
        otherWaysToJoin: series.otherWaysToJoin ?? null,
        reminderDays,
      });
    } catch (err) {
      console.error("[ifac] saveSeriesSettings:", err);
      warnings.push("The series saved, but its description or joining details were not. Set them in the planner.");
    }
    if (wantTalk) {
      try {
        await ensureSeriesTalkRoom({ orgId: siteConfig.orgId, threadId: thread.id, actorUserId: viewerId });
      } catch (err) {
        console.error("[ifac] ensureSeriesTalkRoom:", err);
        warnings.push("The Talk room could not be created.");
      }
    }
    await mirrorToCalendar(thread.id);
  } else if (wantTalk) {
    warnings.push(...(await attachRooms(thread.id, title, { ...input, createDocument: false })));
  }

  revalidatePath("/hub");
  revalidatePath("/");
  return {
    ok: true,
    id: thread.id,
    slug: thread.slug,
    status,
    warnings,
    // The planner reads published series only (services' loadSeries).
    ...(status === "published" ? { href: `/hub/series/${thread.id}` } : {}),
  };
}

/**
 * Best-effort push into the org's calendar, provisioning it on first use.
 *
 * Provisioning at publish rather than at read follows org-deck's rule: a
 * resource is created by an act of publishing, never as a side effect of
 * someone opening a page.
 */
async function mirrorToCalendar(threadId: string): Promise<void> {
  try {
    if (!(await getOrgCalendarUri(siteConfig.orgId))) {
      await ensureOrgCalendar(siteConfig.orgId);
    }
    await pushThreadToCalendar(siteConfig.orgId, threadId);
  } catch (error) {
    console.error("[ifac] calendar mirror failed:", error);
  }
}
