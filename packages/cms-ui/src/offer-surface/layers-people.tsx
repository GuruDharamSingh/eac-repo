"use client";

import * as React from "react";
import { useSurface } from "../surface/context";
import { useBackToTalk } from "./stack";
import { OfferFrame } from "./OfferFrame";
import { useOfferEnv } from "./env";
import { offerDescriptor, type OfferLayerId, type OfferProps } from "./descriptor";
import { monoWhen } from "./format";
import { SurfaceIcon, type SurfaceIconKind } from "./icons";
import type { SurfaceProfile, SurfaceSiteData } from "./types";

// ============================================================================
// People (owner: lane D, round 2).
//   MemberProfile   the pf-member layer (README "pf-member")
//   ProfileHoverCard the hover card, README section D / frame 5d
//   PersonName      a name that shows the card after a pause (desktop hover)
//                   and opens that person's profile layer on click or tap.
// Styles: layers-people.css (the host imports it beside offer.css).
// ============================================================================

/** A reply a member left on the site. Optional extra on the site data: `data.memberReplies[personId]`. */
export interface MemberReply {
  /** Where it was said, e.g. "Title of the piece". */
  on: string;
  ago: string;
  text: string;
}
type WithReplies = SurfaceSiteData & { memberReplies?: Record<string, MemberReply[]> };

/** Which layer shows a person: the host, a co-host with a site, or a member without a page. */
export function profileLayerFor(data: SurfaceSiteData, id: string | undefined): OfferLayerId {
  if (id && id === data.owner.id) return "pf-owner";
  if (id && data.people[id]?.siteHref) return "pf-guest";
  return "pf-member";
}

/** pf-member: a member has no page and no portrait; the layer lists what they said here. */
export function MemberProfile({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const backToTalk = useBackToTalk();
  const who: SurfaceProfile | undefined = env.findProfile(props.key);
  const replies = (env.data as WithReplies).memberReplies?.[props.key ?? ""] ?? [];
  const name = who?.name ?? "Member";
  return (
    <OfferFrame
      gk="pf"
      kicker="Member"
      title={name}
      status={replies.length > 0 ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"} on this site` : undefined}
      primary={{ label: "Reply in the talk", onClick: backToTalk }}
      portrait
      picture={who?.portrait ?? null}
    >
      {who?.role && <span className="osf-role">{who.role}</span>}
      <span className="osf-label is-ruled">Their replies here</span>
      {replies.length > 0 ? (
        <div className="osf-pm-replies">
          {replies.map((r, i) => (
            <div key={i} className="osf-pm-reply">
              <span className="osf-pm-quote">“{r.text}”</span>
              <span className="osf-pm-meta">
                ON {r.on.toUpperCase()} · {r.ago.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className="osf-note">Nothing to show yet.</span>
      )}
      <span className="osf-note is-small osf-pm-note">People who only post here have no page or offers. Their name opens this from anything they write.</span>
    </OfferFrame>
  );
}

/** One mono context line: what this person is doing on the site. */
function contextLine(data: SurfaceSiteData, who: SurfaceProfile, given?: string): { kind: SurfaceIconKind | null; text: string } | null {
  if (given) return { kind: null, text: given };
  if (who.id === data.owner.id && data.featured) {
    const f = data.featured;
    const when = f.when?.start ? ` · ${monoWhen(f.when.start, f.when.timeZone)}` : "";
    return { kind: "evt", text: `ON NOW · ${f.title.toUpperCase()}${when}` };
  }
  if (who.siteHref) {
    let host = who.siteHref;
    try {
      host = new URL(who.siteHref).host;
    } catch {
      /* a relative or malformed link is shown as written */
    }
    return { kind: "ser", text: `CO-HOSTS · ${host.toUpperCase()} ↗` };
  }
  return null;
}

/** The card itself (frame 5d): 270px, bronze top border, caret, portrait, name, role, a bio line, context, actions. */
export function ProfileHoverCard({ profile, context, onProfile, onFollow, className }: { profile: SurfaceProfile; context?: string; onProfile?: (el: HTMLElement) => void; onFollow?: (el: HTMLElement) => void; className?: string }) {
  const env = useOfferEnv();
  const following = env.isFollowing(profile.id);
  const line = contextLine(env.data, profile, context);
  const hasPage = profile.id === env.data.owner.id || Boolean(profile.siteHref);
  return (
    <span className={`osf-pc${className ? ` ${className}` : ""}`} role="dialog" aria-label={profile.name}>
      <i className="osf-pc-caret" aria-hidden />
      <span className="osf-pc-who">
        {profile.portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="osf-pc-av" src={profile.portrait} alt="" />
        ) : (
          <span className="osf-pc-av osf-ph" aria-hidden />
        )}
        <span className="osf-pc-names">
          <span className="osf-pc-name">{profile.name}</span>
          {profile.role && <span className="osf-pc-role">{profile.role}</span>}
        </span>
      </span>
      {profile.bio && <span className="osf-pc-bio">{profile.bio}</span>}
      {line && (
        <span className="osf-pc-ctx">
          {line.kind && <SurfaceIcon kind={line.kind} set={env.data.look.icons} size={11} />}
          {line.text}
        </span>
      )}
      <span className="osf-pc-acts">
        {hasPage && (
          <button type="button" className={`osf-pc-follow${following ? " is-on" : ""}`} onClick={(e) => onFollow?.(e.currentTarget)}>
            {following ? "✓ Following" : "+ Follow"}
          </button>
        )}
        <button type="button" className="osf-pc-open" onClick={(e) => onProfile?.(e.currentTarget)}>
          Profile →
        </button>
      </span>
    </span>
  );
}

/** The product of the CSS `zoom` on an element and its ancestors (1 when none). */
function effectiveZoom(el: Element): number {
  let z = 1;
  for (let e: Element | null = el; e; e = e.parentElement) {
    const v = parseFloat(getComputedStyle(e).zoom);
    if (Number.isFinite(v) && v > 0) z *= v;
  }
  return z;
}

/**
 * A person's name. On a desktop pointer the card opens after a short pause and
 * closes when the pointer leaves both name and card; click or tap (and, with no
 * hover, always) opens the profile layer for that person. No card on touch.
 */
export function PersonName({ id, children, context, className }: { id: string; children?: React.ReactNode; context?: string; className?: string }) {
  const env = useOfferEnv();
  const { open, push, stack } = useSurface();
  const who = env.findProfile(id);
  // Inside a surface a name pushes (the head grows a crumb back); on a page it opens one.
  const go = (d: ReturnType<typeof offerDescriptor>, el: HTMLElement) => (stack.length > 0 ? push(d) : open(d, el));
  const [shown, setShown] = React.useState(false);
  const nameRef = React.useRef<HTMLSpanElement | null>(null);
  const [spot, setSpot] = React.useState<{ x: number; y: number; caret: number; up: boolean } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  React.useEffect(() => clear, []);

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clear();
    timer.current = setTimeout(() => {
      // The card is fixed under the name, so a scrolling popup body never clips it.
      const me = nameRef.current;
      if (me) {
        const r = me.getBoundingClientRect();
        // Keep the card inside the popup panel (it clips) or the window.
        const panel = me.closest(".eac-surface-panel")?.getBoundingClientRect();
        const right = (panel?.right ?? window.innerWidth) - 8;
        const bottom = (panel?.bottom ?? window.innerHeight) - 8;
        // The page and the popup are scaled by CSS zoom (shell.css --ost-z, offer.css --osf-pz): the card is
        // drawn z times larger, and a fixed left/top is multiplied by z too. Sizes here are window pixels.
        const z = effectiveZoom(me);
        const x = Math.max((panel?.left ?? 0) + 8, Math.min(r.left, right - 270 * z));
        const up = r.bottom + 9 * z + 178 * z > bottom && r.top - 9 * z - 178 * z > (panel?.top ?? 0);
        setSpot({ x, y: up ? r.top : r.bottom, caret: Math.max(14, Math.min(250, (r.left + 24 * z - x) / z)), up });
      }
      setShown(true);
    }, 380);
  };
  const leave = () => {
    clear();
    timer.current = setTimeout(() => setShown(false), 160);
  };
  const openProfile = (el: HTMLElement) => {
    setShown(false);
    go(offerDescriptor(profileLayerFor(env.data, id), id), el);
  };
  const openFollow = (el: HTMLElement) => {
    setShown(false);
    go(offerDescriptor(env.isFollowing(id) ? "pf-owner" : "follow", id, env.isFollowing(id) ? undefined : { flow: "fol" }), el);
  };

  return (
    <span className="osf-pn" ref={nameRef} onPointerEnter={enter} onPointerLeave={leave} onKeyDown={(e) => e.key === "Escape" && setShown(false)}>
      <button type="button" className={`osf-namelink${className ? ` ${className}` : ""}`} onClick={(e) => openProfile(e.currentTarget)}>
        {children ?? who?.name ?? "Member"}
      </button>
      {shown && who && spot && (
        <span
          className={`osf-pc-fix${spot.up ? " is-up" : ""}`}
          style={{ left: spot.x, top: spot.y, ["--osf-caret" as string]: `${spot.caret}px` }}
          ref={(el) => {
            // Land the anchor on spot (window pixels). A transformed ancestor (a sliding dialog) makes "fixed"
            // relative to it, and a zoomed ancestor scales left/top: measure both with two probes, then set.
            if (!el) return;
            el.style.left = "0px";
            el.style.top = "0px";
            const a = el.getBoundingClientRect();
            el.style.left = "100px";
            el.style.top = "100px";
            const b = el.getBoundingClientRect();
            const zx = (b.left - a.left) / 100 || 1;
            const zy = (b.top - a.top) / 100 || 1;
            el.style.left = `${(spot.x - a.left) / zx}px`;
            el.style.top = `${(spot.y - a.top) / zy}px`;
            // Keep the drawn card inside its popup panel (or the window): measure it, whatever the zoom does to sizes.
            const card = el.firstElementChild?.getBoundingClientRect();
            if (card) {
              const panel = el.closest(".eac-surface-panel")?.getBoundingClientRect();
              const over = card.right - ((panel?.right ?? window.innerWidth) - 8);
              if (over > 0.5) el.style.left = `${(spot.x - a.left - over) / zx}px`;
            }
          }}
          onPointerEnter={() => clear()}
          onPointerLeave={leave}
        >
          <ProfileHoverCard profile={who} context={context} onProfile={openProfile} onFollow={openFollow} />
        </span>
      )}
    </span>
  );
}
