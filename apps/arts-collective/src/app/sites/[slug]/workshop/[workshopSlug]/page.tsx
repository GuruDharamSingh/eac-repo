import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@elkdonis/db";
import {
  canEditOrgIdentity,
  getOrgIdentity,
  getWorkshopOffering,
  isEnrolledInWorkshop,
} from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";
import { isNetworkHost, networkHostWithPort, normalizeDomain } from "@/lib/domain";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";
import {
  WorkshopSessions,
  type MaterialFile,
} from "@/components/sites/workshop/WorkshopSessions";

export const dynamic = "force-dynamic";

/**
 * The workshop workspace — where the workshop actually happens, as opposed to
 * /offering and the template page, which sell it.
 *
 * Fully gated: someone who has not joined is sent to the promotional page
 * rather than shown a teaser. The workshop's own people get the sessions, the
 * materials and the room.
 *
 * Presentation follows inner-gathering's workshop page (banner with focal
 * point, author-set background colour, hero media slot, session tabs) so a
 * participant meets the same workshop in both apps. The data layer is shared
 * outright — `getWorkshopOffering` already returns every media slot and the
 * sessions with their per-session images, video and resources.
 */
export default async function WorkshopWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; workshopSlug: string }>;
}) {
  const { slug, workshopSlug } = await params;

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const workshop = await getWorkshopOffering(org.id, workshopSlug);
  if (!workshop) notFound();

  const user = await getCurrentUser();

  // The gate. Anonymous visitors and non-participants get the promo page —
  // which is a real page about this workshop, not a dead end.
  const promoUrl = `/${workshopSlug}`;
  if (!user) redirect(promoUrl);
  const allowed =
    workshop.authorId === user.id ||
    (await isEnrolledInWorkshop(workshop.id, user.id)) ||
    (await canEditOrgIdentity(user.id, org.id));
  if (!allowed) redirect(promoUrl);

  const identity = await getOrgIdentity(slug);
  const h = await headers();
  const host = h.get("host") ?? networkHostWithPort();
  const requestDomain = normalizeDomain(host);
  const arrivedOnOwnDomain =
    h.get("x-org-domain") !== null ||
    (identity?.primaryDomain != null && requestDomain === identity.primaryDomain) ||
    (requestDomain !== null && !isNetworkHost(requestDomain));
  const mainSiteUrl =
    identity?.primaryDomain && !arrivedOnOwnDomain
      ? `https://${identity.primaryDomain}`
      : null;

  // Materials are listed with the service account, then downloaded through
  // our own gated route — a participant never needs a Nextcloud account to
  // read them, which matters because most never will have one.
  let materials: MaterialFile[] = [];
  try {
    const { getAdminClient, listWorkshopMaterials } = await import("@elkdonis/nextcloud");
    const files = await listWorkshopMaterials(getAdminClient(), org.id, workshop.id);
    materials = files.map((f) => ({
      filename: f.filename,
      size: f.size ?? 0,
      mimeType: f.mimeType ?? "",
    }));
  } catch (err) {
    // A missing folder is normal for a workshop nobody has uploaded to yet.
    console.warn(`[arts-collective] materials unavailable for ${workshop.id}:`, err);
  }

  const [guide] = workshop.authorId
    ? await db<Array<{ display_name: string | null; avatar_url: string | null }>>`
        SELECT display_name, avatar_url FROM users WHERE id = ${workshop.authorId} LIMIT 1
      `
    : [];

  const now = Date.now();
  const scheduled = workshop.sessions
    .filter((s) => s.scheduledAt)
    .sort(
      (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
    );
  const next = scheduled.find((s) => new Date(s.scheduledAt!).getTime() >= now);
  const past = scheduled.filter((s) => new Date(s.scheduledAt!).getTime() < now).length;

  const bannerUrl = workshop.bannerImageUrl ?? workshop.coverImageUrl;

  return (
    <div
      className="min-h-screen text-foreground"
      style={{ background: workshop.backgroundColor ?? undefined }}
    >
      <SiteNav orgName={org.name} current="offering" mainSiteUrl={mainSiteUrl} />

      {bannerUrl && (
        <div className="relative h-[280px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `center ${workshop.bannerFocalY}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-4xl px-6 pb-6 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.22em] opacity-80">
              {workshop.seriesLabel ?? workshop.discipline ?? "Workshop"}
            </p>
            <h1 className="mt-1 font-serif text-4xl leading-tight">{workshop.title}</h1>
            {workshop.subtitle && (
              <p className="mt-1 text-sm opacity-90">{workshop.subtitle}</p>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6 py-10">
        {!bannerUrl && (
          <header className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {workshop.seriesLabel ?? workshop.discipline ?? "Workshop"}
            </p>
            <h1 className="mt-1 font-serif text-4xl leading-tight">{workshop.title}</h1>
            {workshop.subtitle && (
              <p className="mt-2 text-base text-muted-foreground">{workshop.subtitle}</p>
            )}
          </header>
        )}

        {guide?.display_name && (
          <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            {guide.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={guide.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full border border-border object-cover"
              />
            )}
            Guided by {guide.display_name}
          </p>
        )}

        {/* What a participant arriving needs first: when we next meet. */}
        <section className="mb-8 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {next ? "Next session" : scheduled.length > 0 ? "All sessions complete" : "Not yet scheduled"}
              </p>
              <p className="mt-1 font-serif text-xl">
                {next
                  ? `${next.sessionNumber}. ${next.title || "Untitled session"}`
                  : workshop.recurrenceLabel ?? "—"}
              </p>
              {next?.scheduledAt && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {new Date(next.scheduledAt).toLocaleString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            {workshop.nextcloudTalkToken && (
              <a
                href={`/api/talk/join?token=${encodeURIComponent(workshop.nextcloudTalkToken)}`}
                target="_blank"
                rel="noopener"
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Join the room →
              </a>
            )}
          </div>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {workshop.sessions.length > 0 && (
              <dd>
                {past} of {workshop.sessions.length} sessions done
              </dd>
            )}
            {workshop.level && <dd>{workshop.level.replace(/_/g, " ")}</dd>}
            {workshop.language && <dd>{workshop.language}</dd>}
            {workshop.sessionDurationHrs && <dd>{workshop.sessionDurationHrs} hrs each</dd>}
            {(workshop.locationAddress || workshop.location) && (
              <dd>{workshop.locationAddress ?? workshop.location}</dd>
            )}
          </dl>
        </section>

        {workshop.heroMediaUrl && (
          <section className="relative mb-8 overflow-hidden rounded-lg border border-border">
            {workshop.heroMediaType === "video" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video controls src={workshop.heroMediaUrl} className="w-full" />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={workshop.heroMediaUrl} alt="" className="w-full object-cover" />
                {workshop.heroText && (
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-6">
                    <p className="font-serif text-xl text-white">{workshop.heroText}</p>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <WorkshopSessions
          sessions={workshop.sessions}
          description={workshop.body ?? workshop.descriptionShort}
          accessibilityNotes={workshop.accessibilityNotes}
          authorNote={workshop.authorNote}
          talkToken={workshop.nextcloudTalkToken}
          materials={materials}
          threadId={workshop.id}
        />
      </main>

      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
