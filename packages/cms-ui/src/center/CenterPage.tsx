import * as React from "react";
import { SurfaceCard, kindMeta } from "../surface";
import { CenterThreadRow } from "./CenterThreadRow";
import { CenterComposeBar } from "./CenterComposeBar";
import { FollowButton } from "./FollowButton";
import { ArrangeButton } from "./ArrangeButton";
import { OrgStrip, type OrgStripItem } from "./OrgStrip";
import { CenterDesk, type CenterDeskItem } from "./CenterDesk";
import { ProfileFlipCard, type ProfileCardAction } from "./ProfileFlipCard";
import type { CenterData, CenterLinks, CenterOrgLink, CenterThread } from "./types";
import { DEFAULT_CENTER_LAYOUT, type CenterLayout, type CenterSectionId } from "./layout";

// ============================================================================
// /center — the follower's home on one org's site.
//
// Two columns. The person on the left: their card, a few buttons, where else
// they are, and the promotion slot. The org on the right: the site itself
// (scaled, scrollable), the org's card, what it has pinned, then the feed as
// post cards with a compose bar above, a featured thread, and a slider of
// what the network is carrying.
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

export interface CenterPageProps {
  data: CenterData;
  links: CenterLinks;
  signedIn: boolean;
  /** The org's definition over the network default; DEFAULT_CENTER_LAYOUT when absent. */
  layout?: CenterLayout;
  /** IANA zone for dates; defaults to the viewer's browser via Intl. */
  timeZone?: string;
  locale?: string;
}

/** What the move handle calls each section. */
const SECTION_LABEL: Record<CenterSectionId, string> = {
  profile: "your card",
  buttons: "your settings",
  orgs: "where you are",
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="eac-center-empty">{children}</p>;
}

/**
 * The profile card, as the owner's example draws it: the image fills the
 * card, a details bar sits at the foot, and on hover the image lifts to
 * reveal the person's links. Shared by the person and the org so their
 * proportions are one thing. It renders inside a SurfaceCard's preview, so
 * the card's own hit area opens the surface (or navigates).
 *
 * Exported because other sites present a person the same way outside
 * /center — elastrocal introduces its astrologer on its home page — and two
 * drawings of the same card would drift apart.
 */
export function ProfileCardBody({
  image,
  glyph,
  name,
  subtitle,
  note,
  links,
}: {
  image: string | null;
  glyph: string;
  name: string;
  subtitle: string | null;
  note: string | null;
  links: Array<{ label: string | null; url: string }>;
}) {
  return (
    <div className="eac-center-pcard relative -mx-[18px] -mt-[44px] mb-1 aspect-[3/4] max-h-[420px] w-[calc(100%+36px)] overflow-hidden rounded-t-[var(--sf-radius)] bg-[color:var(--sf-bg-soft)]">
      <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:-translate-y-20">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-60" />
        ) : (
          <span className="grid h-full w-full place-items-center text-6xl text-[color:var(--sf-faint)]" aria-hidden>
            {glyph}
          </span>
        )}
      </div>
      {links.length > 0 && (
        <ul className="eac-face-live absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-wrap justify-center gap-2 px-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {links.slice(0, 5).map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener"
                className="inline-block rounded-full border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] px-3 py-1 font-[family-name:var(--sf-font-record)] text-[0.66rem] uppercase tracking-[0.1em] text-[color:var(--sf-fg)] no-underline hover:border-[color:var(--sf-accent)]"
              >
                {l.label ?? l.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-[color:var(--sf-bg)]/92 px-4 py-3 backdrop-blur">
        <div className="font-[family-name:var(--sf-font-title)] text-[1.25rem] leading-tight">{name}</div>
        {subtitle && <div className="mt-0.5 text-[0.82rem] text-[color:var(--sf-muted)]">{subtitle}</div>}
        {note && (
          <div className="mt-1 font-[family-name:var(--sf-font-record)] text-[0.62rem] tracking-[0.04em] text-[color:var(--sf-muted)]">
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

export function CenterPage({ data, links, signedIn, timeZone, locale, layout = DEFAULT_CENTER_LAYOUT }: CenterPageProps) {
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
      surface: true,
      href: links.editProfileHref,
    },
    {
      id: "details",
      label: "Your details",
      note: "location, links, account",
      surface: true,
      surfaceTab: "details",
      href: links.editProfileHref,
    },
    ...(links.profileHref
      ? [{ id: "page", label: "Your public page", note: "how the network sees you", href: links.profileHref }]
      : []),
    ...(links.filesHref
      ? [{ id: "files", label: "Your files", note: "yours wherever you sign in", href: links.filesHref }]
      : []),
    { id: "account", label: "Account settings", note: "sign-in and email", href: links.accountHref },
  ];

  const buttons: Array<{ label: string; href: string }> = [
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
        {/* The person's card: the network-wide identity. The portrait fills
            the front; the card turns over to what you can do to the profile.
            A face nobody can see is inert, so the turn is state inside
            ProfileFlipCard rather than :hover in the stylesheet. */}
        <SurfaceCard
          kind="neutral"
          glyph="◯"
          kicker="You"
          title={person?.displayName ?? "Your profile"}
          surface={{ type: "profile" }}
          href={links.editProfileHref}
          className="eac-center-person"
          preview={
            <ProfileFlipCard
              image={portrait}
              glyph="◯"
              name={person?.displayName ?? "You"}
              /* Only what is true. The prompts that used to fill these — "add
                 a line about yourself", "how this org shows you" — were
                 printed over the portrait, which is the one thing the card is
                 for. They belong on the back, where the editing is. */
              subtitle={person?.headline ?? null}
              note={person?.city ?? null}
              links={person?.socialLinks ?? []}
              actions={profileActions}
            />
          }
        />
      </>
    ),
    buttons: (
      <>
        <nav className="eac-center-btns" aria-label="Your settings">
          {buttons.map((b) => (
            <a key={b.label} className="eac-center-btn" href={b.href}>
              {b.label}
            </a>
          ))}
        </nav>
      </>
    ),
    orgs: (
      <>
        <Panel kicker="Your engagements" title="Where you are" glyph="⌂">
          {orgs.length === 0 ? (
            <Empty>You don&rsquo;t follow anything yet.</Empty>
          ) : (
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
          )}
        </Panel>
      </>
    ),
    promo: (
      <>
        {/* The promotion slot (decision 13). Kicker always reads "Promoted"
            so it is never mistaken for the feed. */}
        {promo ? (
          <SurfaceCard
            kind={promo.kind === "thread" ? promo.thread?.kind ?? "post" : "product"}
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
        ) : (
          <Panel kicker="Promoted" title="Nothing placed yet" className="eac-center-promo is-empty">
            <Empty>A store, an artist or an event from the collective will appear here.</Empty>
          </Panel>
        )}
      </>
    ),
    site: (
      <>
        {/* The site itself, scaled and scrollable: the org's home page is
            its profile by default. The face's cue is the door to it. */}
        {links.homePreviewUrl && (
          <article className="eac-face eac-center-home" data-kind="neutral">
            {links.homeUrl && (
              <a className="eac-face-hit" href={links.homeUrl} aria-label={`Visit ${orgName}`} />
            )}
            <span className="eac-face-glyph" aria-hidden>⌂</span>
            <span className="eac-face-cue" aria-hidden>→</span>
            <span className="eac-face-kicker">The site</span>
            <span className="eac-face-title">{orgName} at home</span>
            <div className="eac-center-home-frame" aria-hidden>
              <iframe
                src={links.homePreviewUrl}
                title={`${orgName} home page`}
                loading="lazy"
                tabIndex={-1}
                sandbox="allow-same-origin"
              />
            </div>
          </article>
        )}
      </>
    ),
    org: (
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
                <div className="eac-face-live">
                  {next ? (
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
                  ) : (
                    <Empty>
                      {role
                        ? `You haven’t reserved a place at anything here yet.`
                        : `Follow ${orgName} to get their updates here.`}
                    </Empty>
                  )}
                </div>
              </div>
            </div>
          }
        />
      </>
    ),
    pinned: (
      <>
        {/* What the org has pinned for its followers (decision 5), as faces. */}
        <div className="eac-center-pinned">
          <p className="eac-center-strip-head">
            <span className="eac-face-kicker">Pinned by {orgName}</span>
          </p>
          {pinned.length === 0 ? (
            <Empty>{orgName} hasn&rsquo;t pinned anything for followers yet.</Empty>
          ) : (
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
          )}
        </div>
      </>
    ),
    feed: (
      <>
        {/* The feed: a compose bar, then the org's threads as post cards
            with their authors — the people of the org beside their words. */}
        <Panel kind="post" kicker={`From ${orgName}`} title="Latest" wide className="eac-center-feed">
          <CenterComposeBar
            avatarUrl={portrait}
            name={person?.displayName?.split(" ")[0] ?? "you"}
            href={links.composeHref}
            canCompose={isStaff}
          />
          {rest.length === 0 ? (
            <Empty>{orgName} hasn&rsquo;t published anything yet.</Empty>
          ) : (
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
        </Panel>
      </>
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
    network: (
      <>
        <div className="eac-center-network">
          <p className="eac-center-network-head">
            <span className="eac-face-kicker">Across the network</span>
            <span className="eac-center-network-note">
              what other organisations are carrying · yours first
            </span>
          </p>
          {network.length === 0 ? (
            <Empty>Nothing has been shared to the network yet.</Empty>
          ) : (
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
          )}
        </div>
      </>
    ),
  };
  const visible = (ids: CenterSectionId[]) => ids.filter((id) => !layout.hidden.includes(id));
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
