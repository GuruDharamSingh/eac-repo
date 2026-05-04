import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";
import { SiteShell } from "@/components/site-shell";
import { WorkshopForm } from "@/components/hub/WorkshopForm";
import { db } from "@elkdonis/db";
import type { WorkshopFullInput } from "@/lib/cms/schema";

type ThreadRow = {
  id: string;
  slug: string;
  org_id: string;
  org_slug: string;
  title: string;
  body: string | null;
  status: string;
  visibility: string;
  share_to_network: boolean;
  scheduled_at: string | null;
  duration_minutes: number | null;
  location: string | null;
  format: string | null;
  meeting_url: string | null;
  is_rsvp_enabled: boolean | null;
  attendee_limit: number | null;
  price: string | null;
  currency: string | null;
  sessions: unknown;
  nextcloud_doc_url: string | null;
  // sidecar
  subtitle: string | null;
  description_short: string | null;
  discipline: string | null;
  series_label: string | null;
  level: string | null;
  language: string | null;
  session_count: number | null;
  session_duration_hrs: string | null;
  recurrence_label: string | null;
  location_address: string | null;
  accessibility_notes: string | null;
  price_sliding_min: string | null;
  price_member: string | null;
  sliding_scale_note: string | null;
  registration_url: string | null;
  registration_deadline: string | null;
  registration_status: string | null;
  author_note: string | null;
  cover_image_url: string | null;
  promo_video_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  optional_sections: Record<string, boolean> | null;
};

export default async function EditWorkshopPage({
  params,
}: {
  params: Promise<{ orgSlug: string; threadId: string }>;
}) {
  const { orgSlug, threadId } = await params;
  const user = await requireUser();

  const rows = await db<ThreadRow[]>`
    SELECT
      t.id, t.slug, t.org_id, o.slug AS org_slug,
      t.title, t.body, t.status, t.visibility, t.share_to_network,
      t.scheduled_at, t.duration_minutes, t.location, t.format,
      t.meeting_url, t.is_rsvp_enabled, t.attendee_limit,
      t.price, t.currency, t.sessions, t.nextcloud_doc_url,
      wp.subtitle, wp.description_short, wp.discipline, wp.series_label,
      wp.level, wp.language, wp.session_count, wp.session_duration_hrs,
      wp.recurrence_label, wp.location_address, wp.accessibility_notes,
      wp.price_sliding_min, wp.price_member, wp.sliding_scale_note,
      wp.registration_url, wp.registration_deadline, wp.registration_status,
      wp.author_note, wp.cover_image_url, wp.promo_video_url,
      wp.seo_title, wp.seo_description, wp.og_image_url,
      wp.optional_sections
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.id = ${threadId} AND t.kind = 'workshop' AND o.slug = ${orgSlug}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) notFound();

  const allowed = await canEditOrgSite(user.id, row.org_id);
  if (!allowed) redirect("/hub");

  // Convert DB row to form default values
  const defaults: Partial<WorkshopFullInput> = {
    thread_id: row.id,
    orgSlug,
    title: row.title,
    body: row.body ?? "",
    status: (row.status as "draft" | "published") ?? "draft",
    visibility: (row.visibility as "PUBLIC" | "ORGANIZATION" | "INVITE_ONLY") ?? "PUBLIC",
    share_to_network: row.share_to_network,
    scheduled_at: row.scheduled_at
      ? new Date(row.scheduled_at).toISOString().slice(0, 16)
      : "",
    duration_minutes: row.duration_minutes ?? undefined,
    format: (row.format as "in_person" | "online" | "hybrid") ?? "online",
    location: row.location ?? "",
    meeting_url: row.meeting_url ?? "",
    is_rsvp_enabled: row.is_rsvp_enabled ?? true,
    attendee_limit: row.attendee_limit ?? undefined,
    price: row.price ? Number(row.price) : undefined,
    currency: row.currency ?? "USD",
    sessions: Array.isArray(row.sessions) ? row.sessions : [],
    nextcloud_doc_url: row.nextcloud_doc_url ?? "",
    subtitle: row.subtitle ?? "",
    description_short: row.description_short ?? "",
    discipline: row.discipline ?? "",
    series_label: row.series_label ?? "",
    level: (row.level as WorkshopFullInput["level"]) ?? undefined,
    language: row.language ?? "English",
    session_count: row.session_count ?? undefined,
    session_duration_hrs: row.session_duration_hrs ? Number(row.session_duration_hrs) : undefined,
    recurrence_label: row.recurrence_label ?? "",
    location_address: row.location_address ?? "",
    accessibility_notes: row.accessibility_notes ?? "",
    price_sliding_min: row.price_sliding_min ? Number(row.price_sliding_min) : undefined,
    price_member: row.price_member ? Number(row.price_member) : undefined,
    sliding_scale_note: row.sliding_scale_note ?? "",
    registration_url: row.registration_url ?? "",
    registration_deadline: row.registration_deadline
      ? row.registration_deadline.split("T")[0]
      : "",
    registration_status:
      (row.registration_status as WorkshopFullInput["registration_status"]) ?? "open",
    author_note: row.author_note ?? "",
    cover_image_url: row.cover_image_url ?? "",
    promo_video_url: row.promo_video_url ?? "",
    seo_title: row.seo_title ?? "",
    seo_description: row.seo_description ?? "",
    og_image_url: row.og_image_url ?? "",
    optional_sections: row.optional_sections ?? {},
  };

  return (
    <SiteShell>
      <div className="py-4">
        <div className="mb-4 flex items-center justify-between px-6">
          <Link
            href={`/hub/workshops/${orgSlug}`}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Workshops
          </Link>
          {row.status === "published" && (
            <a
              href={`/preview/workshop?slug=${encodeURIComponent(row.slug)}&org=${encodeURIComponent(orgSlug)}`}
              target="_blank"
              rel="noopener"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              title={`${orgSlug}.domain/${row.slug} — opens preview in new tab`}
            >
              Preview page ↗
            </a>
          )}
        </div>
        <WorkshopForm orgSlug={orgSlug} defaultValues={defaults} />
      </div>
    </SiteShell>
  );
}
