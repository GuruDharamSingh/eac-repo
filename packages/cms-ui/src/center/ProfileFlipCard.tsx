"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";

// ============================================================================
// The person's card, as a card that turns over.
//
// Front: the portrait, filling the card, with the name and the line under it
// on a plate at the foot. Back: what you can do to the profile — the pattern
// the owner asked for, after Uiverse's flip card (ElSombrero2): a scene with
// perspective, an inner block in `preserve-3d` that rotates 180°, and two
// faces with `backface-visibility: hidden`. The lit sweep behind the back is
// that card's rotating gradient, kept.
//
// Three things the original does not do, which a real card has to:
//
//   1. The flip is STATE, not `:hover` in CSS. A face nobody can see must be
//      `inert`, or a screen reader reads both sides and a tab stop lands on a
//      button facing away from the viewer — and `inert` can only follow a
//      value React knows about. A mouse or pen entering the card sets it;
//      focus sets it for the keyboard; the corner control sets it for touch,
//      where there is no hover at all and the original card is simply dead.
//      The listener sits on the FACE, not on this card: surface.css makes a
//      face's children `pointer-events: none` so the stretched hit area can
//      take the click, so a handler here would only ever fire over the one
//      element that opts back in.
//   2. Colour comes from the surface tokens, not `#151515` and `#ff9966`, so
//      the card is legible on a cream site and a dark one. The sweep is the
//      org's accent.
//   3. Under `prefers-reduced-motion` the card cross-fades instead of
//      rotating, and the sweep and the floating circles stop.
//
// The back is only drawn for someone who may edit this profile — on /center
// that is always the viewer, since the page is their own. Given no actions it
// renders as a plain card with no flip and no control, which is what any
// other site presenting a person gets.
// ============================================================================

export interface ProfileCardAction {
  id: string;
  label: string;
  /** A small line under the label. */
  note?: string | null;
  href?: string | null;
  /** Opens the profile surface in place when a provider is mounted above. */
  surface?: boolean;
}

export function ProfileFlipCard({
  image,
  glyph,
  name,
  subtitle,
  note,
  links,
  actions = [],
  backKicker = "Your profile",
}: {
  image: string | null;
  glyph: string;
  name: string;
  subtitle: string | null;
  note: string | null;
  links: Array<{ label: string | null; url: string }>;
  /** What the back offers. Empty means no back and no flip. */
  actions?: ProfileCardAction[];
  backKicker?: string;
}) {
  const surfaces = useSurfaceOptional();
  const [flipped, setFlipped] = React.useState(false);
  const hasBack = actions.length > 0;
  const root = React.useRef<HTMLDivElement>(null);

  // Hover has to be listened for on the FACE, not on this card.
  //
  // The card is a `preview` inside a SurfaceCard, and surface.css makes every
  // child of a face `pointer-events: none` so the stretched hit area behind
  // them can take the click. React's onPointerEnter therefore never fires
  // here — it only fired on the one element that opts back in with
  // `.eac-face-live`, which is why the card used to turn only over the ✎.
  // The face itself does get pointer events, and a pointer over any part of
  // the card is a pointer over the face, so that is where the listener goes.
  React.useEffect(() => {
    if (!hasBack) return;
    const face = root.current?.closest<HTMLElement>(".eac-face");
    if (!face) return;
    // Which pointer, not which device. A media query ("hover: hover") reports
    // the machine's best input, so a laptop with a touchscreen says yes and
    // then every TAP flips the card — the opposite of what a tap should do
    // there, since the corner control is the tap affordance. The event says
    // what this particular pointer is, which is the thing that matters.
    const hovers = (e: PointerEvent) => e.pointerType === "mouse" || e.pointerType === "pen";
    const enter = (e: PointerEvent) => hovers(e) && setFlipped(true);
    const leave = (e: PointerEvent) => hovers(e) && setFlipped(false);
    face.addEventListener("pointerenter", enter);
    face.addEventListener("pointerleave", leave);
    return () => {
      face.removeEventListener("pointerenter", enter);
      face.removeEventListener("pointerleave", leave);
    };
  }, [hasBack]);

  const show = hasBack && flipped;

  return (
    <div ref={root} className="eac-pcard" data-flipped={show || undefined}>
      <div className="eac-pcard-inner">
        {/* ── Front ────────────────────────────────────────────────────── */}
        <div className="eac-pcard-face eac-pcard-front" inert={show || undefined}>
          <div className="eac-pcard-img">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" />
            ) : (
              // No picture: the original card's drifting blurred circles, which
              // are a better empty state than a grey box with a glyph in it.
              <div className="eac-pcard-glow" aria-hidden>
                <span className="eac-pcard-orb" />
                <span className="eac-pcard-orb" data-orb="right" />
                <span className="eac-pcard-orb" data-orb="bottom" />
                <span className="eac-pcard-mark">{glyph}</span>
              </div>
            )}
          </div>

          {links.length > 0 && (
            <ul className="eac-face-live eac-pcard-links">
              {links.slice(0, 4).map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener">
                    {l.label ?? l.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="eac-pcard-plate">
            <div className="eac-pcard-name">{name}</div>
            {subtitle && <div className="eac-pcard-sub">{subtitle}</div>}
            {note && <div className="eac-pcard-note">{note}</div>}
          </div>

          {hasBack && (
            <button
              type="button"
              className="eac-face-live eac-pcard-turn"
              aria-expanded={show}
              aria-label={`Things you can do to ${name}’s profile`}
              onClick={() => setFlipped(true)}
              onFocus={() => setFlipped(true)}
            >
              <span aria-hidden>✎</span>
            </button>
          )}
        </div>

        {/* ── Back ─────────────────────────────────────────────────────── */}
        {hasBack && (
          <div className="eac-pcard-face eac-pcard-back" inert={!show || undefined}>
            <span className="eac-pcard-sweep" aria-hidden />
            <div className="eac-face-live eac-pcard-back-plate">
              <span className="eac-face-kicker eac-pcard-back-kicker">{backKicker}</span>
              <ul className="eac-pcard-actions">
                {actions.map((a) => {
                  const body = (
                    <>
                      <span className="eac-pcard-action-label">{a.label}</span>
                      {a.note && <span className="eac-pcard-action-note">{a.note}</span>}
                    </>
                  );
                  // A surface action falls back to its href where no provider
                  // is mounted, so the card works on a site without one.
                  if (a.surface && surfaces) {
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={(e) => surfaces.open({ type: "profile" }, e.currentTarget)}
                        >
                          {body}
                        </button>
                      </li>
                    );
                  }
                  return a.href ? (
                    <li key={a.id}>
                      <a href={a.href}>{body}</a>
                    </li>
                  ) : null;
                })}
              </ul>
              <button
                type="button"
                className="eac-pcard-back-close"
                onClick={() => setFlipped(false)}
              >
                Turn back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
