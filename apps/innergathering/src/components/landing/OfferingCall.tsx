"use client";

import * as React from "react";

/**
 * The offering's Talk room inside the page (landing OfferingsBand).
 *
 * "Join the room" opens the call in the card's right-hand column, in place of
 * "Are you coming?", instead of sending the visitor to Nextcloud. Closing the
 * call brings the RSVP back. Framing is allowed for elkdonis-arts.org by the
 * Nextcloud app eac_embed (docs/reference/nextcloud.md); the new-tab link is
 * always offered for anyone whose browser refuses the frame.
 *
 * The provider renders no element, so the card's grid is unchanged.
 */

/**
 * Scroll the open call to just below the sticky header. Computed from the
 * element's position rather than scrollIntoView: on the landing the call sits
 * in an offer card that clips its contents and is exactly one window tall, and
 * Chrome then ignores scroll-margin and leaves the call's control bar under the
 * header. The offset is --ig-call-top (offering-call.css).
 */
function scrollCallIntoView() {
  const call = document.querySelector<HTMLElement>(".ig-offer-call");
  const card = call?.closest<HTMLElement>(".ig-offer-card") ?? null;
  // Side by side the card's top is the call's top; stacked (narrow screens) the
  // call sits below the card's body, so align the call itself.
  const stacked = Boolean(call && card && call.getBoundingClientRect().top - card.getBoundingClientRect().top > 40);
  const target = stacked ? call : (card ?? call);
  if (!target) return;
  const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ig-call-top")) || 88;
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
}

const CallContext = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function OfferingCallProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  // Bring the call into view when it opens, so it fills the window below the header.
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => scrollCallIntoView());
    return () => cancelAnimationFrame(id);
  }, [open]);
  return <CallContext.Provider value={{ open, setOpen }}>{children}</CallContext.Provider>;
}

export function JoinRoomButton({ className }: { className?: string }) {
  const ctx = React.useContext(CallContext);
  if (!ctx) return null;
  return (
    <button type="button" className={className} aria-expanded={ctx.open} onClick={() => ctx.setOpen(!ctx.open)}>
      {ctx.open ? "Leave the room view" : "Join the room"}
    </button>
  );
}

/**
 * For pages whose "Join the Talk room" is a plain link rendered by a shared
 * component (the thread page's SurfacePage actions): keep the link where it
 * is, and open the call in the CallSlot instead of navigating. Modified clicks
 * (new tab, middle button) are left alone.
 */
export function TalkLinkInterceptor({ talkUrl }: { talkUrl: string }) {
  const ctx = React.useContext(CallContext);
  React.useEffect(() => {
    if (!ctx) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.href !== talkUrl || a.closest(".ig-offer-call")) return;
      e.preventDefault();
      ctx.setOpen(true);
      requestAnimationFrame(() => scrollCallIntoView());
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [ctx, talkUrl]);
  return null;
}

/** The right-hand column: the call when open, otherwise whatever it held (the RSVP). */
export function CallSlot({
  talkUrl,
  title,
  className = "ig-offer-rsvp ig-offer-call",
  children,
}: {
  talkUrl: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(CallContext);
  const frame = React.useRef<HTMLIFrameElement>(null);
  if (!ctx?.open) return <>{children}</>;
  const full = () => {
    const el = frame.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
  };
  return (
    <div className={className}>
      <div className="ig-offer-call-bar">
        <span>{title}</span>
        <span className="ig-offer-call-tools">
          <button type="button" onClick={full}>Full screen</button>
          <a href={talkUrl} target="_blank" rel="noreferrer">New tab</a>
          <button type="button" onClick={() => ctx.setOpen(false)} aria-label="Close the call">Close</button>
        </span>
      </div>
      <iframe
        ref={frame}
        src={talkUrl}
        title={`${title} — Talk room`}
        allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
        allowFullScreen
      />
    </div>
  );
}
