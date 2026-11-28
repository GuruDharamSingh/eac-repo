"use client";

import * as React from "react";
import { useLayer, useSurface } from "../surface/context";
import { SurfaceIcon, type SurfaceIconKind } from "./icons";
import { useOfferEnv } from "./env";
import { PaymentCancelledNote } from "./cancelled";

// ============================================================================
// The handoff's head / body / foot, drawn inside the existing surface panel.
// Back, close and the crumb come from the provider's stack (useSurface), so
// Esc, the scrim and ?surface= behave as on every other surface. The phone
// bottom sheet is CSS (offer-surface.css, max-width 640px, the system's own
// breakpoint); the three phone head marks are all rendered and chosen by the
// `data-mark` attribute on the root, so server and browser agree.
// ============================================================================

export const KIND_VAR: Record<SurfaceIconKind, string> = {
  evt: "event",
  svc: "service",
  ser: "series",
  art: "artwork",
  wr: "writing",
  talk: "talk",
  pf: "profile",
  share: "share",
  fol: "follow",
  done: "done",
};

export interface HeadAction {
  /** Shown on phones, where the head button is its icon only. */
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface FootButton {
  label: string;
  onClick?: () => void | Promise<void>;
  href?: string;
  download?: string;
  disabled?: boolean;
}

export interface OfferFrameProps {
  gk: SurfaceIconKind;
  kicker: string;
  title: string;
  status?: React.ReactNode;
  primary?: FootButton;
  quiet?: FootButton;
  headAction?: HeadAction | null;
  /** Picture for the phone "thumb" mark (the offer's own picture, a portrait). */
  picture?: string | null;
  /** Profile layers draw a round portrait in the box and thumb marks. */
  portrait?: boolean;
  /** Layers that have no picture fall back from "thumb" to "inline". */
  noThumb?: boolean;
  children: React.ReactNode;
}

function Pic({ src, round }: { src?: string | null; round?: boolean }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`osf-pic${round ? " is-round" : ""}`} src={src} alt="" loading="lazy" />
  ) : (
    <span className={`osf-pic osf-ph${round ? " is-round" : ""}`} />
  );
}

/** The packet's head glyphs, drawn so they do not depend on the reader's font having ↗ or ⤢. */
function HaGlyph({ g }: { g: string }) {
  if (g !== "↗" && g !== "⤢") return <>{g}</>;
  const d = g === "↗" ? "M2.5 9.5 9.5 2.5M4 2.5h5.5V8" : "M2 10 10 2M6 2h4v4M6 10H2V6";
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden style={{ verticalAlign: "-1px" }}>
      <path d={d} />
    </svg>
  );
}

export function OfferFrame(p: OfferFrameProps) {
  const { stack, pop, close } = useSurface();
  const layer = useLayer();
  const env = useOfferEnv();
  const { setMeta } = layer;
  const [busy, setBusy] = React.useState(false);

  // The crumb of the layer above reads this title.
  React.useEffect(() => {
    setMeta({ title: p.title, kind: "neutral", size: "compact" });
  }, [setMeta, p.title]);

  const beneath = layer.depth > 1 ? stack[layer.depth - 2] : undefined;
  const crumb = beneath ? beneath.meta.title || "Back" : null;
  const kv = `var(--os-kind-${KIND_VAR[p.gk]})`;
  const mark = env.data.look.mark;
  const thumbOk = !p.noThumb && (p.portrait || Boolean(p.picture));
  const effMark = mark === "thumb" && !thumbOk ? "inline" : mark;

  const run = async (b: FootButton | undefined) => {
    if (!b?.onClick || busy) return;
    setBusy(true);
    try {
      await b.onClick();
    } finally {
      setBusy(false);
    }
  };

  const footBtn = (b: FootButton, cls: string) =>
    b.href && !b.onClick ? (
      <a className={cls} href={b.href} download={b.download} aria-disabled={b.disabled || undefined}>
        {b.label}
      </a>
    ) : (
      <button type="button" className={cls} disabled={b.disabled || busy} aria-busy={busy || undefined} onClick={() => run(b)}>
        {b.label}
      </button>
    );

  const ha = p.headAction;

  return (
    <div className="osf-layer" data-mark={effMark} data-portrait={p.portrait ? "" : undefined} style={{ ["--osf-kc" as string]: kv }}>
      <i className="osf-grab" aria-hidden />
      <header className="osf-head">
        <span className="osf-mk osf-mk-box" aria-hidden>
          {p.portrait ? <Pic src={p.picture} round /> : <SurfaceIcon kind={p.gk} set={env.data.look.icons} size={17} />}
        </span>
        <span className="osf-mk osf-mk-thumb" aria-hidden>
          <Pic src={p.picture} round={p.portrait} />
          {!p.portrait && (
            <span className="osf-badge">
              <SurfaceIcon kind={p.gk} set={env.data.look.icons} size={11} />
            </span>
          )}
        </span>
        <div className="osf-heads">
          <div className="osf-kicker">
            {crumb && (
              <>
                <button type="button" className="osf-crumb" onClick={pop}>
                  ‹ {crumb}
                </button>
                <span aria-hidden>·</span>
              </>
            )}
            <span className="osf-kicker-icon" aria-hidden>
              <SurfaceIcon kind={p.gk} set={env.data.look.icons} size={12} />
            </span>
            <span>{p.kicker}</span>
          </div>
          <h2 className="osf-title" id={`eac-surface-title-${layer.id}`}>
            {p.title}
          </h2>
        </div>
        <div className="osf-ctl">
          {ha &&
            (ha.href && !ha.onClick ? (
              <a className="osf-hbtn" href={ha.href} aria-label={ha.label}>
                <span className="osf-ha-icon" aria-hidden><HaGlyph g={ha.icon} /></span>
                <span className="osf-ha-text"><HaGlyph g={ha.icon} /> {ha.label}</span>
              </a>
            ) : (
              <button type="button" className="osf-hbtn" onClick={ha.onClick} aria-label={ha.label}>
                <span className="osf-ha-icon" aria-hidden><HaGlyph g={ha.icon} /></span>
                <span className="osf-ha-text"><HaGlyph g={ha.icon} /> {ha.label}</span>
              </button>
            ))}
          <button type="button" className="osf-x" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
      </header>
      <div className="osf-body"><PaymentCancelledNote />{p.children}</div>
      {(p.status || p.primary || p.quiet) && (
        <footer className="osf-foot">
          {p.status ? <span className="osf-status">{p.status}</span> : <span />}
          <div className="osf-btns">
            {p.quiet && footBtn(p.quiet, "osf-btn osf-btn-quiet")}
            {p.primary && footBtn(p.primary, "osf-btn osf-btn-primary")}
          </div>
        </footer>
      )}
    </div>
  );
}
