"use server";

// ============================================================================
// Make into, carry-over (2026-11-15; docs/open/channel-convergence-2026-11-15/
// D-make-into.md section 7). `/studio/make?from=<thread|artwork>:<id>&to=<kind>` lands in the
// Studio with `from`; each form kind asks this for ONE preset built from the source, which
// the form shell applies on a new item (keeps what the person already typed).
//
// Access: the signed-in person only, and only through loaders that already enforce it:
//   - the summary's own scope: the piece must be on the viewer's Channel (loadChannelModel,
//     as studio-summary-action.ts): title, excerpt, cover, kind;
//   - a meeting or event: loadMeetingAction (author, or owner/guide of the org): body, hosts,
//     where, RSVP numbers;
//   - an artwork: loadArtworkFormAction (the store's owner or member roll): description,
//     pictures, medium, size.
// No raw SQL. A thread that is not a meeting (writing, video, post) has no safe body loader
// here, so it carries title, excerpt (as the description) and cover only. Dates and prices are
// never carried.
// ============================================================================

import { parseContentKey } from "@elkdonis/content/model";
import type { FormPreset } from "@elkdonis/studio-forms";
import { getCurrentUser } from "@/lib/session";
import { loadChannelModel } from "@/lib/channel/load";
import { loadMeetingAction } from "@/lib/meeting-actions";
import { loadArtworkFormAction } from "@/lib/artwork-form-actions";

const FORM_TARGETS = new Set(["meeting", "artwork-form", "service-form"]);
/** The Studio kind id to the form schema id. */
const FORM_KIND: Record<string, FormPreset["kind"]> = { meeting: "meeting", "artwork-form": "artwork", "service-form": "service" };
const SOURCE_NAME: Record<string, string> = {
  artwork: "artwork",
  product: "product",
  writing: "piece of writing",
  video: "video",
  series: "series",
  meeting: "meeting",
  event: "event",
  workshop: "workshop",
  questionnaire: "questionnaire",
  poll: "poll",
};

type Values = Record<string, unknown>;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function plain(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}
/** Drops keys with no value, so the preset never blanks what the form starts with. */
function pick(v: Values): Values {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== null && x !== ""));
}

export async function loadMakeIntoPresetAction(from: string, to: string, orgId: string): Promise<FormPreset | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (typeof from !== "string" || from.length > 80 || typeof to !== "string" || !FORM_TARGETS.has(to)) return null;
  const ref = parseContentKey(from);
  if (!ref) return null;
  const id = ref.id.slice(0, 64);
  const org = typeof orgId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(orgId) ? orgId : undefined;

  // 1. The Channel piece: the same read as the summary (the viewer's own scope).
  let piece = (await loadChannelModel(user, { org }).catch(() => null))?.pieces.find((p) => p.key === from) ?? null;
  if (!piece && org) piece = (await loadChannelModel(user, {}).catch(() => null))?.pieces.find((p) => p.key === from) ?? null;
  if (!piece) return null;

  let title = piece.title.trim();
  let excerpt = piece.excerpt.trim();
  let cover: string | null = piece.imageUrl;
  let bodyHtml = "";
  let bodyDoc: unknown = null;
  let pictures: Array<{ url: string; alt?: string }> = [];
  const extra: Values = {};
  const artworkExtra: Values = {};

  // 2. The richer reads, each behind its own access check (null when the viewer may not edit it).
  if (ref.store === "thread") {
    const m = await loadMeetingAction(id).catch(() => null);
    if (m) {
      const i = m.input;
      title = m.title?.trim() || title;
      bodyHtml = i.body ?? "";
      bodyDoc = i.bodyDoc ?? null;
      excerpt = (i.excerpt ?? "").trim() || excerpt;
      cover = i.coverImageUrl || cover;
      if (cover) pictures = [{ url: cover }];
      Object.assign(extra, {
        time_zone: i.timeZone,
        duration_minutes: i.durationMinutes,
        format: i.format,
        location: i.location,
        meeting_url: i.meetingUrl,
        video_link: i.videoLink,
        is_rsvp_enabled: i.isRsvpEnabled,
        attendee_limit: i.attendeeLimit ?? undefined,
        min_attendees: i.minAttendees ?? undefined,
        notify_on_min_attendees: i.notifyOnMinAttendees,
        visibility: i.visibility,
        create_talk_room: i.createTalkRoom,
        host_user_id: i.hostUserId,
        co_host_user_id: i.coHostUserId,
        reminder_minutes_before: i.reminderMinutesBefore ?? undefined,
      });
    } else if (cover) pictures = [{ url: cover }];
  } else if (ref.store === "artwork") {
    const a = await loadArtworkFormAction(id).catch(() => null);
    if (a) {
      const i = a.input;
      title = a.title?.trim() || title;
      bodyHtml = i.descriptionHtml ?? "";
      pictures = (i.images ?? []).map((p) => ({ url: p.url, ...(p.alt ? { alt: p.alt } : {}) }));
      cover = pictures[0]?.url ?? cover;
      Object.assign(artworkExtra, {
        medium: i.medium,
        height_cm: i.heightCm ?? undefined,
        width_cm: i.widthCm ?? undefined,
        depth_cm: i.depthCm ?? undefined,
      });
    } else if (cover) pictures = [{ url: cover }];
  }
  if (!title) return null;

  // No stored body (writing, video): the excerpt stands in as the description.
  const description = bodyHtml || (excerpt ? `<p>${esc(excerpt)}</p>` : "");
  const short = excerpt || clip(plain(bodyHtml), 280);

  let values: Values;
  if (to === "meeting") {
    // Meeting into meeting ("Next meeting"): everything but the dates and the repeat (a one-off next
    // meeting; copying a recurring source's pattern would start a second series). Left out:
    // scheduled_at, start_time, recurrence_pattern/custom_rule,
    // recurrence_until and rsvp_deadline are left out).
    const sameKind = ref.store === "thread" && Object.keys(extra).length > 0;
    values = pick({
      title,
      excerpt: short,
      body: description,
      ...(sameKind && bodyDoc ? { body_doc: bodyDoc } : {}),
      cover_image_url: cover ?? undefined,
      ...(sameKind ? extra : {}),
    });
  } else if (to === "artwork-form") {
    values = pick({ title, description, ...artworkExtra, ...(pictures.length ? { pictures } : {}) });
  } else {
    // service-form
    values = pick({ title, excerpt: short, body: description, cover_image_url: cover ?? undefined });
  }

  const typeName = SOURCE_NAME[piece.kind] ?? "piece";
  return {
    id: `from:${from}`,
    name: `From “${title}”`,
    note: `Carried over from ${typeName} “${title}”; change anything.`,
    kind: FORM_KIND[to],
    source: "item",
    values: values as FormPreset["values"],
  };
}
