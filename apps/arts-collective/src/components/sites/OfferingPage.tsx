import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import {
  canEditOrgIdentity,
  countConfirmedRsvps,
  getOrgIdentity,
  getRsvpStatus,
} from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getCurrentUser } from "@/lib/session";
import { getOfferingThread, getOrgBySlug, getThreadWithWorkshopPage } from "@/lib/org";
import { renderWorkshopTemplate, readWorkshopCss } from "@/lib/cms/workshop-render";
import { isNetworkHost, networkHostWithPort, normalizeDomain } from "@/lib/domain";
import { SiteNav } from "@/components/sites/SiteNav";
import { SiteFooter } from "@/components/sites/SiteFooter";
import { RsvpPanel } from "@/components/sites/RsvpPanel";

/**
 * The subdomain's landing page: the one thing the org is promoting right now,
 * as a full page rather than a card.
 *
 * An org may publish as much as it likes; exactly one item is the offering
 * (pinned, else the most recent). A workshop renders through the same
 * template the dedicated workshop route uses — no second renderer — and every
 * other kind gets a plain detail body. RSVP appears whenever the thread has
 * it enabled, which is a generic thread column, not a per-kind feature.
 */
export async function OfferingPage({ slug }: { slug: string }) {
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const identity = await getOrgIdentity(slug);
  const h = await headers();
  const host = h.get("host") ?? networkHostWithPort();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const requestDomain = normalizeDomain(host);
  const arrivedOnOwnDomain =
    h.get("x-org-domain") !== null ||
    (identity?.primaryDomain != null && requestDomain === identity.primaryDomain) ||
    (requestDomain !== null && !isNetworkHost(requestDomain));
  const mainSiteUrl =
    identity?.primaryDomain && !arrivedOnOwnDomain
      ? `https://${identity.primaryDomain}`
      : null;

  const user = await getCurrentUser();
  const canEdit = user ? await canEditOrgIdentity(user.id, org.id) : false;

  // Intake gate, unchanged: an unconfirmed site stays visible to the people
  // who can edit it and shows a notice to everyone else.
  if (!org.subdomain_confirmed && !canEdit) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav orgName={org.name} current="offering" mainSiteUrl={mainSiteUrl} />
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-serif text-3xl">{org.name}</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            This site is being set up and hasn&apos;t opened to the public yet.
          </p>
        </div>
      </div>
    );
  }

  const offering = await getOfferingThread(org.id);

  // A workshop has a whole template of its own; reuse it rather than
  // re-describing a workshop in this page's plainer markup.
  const workshopData =
    offering?.kind === "workshop" && offering.slug
      ? await getThreadWithWorkshopPage(org.id, offering.slug)
      : null;

  const rsvpEnabled = Boolean(offering?.is_rsvp_enabled);
  const [rsvpCount, myStatus] = offering && rsvpEnabled
    ? await Promise.all([
        countConfirmedRsvps(offering.id),
        user ? getRsvpStatus(offering.id, user.id) : Promise.resolve(null),
      ])
    : [0, null];

  const rootHost = host.replace(new RegExp(`^${slug}\\.`), "");
  const loginUrl = `${proto}://${rootHost}/login`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeStyle orgId={org.id} pageKey="home" />
      <SiteNav orgName={org.name} current="offering" mainSiteUrl={mainSiteUrl} />

      {!offering ? (
        <main className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-serif text-3xl">{org.name}</h1>
          {identity?.bio && (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {identity.bio}
            </p>
          )}
          <p className="mt-8 text-sm text-muted-foreground">
            {canEdit
              ? "Nothing published yet. Post from your hub and it will appear here as your offering."
              : "Nothing on offer just now. Check back soon."}
          </p>
          {canEdit && (
            <Link
              href={`${proto}://${rootHost}/hub/organization?org=${slug}`}
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Go to your hub →
            </Link>
          )}
        </main>
      ) : workshopData ? (
        <main>
          <style
            // biome-ignore lint: workshop template CSS is trusted static content
            dangerouslySetInnerHTML={{ __html: readWorkshopCss() }}
          />
          <div
            className="eac-ws-page"
            // biome-ignore lint: workshop template HTML is rendered server-side
            dangerouslySetInnerHTML={{ __html: renderWorkshopTemplate(workshopData) }}
          />
          {rsvpEnabled && (
            <div className="mx-auto max-w-3xl px-6 pb-16">
              <RsvpPanel
                threadId={offering.id}
                signedIn={Boolean(user)}
                attending={myStatus === "yes"}
                count={rsvpCount}
                attendeeLimit={offering.attendee_limit}
                loginUrl={loginUrl}
              />
            </div>
          )}
        </main>
      ) : (
        <main className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {offering.pinned ? "Featured" : "Now"} · {offering.kind}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight">{offering.title}</h1>

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {offering.scheduled_at && (
              <div>
                <dt className="sr-only">When</dt>
                <dd>
                  {new Date(offering.scheduled_at).toLocaleString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            )}
            {offering.location && (
              <div>
                <dt className="sr-only">Where</dt>
                <dd>{offering.location}</dd>
              </div>
            )}
            {offering.price != null && Number(offering.price) > 0 && (
              <div>
                <dt className="sr-only">Price</dt>
                <dd>
                  {offering.currency ?? "CAD"} {String(offering.price)}
                </dd>
              </div>
            )}
          </dl>

          {offering.body ? (
            <div
              className="tiptap-content mt-8 leading-relaxed"
              // biome-ignore lint: thread body is sanitized on write (packages/utils sanitizePostBody)
              dangerouslySetInnerHTML={{ __html: offering.body }}
            />
          ) : offering.excerpt ? (
            <p className="mt-8 text-base leading-relaxed">{offering.excerpt}</p>
          ) : null}

          {rsvpEnabled && (
            <div className="mt-10">
              <RsvpPanel
                threadId={offering.id}
                signedIn={Boolean(user)}
                attending={myStatus === "yes"}
                count={rsvpCount}
                attendeeLimit={offering.attendee_limit}
                loginUrl={loginUrl}
              />
            </div>
          )}

          {offering.meeting_url && (
            <p className="mt-6 text-sm">
              <a
                className="underline underline-offset-4"
                href={offering.meeting_url}
                target="_blank"
                rel="noopener"
              >
                Join link →
              </a>
            </p>
          )}
        </main>
      )}

      <SiteFooter orgName={org.name} mainSiteUrl={mainSiteUrl} />
    </div>
  );
}
