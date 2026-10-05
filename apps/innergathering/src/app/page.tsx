import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";
import { GallerySlider } from "@/components/landing/GallerySlider";
import { JoinSection } from "@/components/landing/JoinSection";
import { OfferingsBand, type OfferingItem } from "@/components/landing/OfferingsBand";
import { getLandingConfig, getWorkQuestion, getWorkQuestionThread, mediaSrc } from "@/lib/landing";
import { renderForumRoute } from "@elkdonis/forum-ui";
import { getForumConnectors } from "@/lib/forum";
import { GuestAnswer } from "@/components/landing/GuestAnswer";
import {
  getAttendanceCount,
  getCycleStatus,
  getBoard,
  getSiteSections,
  getThreadRsvpForUser,
  getThreadsForFeed,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import type { Thread } from "@/lib/types";

/**
 * The landing page, carried over from inner-gathering's (marketing) route
 * group: the same sections in the same order, with the same words and the
 * same three faces. What changed is underneath — every read is server-side
 * so the page arrives with its words on it, the board is drawn from members'
 * own profiles instead of a hard-coded list, and the sign-up is the
 * Mantine-free one.
 */
export default async function LandingPage() {
  const [config, workQuestion, offeringThreads, board, viewer, sections] = await Promise.all([
    getLandingConfig(),
    getWorkQuestion(),
    getThreadsForFeed("offerings"),
    getBoard(),
    getViewer().catch(() => null),
    getSiteSections(),
  ]);
  const [offerings, forumThread] = await Promise.all([
    loadOfferings(offeringThreads, viewer?.userId ?? null),
    workQuestion ? getWorkQuestionThread(workQuestion.question.question) : Promise.resolve(null),
  ]);
  // The forum itself, opened on the work question's thread: the same render
  // /forum/t/<id>/<slug> produces, so every link and form in it leads into
  // the forum proper.
  const forumEmbed = forumThread
    ? await renderForumRoute({
        connectors: await getForumConnectors(),
        segments: ["t", forumThread.id, forumThread.slug],
        searchParams: {},
      }).catch((err) => {
        console.error("[innergathering] landing forum embed:", err);
        return null;
      })
    : null;

  // The wording on the header was hard-coded, which meant /manage/pages'
  // "Home page header" card wrote rows nothing ever read. These are the words
  // that were on the page; they are now the fallbacks behind the editable
  // ones, so an owner can change the front of the site without a deploy.
  const heroCopy = sections.hero ?? {};
  const hero = {
    eyebrow: heroCopy.eyebrow?.trim() || "Toronto · Los Angeles · Paris",
    title: heroCopy.title?.trim() || "Elkdonis Arts Collective",
    subtitle: heroCopy.subtitle?.trim() || "Non-Profit Organization",
    tagline:
      heroCopy.tagline?.trim() ||
      "The collective is committed to using art as the means of inquiry.",
    ctaLabel: heroCopy.cta_label?.trim() || "See what's on",
    ctaHref: heroCopy.cta_href?.trim() || "/offerings",
  };
  const heroImage = mediaSrc(
    config.imageSpaces.hero?.path,
    mediaSrc(config.imageSpaces.intro_banner?.path)
  );

  const fundraising = {
    goal: config.fundraising.goal ?? 25000,
    raised: config.fundraising.raised ?? 0,
    status: config.fundraising.status ?? "We are just getting started. Every contribution goes directly to our artists and programs.",
    currency: config.fundraising.currency ?? "CAD",
  };
  const pct = fundraising.goal > 0 ? Math.min(100, Math.round((fundraising.raised / fundraising.goal) * 100)) : 0;
  const gallery = (config.imageSpaces.gallery?.images ?? [])
    .map((p) => (typeof p === "string" ? mediaSrc(p) : null))
    .filter((s): s is string => Boolean(s));

  return (
    <div className="marketing-root">
      {/* ── Hero ──
          A split header rather than a centred wordmark on empty ground: the
          words and the two things to do on the left, one photograph on the
          right. Everything here is editable copy over the words that used to
          be hard-coded, and the image is an admin-set space that falls back
          to the intro banner, so the section is never half-empty. */}
      <header className={`ig-hero${heroImage ? "" : " ig-hero--plain"}`}>
        <div className="ig-hero-inner">
          <div className="ig-hero-copy">
            <p className="ig-hero-eyebrow">{hero.eyebrow}</p>
            <h1 className="ig-hero-title">{hero.title}</h1>
            <p className="ig-hero-subtitle">{hero.subtitle}</p>
            <hr className="gold-rule ig-hero-rule" style={{ "--rule-width": "72px" } as React.CSSProperties} />
            <p className="ig-hero-tagline">{hero.tagline}</p>
            <div className="ig-hero-actions">
              <Link href={hero.ctaHref} className="cta-btn ig-hero-cta">{hero.ctaLabel}</Link>
              <Link href={viewer ? "/hub" : "/login"} className="ig-hero-cta-quiet">
                {viewer ? "Open the portal" : "Sign in"}
              </Link>
            </div>
          </div>

          {heroImage && (
            <div className="ig-hero-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {/* The largest-contentful element on the site's front page, so
                  it is served as a sized variant rather than the master —
                  the originals here are phone photographs of several MB. */}
              <img
                className="ig-hero-img"
                src={variant(heroImage, 1024)}
                srcSet={`${variant(heroImage, 512)} 512w, ${variant(heroImage, 1024)} 1024w`}
                sizes="(max-width: 900px) 92vw, 460px"
                alt={config.imageSpaces.hero?.alt ?? config.imageSpaces.intro_banner?.alt ?? ""}
                fetchPriority="high"
              />
            </div>
          )}
        </div>
        <div className="ig-hero-cue" aria-hidden="true"><span /></div>
      </header>

      {/* ── Current offerings — the public ways in, with their RSVP ── */}
      <OfferingsBand
        items={offerings}
        signedIn={Boolean(viewer)}
        nextcloudUrl={process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? null}
      />

      {/* ── Login / signup banner — shown to signed-out visitors only ── */}
      {!viewer && (
        <section className="site-login-banner">
          <div className="site-login-banner-inner">
            <p className="site-login-banner-copy">
              Already part of the collective? <strong>Sign in</strong> to join the conversation, or{" "}
              <strong>create an account</strong> to get started.
            </p>
            <div className="site-login-banner-actions">
              <Link href="/login" className="site-login-banner-btn site-login-banner-btn--filled">Create account</Link>
              <Link href="/login" className="site-login-banner-btn site-login-banner-btn--ghost">Sign in</Link>
            </div>
          </div>
        </section>
      )}

      {/* ── About / Mutual Aid ── */}
      <section id="about" className="about-section">
        <div style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "0 1.5rem" }}>
          <Reveal style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 className="section-heading" style={{ fontFamily: '"Brothers", sans-serif', fontSize: "clamp(3.75rem, 7.5vw, 5.625rem)" }}>A Mutual Aid Society</h2>
            <hr className="gold-rule" style={{ "--rule-width": "60px" } as React.CSSProperties} />
          </Reveal>
          <Reveal style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))", gap: "4rem", transitionDelay: "0.1s" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <p className="about-lead">
                Elkdonis Arts is a community organization dedicated to promoting and practicing objective arts, several forms of education, and cultural exchange for public benefit.
              </p>
              <p className="about-lead">
                We provide accessible educational programs, workshops, lectures, and learning opportunities across diverse disciplines, including visual arts, theatre, philosophy, literature and cultural studies. We support artists, educators, thinkers, and creatives by offering opportunities to present, develop, and share artistic and intellectual work. We aim to engage and support emerging creatives through mentorship and community-based learning. Towards this end, we collaborate with individuals and organizations locally, nationally, and internationally in furtherance of these purposes.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <p className="about-lead">
                Our original group was first formed in Newmarket Ontario, Canada, 1990. We opened the first internet cafe in town, and held concerts and raves, as well as other performative, theatrical and literary events. Our group has undergone many radical transformations since. We helped usher in digital community and new digital group work to the internet, and that involved many experiments attempting to adapt ever changing web and mobile apps to our work over the years. Remaining true to the essence of our celebrated &ldquo;philosophical reading groups&rdquo;, often spontaneously hosted, this collective is quintessentially nomadic, eclectic, reflexive and dedicated to seeking knowledge and passing on what we have met well. Our current international collaborations are focused in Paris, Los Angeles and Toronto and surrounds, where our founding members are respectively situated and engaged in a wide variety of creative acts &amp; inquiries.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Gallery (admin-set images) ── */}
      <GallerySlider slides={gallery} />

      {/* ── Join the Collective ── */}
      <JoinSection />

      {/* ── The Grand Forum ──
          The forum itself, full width, opened on the work question's thread,
          under a short heading that says what it is: the network's forum,
          larger than this one group. A visitor without an account can still
          answer below it. */}
      {(forumEmbed || workQuestion) && (
        <section id="grand-forum" className="ig-forum-section" aria-labelledby="ig-forum-heading">
          <div className="ig-forum-head">
            <div>
              <p className="ig-forum-eyebrow">Across the arts collectives</p>
              <h2 id="ig-forum-heading" className="ig-forum-heading">The Grand Forum</h2>
            </div>
            <p className="ig-forum-lede">
              The independent forum used across the arts collectives, shared by every group in the
              network rather than owned by any one of them.
            </p>
            <Link href="/forum" className="ig-forum-btn ig-forum-btn--primary">Enter the forum</Link>
          </div>

          {forumEmbed && <div className="gf-page ig-forum-embed">{forumEmbed}</div>}

          {!viewer && workQuestion && (
            <div className="ig-forum-guest">
              <GuestAnswer questionId={workQuestion.question.id} question={workQuestion.question.question} />
            </div>
          )}
        </section>
      )}

      {/* ── Fundraising Goal / Community Support ── */}
      <section id="fundraising" className="fundraising-section">
        <div className="section-inner" style={{ maxWidth: 1040 }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <p className="section-eyebrow">Community Support</p>
              <h2 className="section-heading">Fundraising Goal</h2>
              <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem auto" } as React.CSSProperties} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "2rem", alignItems: "start" }}>
              <div style={{ background: "rgba(255, 253, 248, 0.82)", border: "1px solid rgba(183,154,85,0.32)", borderRadius: 4, padding: "1.5rem" }}>
                <p style={{ fontFamily: '"Basteleur", serif', color: "#022278", lineHeight: 1.8, marginBottom: "1.5rem" }}>
                  We Will Specialize in Grant Writing, Finding, and Even Our Own Micro Grants
                </p>
                {fundraising.raised > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#5a5240", marginBottom: "0.4rem" }}>
                      <span>{fundraising.currency} ${fundraising.raised.toLocaleString()} raised</span>
                      <span>Goal: ${fundraising.goal.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(1,18,78,0.12)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #b79a55, #8f763c)", borderRadius: 3 }} />
                    </div>
                  </div>
                )}
                <a href="https://www.gofundme.com/f/empowering-artists-in-toronto-and-la" target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ display: "inline-flex" }}>
                  Support on GoFundMe
                </a>
              </div>
              <div style={{ fontFamily: '"Basteleur", serif', color: "#022278", lineHeight: 1.8 }}>
                <p style={{ margin: "0 0 1rem" }}>{fundraising.status}</p>
                <p style={{ margin: 0, fontFamily: '"Venture", serif', fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8f763c" }}>
                  Instagram · GoFundMe · Substack — links in the footer
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Cities ── */}
      <Reveal as="section" style={{ background: "#2a5a2a", padding: "5rem 4rem", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
        {[
          ["Toronto", "Operations · Technology · Performance"],
          ["Los Angeles", "Music · Education · Outreach"],
          ["Paris", "Research · Writing · European Networks"],
        ].map(([city, line], i) => (
          <div key={city} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <div style={{ width: 1, height: 60, background: "rgba(221,232,208,0.15)" }} />}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1.5rem 4rem" }}>
              <span style={{ fontFamily: '"Basteleur", serif', fontWeight: 700, fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", color: "#dde8d0", letterSpacing: "0.04em" }}>{city}</span>
              <span style={{ fontFamily: '"Venture", serif', fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(221,232,208,0.4)" }}>{line}</span>
            </div>
          </div>
        ))}
      </Reveal>

      {/* ── Board — from members' own profiles ── */}
      <section id="board" className="board-section">
        <div className="section-inner">
          <p className="section-eyebrow" style={{ textAlign: "center" }}>The Board</p>
          <Reveal as="ul" className="ig-members" style={{ marginTop: "1.5rem" }}>
            {board.map((m) => (
              <li key={m.userId} className="ig-member">
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ig-member-photo" src={m.photoUrl} alt="" />
                ) : (
                  <span className="ig-member-initials" aria-hidden>{initials(m.displayName)}</span>
                )}
                <p className="ig-member-name"><Link href={`/about/${m.slug}`}>{m.displayName}</Link></p>
                {m.roleTitle && <p className="ig-member-title">{m.roleTitle}</p>}
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Vision Statement ── */}
      <section style={{ background: "#01124E", borderTop: "1px solid rgba(80,120,200,0.18)", padding: "8rem 4rem", textAlign: "center" }}>
        <blockquote style={{ fontFamily: '"Basteleur", serif', fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)", fontWeight: 300, lineHeight: 1.9, color: "rgba(198,221,255,0.78)", maxWidth: 700, margin: "0 auto 2.5rem", border: "none", padding: 0 }}>
          &ldquo;The collective is committed to using art as the means of inquiry. Each inquiry focuses on a particular question that is grounded in what it is to be human. We are unique in our purpose and are not commercial. Our works are intended to be experienced, not sold.&rdquo;
        </blockquote>
        <p style={{ fontFamily: '"Venture", serif', fontSize: "0.75rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(183,154,85,0.6)", margin: 0 }}>
          Elkdonis Arts Collective &mdash; Founded, Toronto
        </p>
      </section>

      <div id="contact" />
    </div>
  );
}

/**
 * Ask the media proxy for a downscaled copy. Only our own /api/media paths
 * understand `?w=`; an absolute URL to somewhere else is returned untouched.
 */
/**
 * Upcoming public gatherings in the offerings feed, with what the band needs
 * to show beside each: this cycle's status, the RSVP count and whether the
 * viewer has already said yes. Posts and past one-offs are left out; the feed
 * query itself keeps a one-off listed after it has happened.
 */
async function loadOfferings(threads: Thread[], viewerId: string | null): Promise<OfferingItem[]> {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  const upcoming = threads
    .filter((t) => ["meeting", "event", "workshop"].includes(t.kind))
    .filter((t) => t.nextOccurrenceAt && new Date(t.nextOccurrenceAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.nextOccurrenceAt!).getTime() - new Date(b.nextOccurrenceAt!).getTime())
    .slice(0, 4);
  return Promise.all(
    upcoming.map(async (thread) => {
      const recurring = Boolean(thread.recurrencePattern && thread.recurrencePattern !== "NONE");
      const [cycleStatus, attendanceCount, attending] = await Promise.all([
        recurring ? getCycleStatus(thread) : Promise.resolve(null),
        thread.isRsvpEnabled ? getAttendanceCount(thread) : Promise.resolve(0),
        viewerId ? getThreadRsvpForUser(thread, viewerId) : Promise.resolve(false),
      ]);
      return { thread, cycleStatus, attendanceCount, attending };
    })
  );
}

function variant(src: string, width: number): string {
  return src.startsWith("/api/media/") ? `${src}?w=${width}` : src;
}

function initials(name: string | null): string {
  if (!name) return "EA";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "EA"
  );
}
