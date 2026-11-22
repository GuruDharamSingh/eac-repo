import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { OfferingsClient, type Offering } from "./offerings-client";

// ============================================================================
// My Offerings — the author's management home for everything they publish.
// One row per authored thread (post / meeting / event / workshop) across all
// orgs the user belongs to, with RSVP counts, payment state, and readiness
// indicators (talk room, materials/document, customized RSVP email).
// ============================================================================

export default async function OfferingsPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?returnTo=/offerings");
  }
  const userId = session.user.id;
  const userIsAdmin = await isAdmin(userId);

  const rows = await db`
    SELECT
      t.id, t.kind, t.org_id, o.name AS org_name, t.title, t.slug, t.status,
      t.visibility, t.scheduled_at, t.published_at, t.created_at, t.updated_at,
      t.is_rsvp_enabled, t.attendee_limit,
      t.nextcloud_talk_token, t.document_url,
      COALESCE(r.yes_count, 0)::int AS rsvp_count,
      COALESCE(j.pending_count, 0)::int AS pending_payments,
      COALESCE(j.paid_count, 0)::int AS paid_count,
      (ets.id IS NOT NULL) AS has_custom_rsvp_email
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS yes_count
      FROM thread_rsvps r WHERE r.thread_id = t.id AND r.status = 'yes'
    ) r ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_count
      FROM workshop_join_requests w WHERE w.workshop_id = t.id
    ) j ON TRUE
    LEFT JOIN email_template_settings ets
      ON ets.org_id = t.org_id
     AND ets.template_key = 'rsvp-guest:' || t.id
    WHERE t.author_id = ${userId}
      AND t.kind IN ('post', 'meeting', 'event', 'workshop')
    ORDER BY COALESCE(t.scheduled_at, t.published_at, t.created_at) DESC
    LIMIT 200
  `;

  const offerings: Offering[] = rows.map((row: any) => ({
    id: row.id,
    kind: row.kind,
    orgId: row.org_id,
    orgName: row.org_name,
    title: row.title,
    status: row.status,
    visibility: row.visibility,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    updatedAt: new Date(row.updated_at).toISOString(),
    isRsvpEnabled: row.is_rsvp_enabled ?? false,
    attendeeLimit: row.attendee_limit ?? null,
    rsvpCount: row.rsvp_count,
    pendingPayments: row.pending_payments,
    paidCount: row.paid_count,
    hasTalkRoom: Boolean(row.nextcloud_talk_token),
    hasDocument: Boolean(row.document_url),
    hasCustomRsvpEmail: Boolean(row.has_custom_rsvp_email),
  }));

  return (
    <OfferingsClient
      offerings={offerings}
      userId={userId}
      isAdmin={userIsAdmin}
    />
  );
}
