import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadPublishedUserPage } from "@elkdonis/page-builder/server";
import { canEditProfile, getFeaturedOffering, getProfileBySlug, type Offering, type Profile } from "@elkdonis/services";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getCurrentUser } from "@/lib/session";
import { isOadSteward } from "@/lib/oad";
import { PERSON_PAGE_ORG, documentTitle, knownTypesFor, liveKey, loadPersonContext } from "@/lib/person-pages";
import { PersonDoc, resolvePersonDoc } from "@/components/design/PersonDoc";

// ============================================================================
// /<slug>/featured — a person's featured page: one offering or several,
// brought forward (a Puck document, user_pages `oad`/`featured`, published
// by the person from /<slug>/featured/design).
//
// Visitors get a 404 until one is published, and whenever the person is
// unlisted (users.directory_listed, the root page's rule). The person (or an
// admin) sees a prompt to design one instead.
//
// 2026-09-27: a person's featured OFFERING (users.featured_thread_id,
// migration 171; chosen in "Manage your space") takes this address when set:
// one offering, one page (docs/open/ARTIST_FUNNEL_BRIEF_2026-09-27.md). The
// designed page below remains the fallback.
// ============================================================================

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function hiddenFrom(identity: Profile, viewerId: string | null | undefined, steward: boolean): boolean {
  if (identity.directoryListed) return false;
  if (viewerId && viewerId === identity.userId) return false;
  return !steward;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const identity = await getProfileBySlug(slug);
  if (!identity || !identity.directoryListed) return {};
  const offering = await getFeaturedOffering(identity.userId).catch(() => null);
  if (offering) return { title: `${offering.title} — ${identity.displayName} — ArtDirect` };
  const doc = await loadPublishedUserPage(identity.userId, PERSON_PAGE_ORG, liveKey("featured"));
  if (!doc) return { robots: { index: false } };
  const title = documentTitle(doc.data);
  return { title: `${title || "Featured"} — ${identity.displayName} — ArtDirect` };
}

export default async function FeaturedPage({ params }: Props) {
  const { slug } = await params;
  const [identity, user] = await Promise.all([getProfileBySlug(slug), getCurrentUser()]);
  if (!identity) notFound();
  const viewerId = user?.id ?? null;
  const steward = user ? await isOadSteward(user.id) : false;
  if (hiddenFrom(identity, viewerId, steward)) notFound();
  const canEdit = Boolean(viewerId && (await canEditProfile(viewerId, identity.userId)));

  const offering = await getFeaturedOffering(identity.userId).catch(() => null);
  if (offering) {
    const home = identity.slug ?? slug;
    return (
      <>
        <ThemeStyle userId={identity.userId} precedence="user" />
        <div className="eac-person-page eac-person-page--frame oad-person" data-person-page="" data-person-doc="featured">
          <nav className="eac-person-intro oad-person-bar" aria-label="Page">
            <a className="eac-person-back" href={`/${home}`}>
              ← {identity.displayName}
            </a>
          </nav>
          <FeaturedOffering offering={offering} home={home} />
        </div>
      </>
    );
  }

  const doc = await loadPublishedUserPage(identity.userId, PERSON_PAGE_ORG, liveKey("featured"), knownTypesFor("featured"));
  if (!doc && !canEdit) notFound();

  const context = doc ? await loadPersonContext(slug, viewerId) : null;
  const resolved = doc && context ? await resolvePersonDoc("featured", doc.data, context) : null;
  if (doc && !resolved && !canEdit) notFound();

  const key = identity.slug ?? slug;

  return (
    <>
      <ThemeStyle userId={identity.userId} precedence="user" />
      <div className="eac-person-page eac-person-page--frame oad-person" data-person-page="" data-person-doc="featured">
        <nav className="eac-person-intro oad-person-bar" aria-label="Page">
          <a className="eac-person-back" href={`/${key}`}>
            ← {identity.displayName}
          </a>
          {canEdit ? (
            <a className="oad-person-bar-link" href={`/${key}/featured/design`}>
              {doc ? "Edit this page" : "Design a featured page"}
            </a>
          ) : null}
        </nav>
        {resolved && context ? (
          <PersonDoc kind="featured" data={resolved} context={context} />
        ) : (
          <div className="eac-person-slot">
            <section className="eac-person-section eac-person-panel">
              <p className="eac-person-empty">
                {doc
                  ? "This page could not be shown just now."
                  : "A featured page brings one of your works, workshops, events or pieces of writing to the front, with a picture and one button. Nobody else sees this address until you publish one."}
              </p>
              <p>
                <a href={`/${key}/featured/design`}>{doc ? "Open the designer →" : "Design your featured page →"}</a>
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

const KIND_WORD: Record<string, string> = { meeting: "Meeting", service: "Service" };

function whenText(o: Offering): string | null {
  if (!o.scheduledAt) return null;
  const tz = o.timeZone || "America/Toronto";
  const when = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  }).format(new Date(o.scheduledAt));
  return o.durationMinutes ? `${when} · ${o.durationMinutes} min` : when;
}

function priceText(o: Offering): string | null {
  if (o.price == null) return null;
  if (o.price === 0) return "Free";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: o.currency || "CAD" }).format(o.price);
}

/**
 * The featured offering as its page. The body was sanitised on write
 * (saveOffering → sanitizePostBody). A service is booked and paid on its own
 * page, /<slug>/services/<service> (2026-09-27); RSVP for a personal meeting
 * is not wired yet.
 */
function FeaturedOffering({ offering: o, home }: { offering: Offering; home: string }) {
  const facts = [
    KIND_WORD[o.kind] ?? o.kind,
    whenText(o),
    o.kind === "meeting" ? (o.location || (o.isOnline ? "Online" : null)) : null,
    priceText(o),
  ].filter(Boolean) as string[];
  return (
    <div className="eac-person-slot">
      <article className="eac-person-section eac-person-panel">
        {o.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.coverImageUrl} alt="" style={{ width: "100%", height: "auto", borderRadius: "0.375rem" }} />
        ) : null}
        <p className="eac-person-meta">{facts.join(" · ")}</p>
        <h1 className="eac-person-name">{o.title}</h1>
        {o.excerpt ? <p className="eac-person-excerpt">{o.excerpt}</p> : null}
        {o.body ? <div className="eac-person-bio" dangerouslySetInnerHTML={{ __html: o.body }} /> : null}
        {o.kind === "service" ? (
          <p>
            <a href={`/${home}/services/${o.slug}`}>Book →</a>
          </p>
        ) : null}
        {o.kind === "meeting" && o.meetingUrl ? (
          <p>
            <a href={o.meetingUrl} rel="noopener noreferrer">
              Join online →
            </a>
          </p>
        ) : null}
      </article>
    </div>
  );
}
