import * as React from "react";
import { SurfaceCard, kindMeta } from "../surface";
import { CenterThreadRow } from "./CenterThreadRow";
import { CenterComposeBar } from "./CenterComposeBar";
import { FollowButton } from "./FollowButton";
import { ArrangeButton } from "./ArrangeButton";
import { OrgStrip, type OrgStripItem } from "./OrgStrip";
import { CenterDesk, type CenterDeskItem } from "./CenterDesk";
import { ProfileFlipCard, type ProfileCardAction } from "./ProfileFlipCard";
import { JourneyRow, MeBar, type JourneyTabId } from "./JourneyTabs";
import { FeedSwitch } from "./FeedSwitch";
import { OrgManage } from "./OrgManage";
import type { CenterData, CenterJourney, CenterLinks, CenterOrgLink, CenterThread } from "./types";
import { DEFAULT_CENTER_LAYOUT, type CenterLayout, type CenterSectionId } from "./layout";

// ============================================================================
// /center — the follower's home on one org's site.
//
// Two columns. The person on the left: their card, a few buttons, where else
// they are, and the promotion slot. The org on the right: the site itself
// (a live iframe, scaled down and scrollable), the org's card, what it has
// pinned, then the feed as post cards with a compose bar above, a featured
// thread, and a slider of what the network is carrying.
//
// A section with nothing to show returns null (frontend-ui.md: no apology
// rows). The one exception is the feed, which keeps its compose bar for a
// viewer who can post.
//
// A SERVER component, like ProfileView: nothing here holds state. The live
// leaves (a feed row that opens a surface, the follow button, the compose
// bar) are the only client components, and they take strings, so a host
// resolves every href. Faces are the surface system's own SurfaceCard; the
// panels that hold lists borrow its anatomy without a hit target of their
// own, because each row is its own.
//
// Tailwind utilities are used in the newer parts (the profile cards, the
// post rows) on the owner's call; colours still come from the surface
// tokens so an org's theme carries through. center.css holds the layout.
// ============================================================================

/** The page's own header. Each field falls back to a default; null hides the header. */
export interface CenterHeading {
  /** Small label above the title; defaults to the org's name. */
  eyebrow?: string | null;
  /** Defaults to "Center". */
  title?: string;
  /** One sentence under the title; defaults to the standard line. */
  intro?: string | null;
}

export interface CenterPageProps {
  data: CenterData;
  links: CenterLinks;
  signedIn: boolean;
  /** Eyebrow, title and intro above the columns. Omit for the defaults; null for none. */
  heading?: CenterHeading | null;
  /** The org's definition over the network default; DEFAULT_CENTER_LAYOUT when absent. */
  layout?: CenterLayout;
  /** IANA zone for dates; defaults to the viewer's browser via Intl. */
  timeZone?: string;
  locale?: string;
  /**
   * Where the person stands on the auction errand (commerce's
   * `loadAuctionJourney`). Feeds the `you` panel's Payouts tab, the journey
   * cards and the pills on the card's plate. A host without commerce omits
   * it; those sections then draw only what the connectors can answer.
   */
  journey?: CenterJourney | null;
  /** "← Back to IFAC": the page has no site nav of its own (2026-10-18). */
  back?: { href: string; label: string } | null;
  /** Which journey tab opens first (`?journey=`). */
  journeyTab?: JourneyTabId | null;
  /** The org's full manage console, for the organisation journey's rail. */
  manageHref?: string | null;
}

/** What the move handle calls each section. */
const SECTION_LABEL: Record<CenterSectionId, string> = {
  profile: "your card",
  buttons: "your settings",
  you: "your account",
  journeys: "what to do next",
  orgs: "go to another site",
  promo: "the promotion",
  site: "the site",
  org: "the organisation card",
  pinned: "what is pinned",
  feed: "the feed",
  featured: "the featured thread",
  network: "the network strip",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  guide: "Guide",
  member: "Member",
  viewer: "Following",
};

const TIER_LABEL: Record<string, string> = {
  partner: "Partner organisation",
  supported: "Supported organisation",
  free: "Organisation",
};

function fmtWhen(iso: string | null, timeZone?: string, locale?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

function fmtDay(iso: string | null, timeZone?: string, locale?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone }).format(d);
}

/** A list-holding face: the anatomy of SurfaceCard with no hit area of its own. */
function Panel({
  kind = "neutral",
  glyph,
  kicker,
  title,
  wide,
  className,
  children,
}: {
  kind?: string;
  glyph?: string;
  kicker: string;
  title: string;
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const meta = kindMeta(kind);
  const cls = ["eac-face", "eac-center-panel", wide && "eac-face--wide", className]
    .filter(Boolean)
    .join(" ");
  return (
    <article className={cls} data-kind={kind}>
      <span className="eac-face-glyph" aria-hidden>
        {glyph ?? meta.glyph}
      </span>
      <span className="eac-face-kicker">{kicker}</span>
      <span className="eac-face-title">{title}</span>
      <div className="eac-face-live eac-center-panel-body">{children}</div>
    </article>
  );
}

export function CenterPage({
  data,
  links,
  signedIn,
  heading,
  timeZone,
  locale,
  layout = DEFAULT_CENTER_LAYOUT,
  journey = null,
  back = null,
  journeyTab = null,
  manageHref = null,
}: CenterPageProps) {
  const { person, org, orgs, feed, featured, network, promo } = data;
  const pinned = data.pinned.slice(0, layout.options.pinned?.limit ?? 6);
  const rest = feed.filter((t) => !t.pinned);
  const orgName = org?.orgName ?? "this organisation";
  const role = org?.viewerRole ?? null;
  const isStaff = role === "owner" || role === "guide" || role === "member";
  const canEditOrg = role === "owner" || role === "guide";

  // ── Left: you ─────────────────────────────────────────────────────────
  const portrait = person?.orgProfile?.photoOverride ?? person?.avatarUrl ?? null;
  // The back of the person's card. This is their own center, so every door
  // here is one they may walk through; a host that serves none of them gets a
  // card with no back and no turn control at all.
  const profileActions: ProfileCardAction[] = [
    {
      // The profile journey, not the old popup (2026-10-18).
      id: "edit",
      label: "Edit your profile",
      note: person?.orgProfile
        ? [
            person.orgProfile.roleTitle,
            person.orgProfile.isPublic ? "listed publicly" : "not listed",
          ]
            .filter(Boolean)
            .join(" · ")
        : `${orgName} doesn’t list you yet`,
      journey: "profile" as const,
      href: links.editProfileHref,
    },
    ...(links.profileHref
      ? [{ id: "page", label: "Your public page", note: "how the network sees you", href: links.profileHref }]
      : []),
    ...(links.filesHref
      ? [{ id: "files", label: "Your files", note: "yours wherever you sign in", href: links.filesHref }]
      : []),
    ...(links.studioHref
      ? [{ id: "studio", label: "Studio", note: "manage everything you have made", href: links.studioHref }]
      : []),
    { id: "account", label: "Account settings", note: "sign-in and email", href: links.accountHref },
  ];

  const buttons: Array<{ label: string; href: string }> = [
    ...(links.studioHref ? [{ label: "Studio", href: links.studioHref }] : []),
    { label: "Account", href: links.accountHref },
    ...(links.notificationsHref ? [{ label: "Notifications", href: links.notificationsHref }] : []),
    ...(links.filesHref ? [{ label: "Files", href: links.filesHref }] : []),
    ...(links.forumHref ? [{ label: "Forum", href: links.forumHref }] : []),
    ...(links.profileHref ? [{ label: "Your page", href: links.profileHref }] : []),
  ];

  const promoHref =
    promo?.kind === "thread" && promo.thread
      ? promo.thread.orgId === org?.orgId
        ? links.threadHref(promo.thread)
        : links.networkThreadHref(promo.thread)
      : promo?.kind === "artist" && promo.artistSlug
      ? links.artistHref(promo.artistSlug)
      : promo?.kind === "store"
      ? links.marketplaceUrl ?? undefined
      : promo?.kind === "link"
      ? promo.href ?? undefined
      : undefined;
  const promoSurface =
    promo?.kind === "thread" && promo.thread && promo.thread.orgId === org?.orgId
      ? ({
          type: "thread",
          id: promo.thread.id,
          preview: {
            title: promo.thread.title,
            kind: promo.thread.kind,
            scheduledAt: promo.thread.scheduledAt,
            coverImageUrl: promo.thread.coverImageUrl,
          },
        } as const)
      : undefined;

  // ── Right: the org ────────────────────────────────────────────────────
  const next = org?.nextEvent ?? null;
  const orgFacts = [
    org?.place,
    `${org?.followerCount ?? 0} ${org?.followerCount === 1 ? "follower" : "followers"}`,
    typeof org?.upcomingCount === "number" ? `${org.upcomingCount} upcoming` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Every section is a named piece; the layout says which appear and in
  // what order, per column. A section absent from both columns, or listed
  // in `hidden`, is simply not drawn — the org's veto.
  const sections: Record<CenterSectionId, React.ReactNode> = {
    profile: (
      <>
        {/* The person's card, bare (take two, 2026-10-18): no face chrome
            around it, the portrait fills it, the plate carries the pills. The
            back still turns over to the same doors. */}
        <div className="eac-center-person">
          <ProfileFlipCard
            image={portrait}
            glyph="◯"
            name={person?.displayName ?? "You"}
            subtitle={person?.headline ?? null}
            note={person?.city ?? null}
            links={person?.socialLinks ?? []}
            actions={profileActions}
          />
        </div>
        {links.gainSpaceHref && (
          <div className="eac-center-gain">
            <p>
              Join the collective as an artist: a listing on ArtDirect and file
              storage of your own. No organisation needed.
            </p>
            <a className="eac-center-btn eac-center-btn--primary" href={links.gainSpaceHref}>
              Gain your space
            </a>
          </div>
        )}
      </>
    ),
    buttons: (
      /* Four plain doors under the card, each going somewhere real. */
      <nav className="eac-center-doors" aria-label="Your places">
        {[
          links.profileHref ? { label: "Your public page", note: "on ArtDirect, signed in", href: links.profileHref } : null,
          links.filesHref ? { label: "Your files", note: "storage that follows you", href: links.filesHref } : null,
          links.studioHref ? { label: "Studio", note: "everything you have made", href: links.studioHref } : null,
          { label: "Account", note: "email, password, sign out", href: links.accountHref },
          ...(links.forumHref ? [{ label: "Forum", note: "every board, in full", href: links.forumHref }] : []),
        ]
          .filter((d): d is { label: string; note: string; href: string } => Boolean(d))
          .map((d) => (
            <a key={d.label} className="eac-center-door" href={d.href}>
              <span>{d.label}</span>
              <small>{d.note}</small>
            </a>
          ))}
      </nav>
    ),
    /* `you` was the inline Payouts tab of the first pass; its content now
       lives in the Selling art journey. Kept as an id so stored layouts that
       list it still validate; it draws nothing. */
    you: null,
    journeys: (
      <>
        {/* The person's own doors first (2026-10-31); the journeys sit below. */}
        <MeBar studioHref={links.studioHref ?? null} />
        <JourneyRow journey={journey} initialTab={journeyTab} />
      </>
    ),
    orgs:
      orgs.length === 0 ? null : (
        <Panel kicker="Across the collective" title="Go to another site" glyph="⌂">
          <OrgStrip
              orgs={orgs.map<OrgStripItem>((o) => {
                const staff = o.role === "owner" || o.role === "guide" || o.role === "member";
                const href = links.orgHref(o);
                return {
                  orgId: o.orgId,
                  orgSlug: o.orgSlug,
                  orgName: o.orgName,
                  role: o.role,
                  isCurrent: o.isCurrent,
                  href,
                  note: [
                    o.rsvpCount > 0 ? `${o.rsvpCount} RSVP${o.rsvpCount === 1 ? "" : "s"}` : null,
                    href && staff && !o.isCurrent ? "hub →" : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                };
              })}
          />
        </Panel>
      ),
    promo:
      /* The promotion slot (decision 13). Kicker always reads "Promoted" so
         it is never mistaken for the feed. Drawn only when something is
         placed (site_config `center_promo`); there is no placeholder. */
      promo && (
          <SurfaceCard
            kind={promo.kind === "thread" ? promo.thread?.kind ?? "post" : promo.kind === "link" ? "neutral" : "product"}
            kicker="Promoted"
            title={promo.title}
            blurb={promo.blurb ?? undefined}
            surface={promoSurface}
            href={promoHref}
            className="eac-center-promo"
            preview={
              promo.imageUrl ? (
                <div className="eac-center-promo-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={promo.imageUrl} alt="" />
                </div>
              ) : undefined
            }
          />
      ),
    site: (
      <>
        {/* The site itself, live: the org's home page in an iframe, laid out
            at full width and scaled down to the column. The frame takes the
            pointer (.eac-face-live) so it scrolls and its links work; the
            face has no stretched hit area of its own, so a visible link
            opens the site in a tab. */}
        {links.homePreviewUrl && (
          <article className="eac-face eac-center-home" data-kind="neutral">
            <span className="eac-face-glyph" aria-hidden>⌂</span>
            <span className="eac-face-kicker">The site</span>
            <span className="eac-face-title">{orgName} at home</span>
            {links.homeUrl && (
              <p className="eac-face-live eac-center-home-bar">
                <a className="eac-center-btn eac-center-home-open" href={links.homeUrl} target="_blank" rel="noopener">
                  Open site →
                </a>
              </p>
            )}
            <div className="eac-face-live eac-center-home-frame">
              <div className="eac-center-home-scale">
                <iframe
                  src={links.homePreviewUrl}
                  title={`${orgName} home page`}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                />
              </div>
            </div>
          </article>
        )}
      </>
    ),
    org:
      canEditOrg && org ? (
        /* Owners and guides get the org's Details and People here, in place of the card. */
        <OrgManage orgId={org.orgId}>
      <>
        {/* The org's card, compact: a small square image, the name and facts,
            the relation, the next thing. Its flip side is the profile surface
            over the org's own identity row — where owners and guides set the
            display image (the ✎ cue). */}
        <SurfaceCard
          kind="neutral"
          glyph="◆"
          kicker={TIER_LABEL[org?.tier ?? "free"] ?? "Organisation"}
          title={orgName}
          surface={org ? { type: "profile", target: { kind: "org", orgId: org.orgId } } : undefined}
          href={links.orgProfileHref ?? undefined}
          cue={canEditOrg ? "✎" : undefined}
          className="eac-center-orgcard"
          preview={
            <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 items-start">
              <span className="block h-16 w-16 overflow-hidden rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)]">
                {org?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-2xl text-[color:var(--sf-faint)]" aria-hidden>
                    ◆
                  </span>
                )}
              </span>
              <div className="min-w-0 grid gap-1.5">
                {(org?.headline || canEditOrg) && (
                  <p className="m-0 text-[0.9rem] text-[color:var(--sf-muted)]">
                    {org?.headline ?? "Add a headline and a display image"}
                  </p>
                )}
                {orgFacts && <p className="eac-center-orgcard-facts m-0">{orgFacts}</p>}
                {org?.owners && org.owners.length > 0 && (
                  <p className="eac-center-orgcard-owners m-0">
                    <span>{org.owners.length === 1 ? "Owner" : "Owners"}</span>{" "}
                    {org.owners.map((o, i) => (
                      <React.Fragment key={o.userId}>
                        {i > 0 && ", "}
                        {o.slug ? (
                          <a className="eac-face-live" href={links.artistHref(o.slug)}>
                            {o.displayName}
                          </a>
                        ) : (
                          o.displayName
                        )}
                      </React.Fragment>
                    ))}
                  </p>
                )}
                <div className="eac-face-live eac-center-orgcard-relation">
                  {role && <span className="eac-center-chip">{ROLE_LABEL[role]}</span>}
                  {canEditOrg && org && <ArrangeButton orgId={org.orgId} />}
                  {!isStaff && links.followEndpoint && (
                    <FollowButton
                      endpoint={links.followEndpoint}
                      following={role === "viewer"}
                      signedIn={signedIn}
                      loginHref={links.loginHref}
                      orgName={orgName}
                    />
                  )}
                </div>
                {next && (
                  <div className="eac-face-live">
                    <div className="eac-center-rows">
                      <CenterThreadRow
                        thread={next}
                        href={links.threadHref(next)}
                        meta={
                          next.viewerAttending
                            ? `${fmtWhen(next.scheduledAt, timeZone, locale) ?? ""} · going`
                            : fmtWhen(next.scheduledAt, timeZone, locale)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </>
        </OrgManage>
      ) : (
      <>
        {/* The org's card, compact: a small square image, the name and facts,
            the relation, the next thing. Its flip side is the profile surface
            over the org's own identity row — where owners and guides set the
            display image (the ✎ cue). */}
        <SurfaceCard
          kind="neutral"
          glyph="◆"
          kicker={TIER_LABEL[org?.tier ?? "free"] ?? "Organisation"}
          title={orgName}
          surface={org ? { type: "profile", target: { kind: "org", orgId: org.orgId } } : undefined}
          href={links.orgProfileHref ?? undefined}
          cue={canEditOrg ? "✎" : undefined}
          className="eac-center-orgcard"
          preview={
            <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 items-start">
              <span className="block h-16 w-16 overflow-hidden rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)]">
                {org?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-2xl text-[color:var(--sf-faint)]" aria-hidden>
                    ◆
                  </span>
                )}
              </span>
              <div className="min-w-0 grid gap-1.5">
                {(org?.headline || canEditOrg) && (
                  <p className="m-0 text-[0.9rem] text-[color:var(--sf-muted)]">
                    {org?.headline ?? "Add a headline and a display image"}
                  </p>
                )}
                {orgFacts && <p className="eac-center-orgcard-facts m-0">{orgFacts}</p>}
                {org?.owners && org.owners.length > 0 && (
                  <p className="eac-center-orgcard-owners m-0">
                    <span>{org.owners.length === 1 ? "Owner" : "Owners"}</span>{" "}
                    {org.owners.map((o, i) => (
                      <React.Fragment key={o.userId}>
                        {i > 0 && ", "}
                        {o.slug ? (
                          <a className="eac-face-live" href={links.artistHref(o.slug)}>
                            {o.displayName}
                          </a>
                        ) : (
                          o.displayName
                        )}
                      </React.Fragment>
                    ))}
                  </p>
                )}
                <div className="eac-face-live eac-center-orgcard-relation">
                  {role && <span className="eac-center-chip">{ROLE_LABEL[role]}</span>}
                  {canEditOrg && org && <ArrangeButton orgId={org.orgId} />}
                  {!isStaff && links.followEndpoint && (
                    <FollowButton
                      endpoint={links.followEndpoint}
                      following={role === "viewer"}
                      signedIn={signedIn}
                      loginHref={links.loginHref}
                      orgName={orgName}
                    />
                  )}
                </div>
                {next && (
                  <div className="eac-face-live">
                    <div className="eac-center-rows">
                      <CenterThreadRow
                        thread={next}
                        href={links.threadHref(next)}
                        meta={
                          next.viewerAttending
                            ? `${fmtWhen(next.scheduledAt, timeZone, locale) ?? ""} · going`
                            : fmtWhen(next.scheduledAt, timeZone, locale)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </>
      ),
    pinned:
      /* What the org has pinned for its followers (decision 5), as faces. */
      pinned.length === 0 ? null : (
        <div className="eac-center-pinned">
          <p className="eac-center-strip-head">
            <span className="eac-face-kicker">Pinned by {orgName}</span>
          </p>
            <div className="eac-center-pinned-grid">
              {pinned.map((t) => (
                <SurfaceCard
                  key={t.id}
                  kind={t.kind}
                  kicker="Pinned"
                  title={t.title}
                  blurb={t.excerpt ?? rowMeta(t, timeZone, locale) ?? undefined}
                  surface={{
                    type: "thread",
                    id: t.id,
                    preview: {
                      title: t.title,
                      kind: t.kind,
                      scheduledAt: t.scheduledAt,
                      coverImageUrl: t.coverImageUrl,
                    },
                  }}
                  href={links.threadHref(t)}
                  preview={
                    t.coverImageUrl ? (
                      <div className="eac-center-featured-media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={t.coverImageUrl} alt="" />
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
        </div>
      ),
    feed:
      /* The feed: a compose bar, then the org's threads as post cards with
         their authors. An empty feed is drawn only when the viewer can post
         (staff, or a host with somewhere to write), so the bar stays. */
      rest.length === 0 && !isStaff && !links.composeHref ? null : (
        <Panel kind="post" kicker="Latest" title="What is new" wide className="eac-center-feed">
          <FeedSwitch
            orgName={orgName}
            org={
              <>
          <CenterComposeBar
            avatarUrl={portrait}
            name={person?.displayName?.split(" ")[0] ?? "you"}
            href={links.composeHref}
            canCompose={isStaff}
          />
          {rest.length > 0 && (
            <div className="eac-center-posts">
              {rest.map((t) => (
                <CenterThreadRow
                  key={t.id}
                  thread={t}
                  href={links.threadHref(t)}
                  meta={rowMeta(t, timeZone, locale)}
                  post
                />
              ))}
            </div>
          )}
              </>
            }
            network={
              network.length > 0 ? (
            <div className="eac-center-posts">
              {network.map((t) => (
                <CenterThreadRow
                  key={t.id}
                  thread={t}
                  href={links.networkThreadHref(t)}
                  meta={[t.orgName, rowMeta(t, timeZone, locale)].filter(Boolean).join(" · ")}
                  post
                />
              ))}
            </div>
              ) : (
                <p className="eac-center-empty">Nothing is shared across the network yet. What other organisations publish for everyone appears here.</p>
              )
            }
          />
        </Panel>
      ),
    featured: (
      <>
        {featured && (
          <SurfaceCard
            wide
            kind={featured.kind}
            kicker="Featured · next up"
            title={featured.title}
            blurb={featured.excerpt ?? rowMeta(featured, timeZone, locale) ?? undefined}
            surface={{
              type: "thread",
              id: featured.id,
              preview: {
                title: featured.title,
                kind: featured.kind,
                scheduledAt: featured.scheduledAt,
                coverImageUrl: featured.coverImageUrl,
              },
            }}
            href={links.threadHref(featured)}
            className="eac-center-featured"
            preview={
              featured.coverImageUrl ? (
                <div className="eac-center-featured-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={featured.coverImageUrl} alt="" />
                </div>
              ) : undefined
            }
          />
        )}
      </>
    ),
    network:
      network.length === 0 ? null : (
        <div className="eac-center-network">
          <p className="eac-center-network-head">
            <span className="eac-face-kicker">Across the network</span>
            <span className="eac-center-network-note">
              what other organisations are carrying · yours first
            </span>
          </p>
            <div className="eac-center-slider" role="list">
              {network.map((t) => (
                <div role="listitem" key={t.id} className="eac-center-slide">
                  <SurfaceCard
                    small
                    kind={t.kind}
                    kicker={t.orgName}
                    title={t.title}
                    blurb={sliderMeta(t, timeZone, locale)}
                    href={links.networkThreadHref(t)}
                    cue="→"
                  />
                </div>
              ))}
            </div>
        </div>
      ),
  };
  // Hidden by the org, or with nothing to draw: either way the section is
  // not in the flow, so neither column (nor the desk) keeps a gap for it.
  const visible = (ids: CenterSectionId[]) =>
    ids.filter((id) => !layout.hidden.includes(id) && sections[id] != null);

  const head =
    heading === null ? null : (
      <header className="eac-center-head">
        <div className="eac-center-head-text">
          {(heading?.eyebrow ?? orgName) && <p className="eac-center-head-eyebrow">{heading?.eyebrow ?? orgName}</p>}
          <h1 className="eac-center-head-title">{heading?.title ?? "Center"}</h1>
          {(heading?.intro === undefined || heading.intro) && (
            <p className="eac-center-head-intro">
              {heading?.intro ?? "You on the collective: selling your work, your organisation, your profile."}
            </p>
          )}
        </div>
        {back && (
          <a className="eac-center-back" href={back.href}>
            ← Back to {back.label}
          </a>
        )}
      </header>
    );
  const ratio = layout.options.site?.ratio === "4:3" ? "4 / 3" : "5 / 3";
  const frame = { ["--eac-center-site-ratio" as string]: ratio } as React.CSSProperties;

  // The desk: the same sections, in the same order, lying loose instead of
  // stacked in two columns. The org decides there is a desk; the reader
  // decides where everything sits on it.
  if (layout.arrangement === "desk") {
    const deskItems: CenterDeskItem[] = [...visible(layout.columns.left), ...visible(layout.columns.right)].map(
      (id) => ({ id, label: SECTION_LABEL[id] ?? id, node: sections[id] })
    );
    return (
      <div className="eac-center eac-center--desk" data-voice={layout.voice} style={frame}>
        {head}
        <CenterDesk
          items={deskItems}
          /* Per org and per person: two people who share a browser keep
             their own desks. */
          storageKey={`eac-center-desk/${org?.orgId ?? "org"}/${person?.userId ?? "guest"}`}
        />
      </div>
    );
  }

  return (
    <div className="eac-center" data-voice={layout.voice} style={frame}>
      {head}
      <aside className="eac-center-you" aria-label="You">
        {visible(layout.columns.left).map((id) => (
          <React.Fragment key={id}>{sections[id]}</React.Fragment>
        ))}
      </aside>

      <section className="eac-center-org" aria-label={orgName}>
        {visible(layout.columns.right).map((id) => (
          <React.Fragment key={id}>{sections[id]}</React.Fragment>
        ))}
      </section>
    </div>
  );
}



function rowMeta(t: CenterThread, tz?: string, locale?: string): string | null {
  const when = t.scheduledAt ? fmtWhen(t.scheduledAt, tz, locale) : fmtDay(t.publishedAt, tz, locale);
  const bits = [when, t.rsvpCount > 0 ? `${t.rsvpCount} going` : null];
  return bits.filter(Boolean).join(" · ") || null;
}

function sliderMeta(t: CenterThread, tz?: string, locale?: string): string {
  const k = kindMeta(t.kind).label || t.kind;
  const when = t.scheduledAt ? fmtDay(t.scheduledAt, tz, locale) : fmtDay(t.publishedAt, tz, locale);
  const also = t.carriedBy.length ? `also at ${t.carriedBy.slice(0, 2).join(", ")}` : null;
  return [k, when, also].filter(Boolean).join(" · ");
}
