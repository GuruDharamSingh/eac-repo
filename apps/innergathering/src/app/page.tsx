import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";
import { WorkQuestion } from "@/components/landing/WorkQuestion";
import { GallerySlider } from "@/components/landing/GallerySlider";
import { JoinSection } from "@/components/landing/JoinSection";
import { StickyBar } from "@/components/landing/StickyBar";
import { getLandingConfig, getWorkQuestion, listFeaturedThreads, listMiniFeed, mediaSrc } from "@/lib/landing";
import { getGuides, getSiteSections } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { formatDateTime, formatRecurrence } from "@/lib/format";

/**
 * The landing page, carried over from inner-gathering's (marketing) route
 * group: the same sections in the same order, with the same words and the
 * same three faces. What changed is underneath — every read is server-side
 * so the page arrives with its words on it, the board is drawn from members'
 * own profiles instead of a hard-coded list, and the sign-up is the
 * Mantine-free one.
 */
export default async function LandingPage() {
  const [config, workQuestion, mini, board, viewer, sections] = await Promise.all([
    getLandingConfig(),
    getWorkQuestion(),
    listMiniFeed(),
    getGuides(),
    getViewer().catch(() => null),
    getSiteSections(),
  ]);
  const featured = await listFeaturedThreads(config.featuredThreadIds);

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

  const initiative = {
    eyebrow: config.initiative.eyebrow ?? "Current Offerings - Spring 2026",
    heading: config.initiative.heading ?? "Web Portal",
    body:
      config.initiative.body ??
      "Excited to share our site with you that is now being soft launched as Inquiry in to What Is Art For, and facilitated on our web portal. This is an example of what's to come as an offering to anyone wishing to have something similar for their groups!",
    cta: config.initiative.cta ?? "Make an Inquiry",
  };
  const artist = {
    eyebrow: config.featuredArtist.eyebrow ?? "Featured Arts",
    name: config.featuredArtist.name ?? "Dana McCool",
    description: config.featuredArtist.description ?? "Surrealist Writing",
    image: mediaSrc(config.imageSpaces.featured_artist?.path, mediaSrc(config.featuredArtist.image_url, "/danamccool.jpg")),
    goals: config.featuredArtist.goals ?? "",
    links: [
      { label: config.featuredArtist.link1_label, url: config.featuredArtist.link1_url },
      { label: config.featuredArtist.link2_label, url: config.featuredArtist.link2_url },
    ].filter((l) => l.label && l.url) as Array<{ label: string; url: string }>,
  };
  const fundraising = {
    goal: config.fundraising.goal ?? 25000,
    raised: config.fundraising.raised ?? 0,
    status: config.fundraising.status ?? "We are just getting started. Every contribution goes directly to our artists and programs.",
    currency: config.fundraising.currency ?? "CAD",
  };
  const pct = fundraising.goal > 0 ? Math.min(100, Math.round((fundraising.raised / fundraising.goal) * 100)) : 0;
  // The hero falls back to the intro banner when no hero image is set, and
  // the same photograph twice on one page reads as a mistake rather than a
  // motif — so the standalone banner steps aside when it is that photograph.
  const introBannerSrc = mediaSrc(config.imageSpaces.intro_banner?.path);
  const introBanner = introBannerSrc === heroImage ? null : introBannerSrc;
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

      {/* ── Current Work Question ── */}
      {workQuestion && (
        <section className="cwq-section">
          <div className="section-inner" style={{ maxWidth: 1100 }}>
            <p className="section-eyebrow">Current Work Question</p>
            <div style={{ minWidth: 0, marginTop: "1.25rem" }}>
              <WorkQuestion question={workQuestion.question} responses={workQuestion.responses} signedIn={Boolean(viewer)} />
            </div>
            {!viewer && (
              <div className="cwq-login-bar">
                <span className="cwq-login-prompt">Join the conversation</span>
                <div className="cwq-login-actions">
                  <Link href="/login" className="cwq-login-btn cwq-login-btn--primary">Create account</Link>
                  <Link href="/login" className="cwq-login-link">Sign in</Link>
                </div>
              </div>
            )}
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

      {/* ── Banner image space (admin-set) ── */}
      {introBanner && (
        <section className="image-space-banner" aria-label="Collective banner image">
          <div className="image-space-banner-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="image-space-banner-img" src={introBanner} alt={config.imageSpaces.intro_banner?.alt ?? "Elkdonis Arts Collective banner"} loading="lazy" />
          </div>
        </section>
      )}

      {/* ── Featured Initiative + mini feed ── */}
      <section id="initiative" className="initiative-section">
        <div className="section-inner">
          <Reveal style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: "4rem", alignItems: "center" }}>
            <div className="initiative-copy">
              <p className="section-eyebrow">{initiative.eyebrow}</p>
              <h2 className="section-heading" style={{ fontFamily: '"Brothers", sans-serif' }}>{initiative.heading}</h2>
              <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem 0" } as React.CSSProperties} />
              <div style={{ fontFamily: '"Basteleur", serif', color: "#063179", lineHeight: 1.8, marginBottom: "1.25rem" }}>
                {initiative.body.split(/\n+/).map((para, i) => (
                  <p key={i} style={{ margin: "0 0 0.75em" }}>{para}</p>
                ))}
              </div>
              <div className="initiative-actions" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "2rem" }}>
                <a href="#contact" className="cta-btn" style={{ display: "inline-flex" }}>{initiative.cta}</a>
                <Link href={viewer ? "/hub" : "/login"} className="cta-btn" style={{ display: "inline-flex" }}>Web Portal</Link>
              </div>
            </div>

            {mini.length > 0 ? (
              <div className="initiative-feed-panel">
                <div className="initiative-feed-inner">
                  <p className="initiative-feed-eyebrow">Standing gatherings</p>
                  <ul className="initiative-feed-list">
                    {mini.map((t) => (
                      <li key={t.id} className="initiative-feed-card">
                        <Link href={t.href} className="initiative-feed-title">{t.title}</Link>
                        <span className="initiative-feed-meta">
                          {[t.scheduledAt && formatDateTime(t.scheduledAt), formatRecurrence(t.recurrencePattern), t.isOnline ? "Online" : t.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/offerings" className="initiative-feed-all">All offerings →</Link>
                </div>
              </div>
            ) : (
              <div className="initiative-panel" aria-hidden="true">
                <div className="initiative-panel-inner">
                  <div className="initiative-diamond" />
                  <p className="initiative-stat">Open-Source</p>
                  <p className="initiative-stat-label">Backend</p>
                  <div className="initiative-divider" />
                  <p className="initiative-stat">Mutual Aid</p>
                  <p className="initiative-stat-label">Fund</p>
                  <div className="initiative-divider" />
                  <p className="initiative-stat">Artists&rsquo;</p>
                  <p className="initiative-stat-label">Online Directory</p>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── Featured Gatherings ── */}
      {featured.length > 0 && (
        <section id="featured-events" className="featured-events-section">
          <Reveal className="section-inner">
            <div className="featured-events-header">
              <p className="section-eyebrow">Featured Gatherings</p>
              <h2 className="section-heading">Upcoming Threads</h2>
              <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem 0" } as React.CSSProperties} />
            </div>
            <div className="featured-events-table" role="table" aria-label="Featured gatherings and threads">
              <div className="featured-events-row featured-events-head" role="row">
                <span role="columnheader">Profile</span>
                <span role="columnheader">Meeting</span>
                <span role="columnheader">Date + Time</span>
                <span role="columnheader">Link</span>
              </div>
              <div className="featured-events-scroll">
                {featured.map((t) => (
                  <Link key={t.id} className="featured-events-row featured-events-item" href={t.href} role="row">
                    <span className="featured-events-avatar" role="cell" aria-label={t.authorName ?? "Elkdonis Arts"}>
                      {t.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.avatarUrl} alt="" />
                      ) : (
                        <span>{initials(t.authorName)}</span>
                      )}
                    </span>
                    <span className="featured-events-title" role="cell">
                      {t.title}
                      <small>{t.kind}</small>
                    </span>
                    <strong className="featured-events-date" role="cell">{t.scheduledAt ? formatDateTime(t.scheduledAt) : "Date TBA"}</strong>
                    <span className="featured-events-link" role="cell">View</span>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* ── Featured Arts ── */}
      <section id="grant-program" className="grant-section">
        <Reveal className="section-inner" style={{ display: "grid", gridTemplateColumns: artist.goals || artist.links.length ? "minmax(120px, 180px) 1fr 1fr" : "minmax(120px, 180px) 1fr", gap: "2.5rem", alignItems: "start" }}>
          <div className="grant-left">
            <p className="section-eyebrow" style={{ margin: "0 0 0.75rem" }}>{artist.eyebrow}</p>
            <div className="grant-image">
              {artist.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artist.image} alt={artist.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
              )}
            </div>
          </div>
          <div className="grant-right">
            <h2 className="section-heading" style={{ margin: 0 }}>{artist.name}</h2>
            <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.25rem 0 1.5rem" } as React.CSSProperties} />
            <p className="grant-body">{artist.description}</p>
          </div>
          {(artist.goals || artist.links.length > 0) && (
            <div style={{ borderLeft: "1px solid rgba(198,164,90,0.18)", paddingLeft: "2rem" }}>
              <p className="section-eyebrow">Goals &amp; Work</p>
              <hr className="gold-rule" style={{ "--rule-width": "40px", margin: "1rem 0 1.5rem" } as React.CSSProperties} />
              {artist.goals && <p className="grant-body" style={{ marginBottom: "1.5rem" }}>{artist.goals}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {artist.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ display: "inline-flex", fontSize: "0.75rem", height: 40 }}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Reveal>
      </section>

      {/* ── Gallery (admin-set images) ── */}
      <GallerySlider slides={gallery} />

      {/* ── Join the Collective ── */}
      <JoinSection />

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
      <StickyBar signedIn={Boolean(viewer)} />
    </div>
  );
}

/**
 * Ask the media proxy for a downscaled copy. Only our own /api/media paths
 * understand `?w=`; an absolute URL to somewhere else is returned untouched.
 */
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
