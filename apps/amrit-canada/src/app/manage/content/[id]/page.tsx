import { notFound } from "next/navigation";
import { listOrgFeeds } from "@elkdonis/services";
import { ContentForm } from "@/components/manage/content-form";
import type { ContentFormDefaults } from "@/lib/cms/form-defaults";
import { getThreadById, getThreadMaterials } from "@/lib/data";
import { siteConfig } from "@/config/site";

interface EditContentPageProps {
  params: Promise<{ id: string }>;
}

const RECURRENCE_OPTIONS = ["NONE", "DAILY", "WEEKLY", "MONTHLY"] as const;

/** `datetime-local` and `date` inputs need local wall-clock strings, not ISO/UTC. */
function toLocalInput(date: Date | null, withTime: boolean): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  return withTime ? `${day}T${get("hour")}:${get("minute")}` : day;
}

export default async function EditContentPage({ params }: EditContentPageProps) {
  const { id } = await params;

  const [thread, feeds] = await Promise.all([
    getThreadById(id),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
  ]);

  if (!thread) notFound();

  const materials = await getThreadMaterials(thread.id);

  // `event` is an inferred kind elsewhere in the monorepo and isn't offered in
  // this form; anything dated edits as a meeting.
  const kind: "post" | "meeting" = thread.kind === "post" ? "post" : "meeting";

  const defaults: ContentFormDefaults = {
    id: thread.id,
    kind,
    feedSlug: thread.feedSlug ?? feeds[0]?.slug ?? "",
    title: thread.title,
    excerpt: thread.excerpt ?? "",
    body: thread.description ?? "",
    coverImageUrl: thread.coverImageUrl ?? "",
    // Already provisioned ones are shown as links, not re-offered as toggles.
    materials: materials.map((m) => ({
      id: m.id,
      url: m.url,
      filename: m.filename,
      mimeType: m.mimeType ?? "",
      size: m.size ?? 0,
    })),
    createDocument: false,
    createTalkRoom: false,
    documentUrl: thread.documentUrl ?? "",
    talkToken: thread.talkToken ?? "",
    status: thread.status === "published" ? "published" : "draft",
    visibility:
      thread.visibility === "ORGANIZATION" || thread.visibility === "INVITE_ONLY"
        ? thread.visibility
        : "PUBLIC",
    scheduledAt: toLocalInput(thread.scheduledAt, true),
    durationMinutes: thread.durationMinutes?.toString() ?? "",
    location: thread.location ?? "",
    isOnline: thread.isOnline,
    meetingUrl: thread.meetingUrl ?? "",
    videoLink: thread.videoLink ?? "",
    // CUSTOM exists in the schema but this form doesn't offer it; fall back to
    // NONE rather than sending an out-of-enum value that fails validation.
    recurrencePattern: RECURRENCE_OPTIONS.includes(
      thread.recurrencePattern as (typeof RECURRENCE_OPTIONS)[number]
    )
      ? (thread.recurrencePattern as ContentFormDefaults["recurrencePattern"])
      : "NONE",
    recurrenceUntil: toLocalInput(thread.recurrenceUntil, false),
    isRsvpEnabled: thread.isRsvpEnabled,
    rsvpDeadline: toLocalInput(thread.rsvpDeadline, true),
    attendeeLimit: thread.attendeeLimit?.toString() ?? "",
    minAttendees: thread.minAttendees?.toString() ?? "",
    notifyOnMinAttendees: thread.notifyOnMinAttendees,
  };

  return (
    <>
      <h2 className="font-serif text-2xl">Edit</h2>
      <div className="mt-6 max-w-3xl">
        <ContentForm
          feeds={feeds.map((f) => ({ slug: f.slug, name: f.name, presenter: f.presenter }))}
          defaults={defaults}
          threadId={thread.id}
        />
      </div>
    </>
  );
}
