import Link from "next/link";
import {
  getStandingMeeting,
  listOrgEventsInRange,
  getProfile,
  getProfileBySlug,
} from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { GalleryFace, StandingMeetingFace } from "@elkdonis/cms-ui/hub";
// The slim, full-width month from the hub's page layout — not CalendarFace,
// which is a tile sized to sit in a grid of tiles.
import { HubCalendar } from "@elkdonis/cms-ui/hubsite";
import { ForumFace } from "@elkdonis/cms-ui/surface";
import { WritingShelf } from "@elkdonis/cms-ui/writing";
import { ThreadCard } from "@/components/thread-card";
import { ProfileCard } from "@/components/profile-card";
import { SignupCard } from "@/components/signup-card";
import {
  getSiteSections,
  getThreadsForFeed,
  getGuideBySlug,
  getThreadsByAuthor,
  listMyRsvps,
} from "@/lib/data";
import { getForumSnapshot } from "@/lib/forum";
import { getImageSpaces, listGalleryImages, listWritingShelf, mediaSrc } from "@/lib/landing";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

const TIME_ZONE = "America/Toronto";

/**
 * The landing page, in the order the owner asked for (revised 2026-09-19):
 *
 *   banner                a hero photograph, with the hero copy over it
 *   next gathering        PAGE WIDE, on its own
 *   profile | calendar    his card (photo across the top) beside the month
 *   materials | sign up   suggested materials beside the sign-up card
 *   about                 full width
 *   forum                 full width
 *   writing, gallery      full width, and only when they have something in them
 *
 * The writing shelf and the gallery were in the first version of this page and
 * are NOT in the revised ordering — they are kept here, last, because they
 * self-hide while empty and were therefore invisible in the screenshot the
 * revision was written from. Say the word and they go.
 *
 * Note on the faces: StandingMeetingFace, CalendarFace, GalleryFace and
 * ForumFace all call useSurface(), which throws outside a SurfaceProvider. The
 * provider is mounted in the root layout (HubSurfaces), which is what makes
 * them legal on a public page at all.
 */
export default async function HomePage() {
  const now = new Date();
  const calFrom = startOfMonth(now);

  const [
    sections,
    spaces,
    standing,
    calEvents,
    writing,
    materials,
    gallery,
    guide,
    forum,
    viewer,
  ] = await Promise.all([
    getSiteSections(),
    getImageSpaces(),
    getStandingMeeting(siteConfig.orgId).catch(() => null),
    listOrgEventsInRange(siteConfig.orgId, calFrom, addMonths(calFrom, 1)).catch(() => []),
    listWritingShelf(6),
    getThreadsForFeed("materials", 4).catch(() => []),
    listGalleryImages(12),
    getGuideBySlug(siteConfig.guideSlug).catch(() => null),
    getForumSnapshot().catch(() => null),
    getViewer().catch(() => null),
  ]);

  // Two reads that depend on results above, so they cannot join the batch.
  const [hisPosts, me] = await Promise.all([
    // The feed under "Suggested materials": what he has published here. Keyed
    // on the AUTHOR, not on a feed, so a piece filed anywhere on the site
    // still shows up as his.
    guide ? getThreadsByAuthor(guide.userId, 5).catch(() => []) : Promise.resolve([]),
    // The signed-in panel. A signed-out visitor gets the sign-up form instead,
    // so none of this is fetched for them.
    viewer
      ? Promise.all([
          getProfile(viewer.userId).catch(() => null),
          listMyRsvps(viewer.userId, 4).catch(() => []),
        ]).then(([profile, rsvps]) => ({ profile, rsvps }))
      : Promise.resolve(null),
  ]);

  const canEdit = Boolean(viewer?.canEdit);
  const hero = sections.hero ?? {};
  const heroSrc = mediaSrc(spaces.hero?.path);

  // The network profile is the source for the links row: someone who wrote
  // their links on ArtDirect or any other EAC surface arrives here complete.
  const person = guide ? await getProfileBySlug(guide.slug).catch(() => null) : null;

  // His own accounts, then the collective. Elkdonis is not one of his
  // profiles, so it is marked `emphasis` (and carries no rel="me") and is
  // de-duplicated in case he has also listed it himself.
  const COLLECTIVE_HOST = (() => {
    try {
      return new URL(siteConfig.collectiveUrl).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();
  const profileLinks = [
    ...(person?.socialLinks ?? [])
      .filter((l) => {
        if (!l.url) return false;
        if (!COLLECTIVE_HOST) return true;
        try {
          return new URL(l.url).hostname.replace(/^www\./, "") !== COLLECTIVE_HOST;
        } catch {
          return true;
        }
      })
      .map((l) => {
        // A row entered as a bare URL has no label; the host is the honest
        // fallback — it says where the link goes without inventing a name.
        let label = l.label?.trim() ?? "";
        if (!label) {
          try {
            label = new URL(l.url).hostname.replace(/^www\./, "");
          } catch {
            label = l.url;
          }
        }
        return { label, url: l.url };
      }),
    { label: "Elkdonis Arts", url: siteConfig.collectiveUrl, emphasis: true },
  ];

  const materialsCopy = sections.materials ?? {};
  const aboutCopy = sections.about ?? {};

  return (
    <>
      {/* ── banner ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-border">
        {heroSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroSrc}
              alt={spaces.hero?.alt ?? ""}
              className="absolute inset-0 -z-10 h-full w-full object-cover"
              fetchPriority="high"
            />
            {/*
              A scrim, not a tint. The hero copy is light, and a photograph is
              arbitrary — it can be a bright sky or a dark riverbed — so the
              text cannot be guaranteed readable against the image itself. The
              slate wash below it is what the contrast ratio is measured on
              (#f4f1ea on #2b3033 at 80% = 11.8:1).
            */}
            <div className="absolute inset-0 -z-10 bg-[#2b3033]/80" aria-hidden />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-header-footer" aria-hidden />
        )}

        <div className="mx-auto max-w-5xl px-5 py-20 text-center sm:py-28">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-[#f4f1ea] sm:text-5xl">
            {hero.title ?? siteConfig.orgName}
          </h1>
          {(hero.subtitle ?? siteConfig.tagline) && (
            <p className="mt-3 text-lg italic text-[#d9c08a]">
              {hero.subtitle ?? siteConfig.tagline}
            </p>
          )}
          {hero.body && (
            <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-[#f4f1ea]/85">{hero.body}</p>
          )}
          {hero.cta_label && hero.cta_href && (
            <Link
              href={hero.cta_href}
              className="mt-8 inline-block border border-[#d9c08a]/60 bg-[#d9c08a]/15 px-5 py-2.5 text-sm font-medium text-[#d9c08a] transition-colors hover:bg-[#d9c08a]/25"
            >
              {hero.cta_label}
            </Link>
          )}
        </div>
      </section>

      {/* ── next gathering, page wide ────────────────────────────────────── */}
      {/*
        No "Next gathering" heading: the card says "Weekly meeting" in its own
        kicker and names the thing underneath, so a heading above it was the
        same sentence twice.

        `landing-standing` (globals.css) is what makes it taller and takes the
        air out from around it — the face is shared, so the height belongs to
        this page rather than to the component every other site draws.
      */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="landing-standing">
          {/* No grid wrapper on purpose: the face is a block element, so on
              its own it fills the measure. Wrapping it in SurfaceCardGrid
              would put it in a 300px-minimum auto-fill track. */}
          <StandingMeetingFace standing={standing} canEdit={canEdit} timeZone={TIME_ZONE} />
        </div>
      </section>

      {/* ── profile | calendar ───────────────────────────────────────────── */}
      <section className="border-t border-border/70 bg-card/40 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-2">
          <div>
            {guide ? (
              <>
                <ProfileCard
                  name={guide.displayName}
                  title={guide.roleTitle}
                  imageUrl={guide.photoUrl}
                  bio={guide.bio}
                  href={`/about/${guide.slug}`}
                  links={profileLinks}
                />
              </>
            ) : (
              <div className="card-natural p-6">
                <h2 className="font-serif text-xl font-semibold">{siteConfig.orgName}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  The profile card appears here once a public profile exists for this site.
                </p>
              </div>
            )}
          </div>

          <div>
            {/* No heading here: HubCalendar draws its own "Calendar" title and
                its "Open full calendar" link, so an <h2> above it printed the
                word twice. */}
            <HubCalendar initialEvents={calEvents} />
          </div>
        </div>
      </section>

      {/* ── suggested materials + his posts | sign up or your membership ── */}
      <section className="border-t border-border/70 py-14">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2">
          {/* LEFT: materials on top, his writing under it. */}
          <div className="space-y-10">
            <div>
              <h2 className="font-serif text-2xl">
                {materialsCopy.title ?? "Suggested materials"}
              </h2>
              {materialsCopy.body && (
                <p className="mt-2 text-sm text-muted-foreground">{materialsCopy.body}</p>
              )}
              <hr className="saffron-divider max-w-[12rem]" />

              {materials.length > 0 ? (
                <div className="space-y-4">
                  {materials.map((thread) => (
                    <ThreadCard key={thread.id} thread={thread} feedName="Materials" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing here yet.{" "}
                  {canEdit ? (
                    <Link href="/manage" className="underline underline-offset-2">
                      Add something to the Materials section.
                    </Link>
                  ) : (
                    "Check back soon."
                  )}
                </p>
              )}
            </div>

            {/*
              What he has posted, as a short list rather than cards — this sits
              under a column that already has cards in it, and a second stack
              of them would read as one undifferentiated pile.

              Keyed on the author, so anything of his shows here whichever
              section it was filed under. A thread with no section has no page
              on this site (see lib/gather.ts), so those are not linked.
            */}
            <div>
              <h2 className="font-serif text-2xl">
                From {siteConfig.guideShortName}
              </h2>
              <hr className="saffron-divider max-w-[12rem]" />

              {hisPosts.length > 0 ? (
                <ul className="divide-y divide-border/70 border-y border-border/70">
                  {hisPosts.map((t) => {
                    const href = t.feedSlug ? `/${t.feedSlug}/${t.slug}` : null;
                    const when = t.publishedAt ?? t.scheduledAt ?? t.createdAt;
                    const body = (
                      <>
                        <span className="block font-medium text-foreground">{t.title}</span>
                        {t.excerpt && (
                          <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">
                            {t.excerpt}
                          </span>
                        )}
                        {when && (
                          <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-muted-foreground">
                            {when.toLocaleDateString("en-CA", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              timeZone: TIME_ZONE,
                            })}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <li key={t.id} className="py-3">
                        {href ? (
                          <Link href={href} className="block hover:text-[hsl(var(--primary))]">
                            {body}
                          </Link>
                        ) : (
                          <div className="block">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing published yet.</p>
              )}
            </div>
          </div>

          {/* RIGHT: sign up, or — once signed in — you and your standing here. */}
          <div>
            {me ? (
              <div className="space-y-6">
                {/* Who you are. */}
                <div className="card-natural p-6">
                  <div className="flex items-center gap-4">
                    {me.profile?.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={me.profile.avatarUrl}
                        alt=""
                        className="h-16 w-16 shrink-0 object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center bg-muted text-xl text-muted-foreground"
                        aria-hidden
                      >
                        {(me.profile?.displayName ?? viewer!.email).trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate font-serif text-xl font-semibold">
                        {me.profile?.displayName?.trim() || viewer!.email}
                      </h2>
                      {me.profile?.headline && (
                        <p className="truncate text-sm text-muted-foreground">
                          {me.profile.headline}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={viewer!.isMember ? "/hub" : "/center"}
                      className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/25"
                    >
                      {viewer!.isMember ? "Go to the hub" : "Go to your center"}
                    </Link>
                    <Link
                      href="/account"
                      className="border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-[hsl(var(--primary))]"
                    >
                      Account
                    </Link>
                  </div>
                </div>

                {/* Where you stand with this org, and what you have said yes to. */}
                <div className="card-natural p-6">
                  <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Your membership
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed">
                    {/*
                      The role words are the visitor's, not the schema's: a
                      `viewer` row means someone who follows the site, and
                      calling them a "viewer" to their face explains nothing.
                      See CENTER_PAGE_BRIEF decision 2 for why a signup is a
                      follower rather than a member.
                    */}
                    {viewer!.role === "owner" || viewer!.role === "guide" ? (
                      <>
                        You help run <strong>{siteConfig.orgName}</strong>.
                      </>
                    ) : viewer!.role === "member" ? (
                      <>
                        You are a member of <strong>{siteConfig.orgName}</strong>.
                      </>
                    ) : viewer!.role ? (
                      <>
                        You follow <strong>{siteConfig.orgName}</strong>. Members can post and
                        join the hub — ask if you would like to be one.
                      </>
                    ) : (
                      <>
                        You are signed in, but not connected to{" "}
                        <strong>{siteConfig.orgName}</strong> yet.
                      </>
                    )}
                  </p>

                  <h4 className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    You&rsquo;re coming to
                  </h4>
                  {me.rsvps.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {me.rsvps.map((r) => (
                        <li key={r.id} className="text-sm">
                          <Link
                            href={r.section ? `/${r.section}/${r.slug}` : "/gatherings"}
                            className="font-medium hover:text-[hsl(var(--primary))]"
                          >
                            {r.title}
                          </Link>
                          {r.scheduledAt && (
                            <span className="block text-xs text-muted-foreground">
                              {r.scheduledAt.toLocaleString("en-CA", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                timeZone: TIME_ZONE,
                              })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Nothing yet — RSVP from the calendar and it will appear here.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <SignupCard />
            )}
          </div>
        </div>
      </section>

      {/* ── about ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/70 bg-card/40 py-14">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="font-serif text-2xl">{aboutCopy.title ?? "About"}</h2>
          <hr className="saffron-divider max-w-[12rem]" />
          {aboutCopy.body ? (
            <p className="leading-relaxed">{aboutCopy.body}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {canEdit ? (
                <>
                  Nothing written yet —{" "}
                  <Link href="/manage/pages" className="underline underline-offset-2">
                    add it from Manage → Pages.
                  </Link>
                </>
              ) : (
                "More about this place soon."
              )}
            </p>
          )}
          <div className="mt-6">
            <Link
              href="/about"
              className="text-sm font-medium text-[hsl(var(--rust))] underline underline-offset-4"
            >
              Who teaches here →
            </Link>
          </div>
        </div>
      </section>

      {/* ── forum ────────────────────────────────────────────────────────── */}
      <section className="border-t border-border/70 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="mb-4 font-serif text-2xl">Forum</h2>
          <ForumFace forum={forum} href="/forum" />
        </div>
      </section>

      {/* ── writing ──────────────────────────────────────────────────────── */}
      {writing.length > 0 && (
        <section className="border-t border-border/70 bg-card/40 py-14">
          <div className="mx-auto max-w-6xl px-5">
            <WritingShelf
              items={writing}
              basePath="/writing"
              heading="Writing"
              kicker={null}
              intro={null}
            />
            <div className="mt-6">
              <Link
                href="/writing"
                className="text-sm font-medium text-[hsl(var(--rust))] underline underline-offset-4"
              >
                All writing →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── gallery ──────────────────────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section className="border-t border-border/70 py-14">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="mb-4 font-serif text-2xl">Gallery</h2>
            <GalleryFace images={gallery} title="Gallery" />
          </div>
        </section>
      )}
    </>
  );
}
