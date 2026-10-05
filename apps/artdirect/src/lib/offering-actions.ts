"use server";

import { revalidatePath } from "next/cache";
import {
  ARTIST_SPACE_ORG_ID,
  getOwnOffering,
  getServiceOfferingById,
  isOfferingKind,
  listOfferings,
  saveOffering,
  serviceAnswersFromOffering,
  serviceInputFromAnswers,
  setFeaturedOffering,
  setOfferingStatus,
  type Offering,
} from "@elkdonis/services";
import { toSurfaceThread } from "@elkdonis/cms-ui/surface";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// The owner's offerings on their own ArtDirect page ("Manage your space").
//
// Every action acts as the signed-in person, taken from the session, never
// from the request: the service functions match author_id against it, so an
// id belonging to someone else is simply not found. See
// packages/services/src/artist-offerings.ts for the rules.
// ============================================================================

type Answers = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  return user;
}

async function refresh(userId: string) {
  // The profile and featured page of whoever this is. The slug is looked up
  // rather than passed in, so a caller cannot aim revalidation elsewhere.
  const { db } = await import("@elkdonis/db");
  const [row] = await db<{ slug: string | null }[]>`SELECT slug FROM users WHERE id = ${userId}`;
  if (row?.slug) {
    revalidatePath(`/${row.slug}`);
    revalidatePath(`/${row.slug}/featured`);
  }
}

export async function saveOfferingAction(input: {
  kind: string;
  answers: Answers;
  status: "draft" | "published";
  threadId?: string;
}): Promise<{ ok: true; id: string; href: string | null } | { ok: false; error: string }> {
  let user;
  try {
    user = await me();
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  if (!isOfferingKind(input.kind)) return { ok: false, error: "Only meetings and services can be offered here." };
  const a = input.answers;
  const format = str(a.format);
  const result = await saveOffering(
    user.id,
    {
      kind: input.kind,
      title: str(a.title),
      body: str(a.body),
      excerpt: str(a.excerpt) || null,
      coverImageUrl: str(a.cover_image_url) || null,
      status: input.status,
      visibility: str(a.visibility) || "PUBLIC",
      // On unless the person switched it off (decision: network visibility is
      // the default, opted out per publishing).
      shareToNetwork: a.share_to_network === undefined ? true : Boolean(a.share_to_network),
      scheduledAt: str(a.scheduled_at) || null,
      timeZone: str(a.time_zone) || null,
      durationMinutes: num(a.duration_minutes),
      location: str(a.location) || null,
      format: format === "online" || format === "in_person" || format === "hybrid" ? format : null,
      meetingUrl: str(a.meeting_url) || null,
      isRsvpEnabled: a.is_rsvp_enabled === undefined ? true : Boolean(a.is_rsvp_enabled),
      attendeeLimit: num(a.attendee_limit),
      price: num(a.price),
      currency: str(a.currency) || null,
      // A service's booking fields, read the same way on every site.
      ...(input.kind === "service" ? { service: serviceInputFromAnswers(a, input.status) } : {}),
    },
    input.threadId
  ).catch((err) => {
    console.error("[artdirect] saveOffering:", err);
    return { ok: false, error: "Could not save. Try again." } as const;
  });
  if (result.ok === false || !result.id) return { ok: false, error: result.error ?? "Could not save." };
  await refresh(user.id);
  return { ok: true, id: result.id, href: null };
}

export async function setOfferingStatusAction(
  threadId: string,
  status: "draft" | "published"
): Promise<{ ok: boolean; error?: string }> {
  const user = await me().catch(() => null);
  if (!user) return { ok: false, error: "Sign in first." };
  const ok = await setOfferingStatus(user.id, threadId, status);
  if (ok) await refresh(user.id);
  return ok ? { ok: true } : { ok: false, error: "Not found" };
}

export async function setFeaturedOfferingAction(
  threadId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const user = await me().catch(() => null);
  if (!user) return { ok: false, error: "Sign in first." };
  const ok = await setFeaturedOffering(user.id, threadId);
  if (ok) await refresh(user.id);
  return ok ? { ok: true } : { ok: false, error: "Publish it first; only a published offering can be featured." };
}

/** The panel's list: the signed-in person's own offerings, drafts included. */
export async function listMyOfferingsAction(): Promise<Offering[]> {
  const user = await me().catch(() => null);
  if (!user) return [];
  return listOfferings(user.id, { includeDrafts: true });
}

/** One of the signed-in person's offerings, shaped for the compose popup. */
export async function loadMyOfferingAction(threadId: string) {
  const user = await me().catch(() => null);
  if (!user) return null;
  const o = await getOwnOffering(user.id, threadId);
  if (!o) return null;
  // A service's sidecar (booking type, sliding scale, …) for the edit form.
  const service = o.kind === "service" ? await getServiceOfferingById(ARTIST_SPACE_ORG_ID, o.id) : null;
  return toSurfaceThread(
    {
      id: o.id,
      title: o.title,
      slug: o.slug,
      kind: o.kind,
      status: o.status,
      visibility: o.visibility,
      excerpt: o.excerpt,
      bodyHtml: o.body,
      coverImageUrl: o.coverImageUrl,
      authorName: null,
      authorPhoto: null,
      authorId: user.id,
      publishedAt: o.publishedAt,
      scheduledAt: o.scheduledAt,
      durationMinutes: o.durationMinutes,
      location: o.location,
      format: service?.format ?? (o.isOnline ? (o.location ? "hybrid" : "online") : "in_person"),
      meetingUrl: o.meetingUrl,
      isRsvpEnabled: o.isRsvpEnabled,
      attendeeLimit: o.attendeeLimit,
    },
    {
      price: o.price,
      currency: o.currency,
      // Read back by the host's threadToAnswers.
      extra: {
        time_zone: o.timeZone ?? "",
        share_to_network: o.shareToNetwork,
        ...(service ? serviceAnswersFromOffering(service) : {}),
      },
    }
  );
}
