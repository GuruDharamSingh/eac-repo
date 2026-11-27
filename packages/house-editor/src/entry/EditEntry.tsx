"use client";

// ============================================================================
// The Edit button (2026-11-23, lane LIVE). Justin's design: ONE small round button replaces "Edit page", "Site style"
// and "Edit wording". On hover, click, or Enter and Space from the keyboard it buds two smaller blobs that separate from
// it: "Live edit" (stay on the page, with a pencil cursor, a tool strip and a bar) and "Edit page" (the page editor).
// Nothing on the page changes until one is chosen. The editor is optional.
//
//   hover       mouse only (a touch has no hover); leaving folds it back after a moment
//   click, tap  opens and keeps it open until a child is chosen, Esc, or a press elsewhere
//   keyboard    Tab to the button, Enter or Space opens, Tab reaches the two children, Esc folds back and returns here
//   motion      the blobs are circles drawn through a "goo" filter, so they stretch out of the parent and let go of it.
//               With reduced motion they simply appear, and the filter is not used at all.
//
// The site mounts it once (layout) and says who may use it; this file knows nothing about a site. A person who may not
// edit is never sent it (the layout decides, and every save checks again), so a visitor gets no button and no markup.
// ============================================================================

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { setLive, setEditing, useEditEntry } from "./store";
import { hasSiteStyle, openProvidedSiteStyle } from "./site-style";

export interface EditEntryProps {
  /**
   * Where "Edit page" goes on a page that has no editor of its own in place (the site's page editor, as the old "Edit
   * this page" link did). Receives the current path; null: this page cannot be edited from here.
   */
  editPageHref?(pathname: string): string | null;
  /** Paths where the button is not shown (the editors, Manage, the hub). A path matches itself and everything under it. */
  hiddenOn?: readonly string[];
  /** Raise the button on a phone, to clear a bottom bar (px). */
  phoneLift?: number;
}

const INK = "#10201e";
const MINT = "#e6f4f1";
const TEAL = "#2a9d8f";

const CSS = `
.ee{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:1000;width:56px;height:56px;font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:${INK}}
.ee *{box-sizing:border-box}
.ee__zone{position:absolute;left:-12px;bottom:-12px;width:80px;height:80px;pointer-events:none}
.ee[data-open="1"] .ee__zone{width:230px;height:190px;pointer-events:auto}
.ee__goo{position:absolute;left:0;bottom:0;width:56px;height:56px;filter:url(#ee-goo) drop-shadow(0 0 1.2px #e6f4f1) drop-shadow(0 0 1.2px #e6f4f1);pointer-events:none;overflow:visible}
.ee__blob{position:absolute;left:0;bottom:0;width:56px;height:56px;border-radius:50%;background:${INK}}
.ee__blob--kid{left:6px;bottom:6px;width:44px;height:44px;transform:translate(0,0) scale(.5);transition:transform .52s cubic-bezier(.3,1.5,.5,1)}
.ee[data-open="1"] .ee__blob--kid{transform:translate(var(--dx),var(--dy)) scale(1)}
.ee[data-open="1"] .ee__blob--b{transition-delay:.07s}
.ee__main{z-index:2;position:absolute;left:0;bottom:0;width:56px;height:56px;border-radius:50%;border:0;background:transparent;color:${MINT};cursor:pointer;display:grid;place-items:center;padding:0}
.ee__main svg{transition:transform .35s cubic-bezier(.3,1.5,.5,1)}
.ee[data-open="1"] .ee__main svg{transform:rotate(-14deg) scale(.92)}
.ee__main:focus-visible,.ee__kid:focus-visible .ee__ico{outline:3px solid ${MINT};outline-offset:2px;box-shadow:0 0 0 6px ${TEAL}}
.ee__kid{z-index:1;position:absolute;left:6px;bottom:6px;width:44px;height:44px;margin:0;padding:0;border:0;background:transparent;color:${MINT};cursor:pointer;font:inherit;transform:translate(var(--dx),var(--dy));visibility:hidden;opacity:0;transition:opacity .2s .12s,visibility 0s .52s}
.ee[data-open="1"] .ee__kid{visibility:visible;opacity:1;transition:opacity .2s .18s,visibility 0s}
.ee__ico{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center}
.ee__label{position:absolute;left:calc(100% + 8px);top:50%;transform:translateY(-50%);white-space:nowrap;background:${MINT};color:${INK};border:1px solid ${INK};border-radius:999px;padding:6px 12px;box-shadow:0 2px 8px rgba(0,0,0,.22)}
.ee__kid:hover .ee__label,.ee__kid:focus-visible .ee__label{background:#fff}
.ee__kid:active .ee__ico{transform:scale(.94)}
/* Some sites square every corner (sunjay: * { border-radius: 0 !important }). The blob is round on every site. */
.ee .ee__blob,.ee .ee__main,.ee .ee__ico{border-radius:50%!important}
.ee .ee__label,.ee .ee__say{border-radius:999px!important}
.ee__say{position:absolute;left:0;bottom:64px;white-space:nowrap;background:#fff;color:#8a2c14;border:1px solid #8a2c14;border-radius:8px;padding:6px 10px;font-weight:600}
@media (max-width:767px){.ee{bottom:calc(16px + var(--ee-lift,0px) + env(safe-area-inset-bottom,0px))}}
@media (prefers-reduced-motion:reduce){
  .ee__goo{filter:none}
  .ee__blob{box-shadow:0 0 0 2px #e6f4f1}
  .ee__blob--kid,.ee__main svg,.ee__kid{transition:none!important}
  .ee__blob--kid{transform:translate(var(--dx),var(--dy)) scale(1);visibility:hidden}
  .ee[data-open="1"] .ee__blob--kid{visibility:visible}
}
`;

const PENCIL = (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 20l1.2-4.6L16.5 4a1.8 1.8 0 012.5 0l1 1a1.8 1.8 0 010 2.5L8.6 18.8z" fill="currentColor" /><path d="M14.5 6l3.5 3.5" stroke={INK} strokeWidth="1.6" /></svg>
);
const LIVE_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 3l14 8-6 1.6L10.6 19z" fill="currentColor" /></svg>
);
const PAGE_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const STYLE_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3a9 9 0 100 18c1.4 0 2-1 2-1.8 0-1-.9-1.4-.9-2.4 0-1 .8-1.6 1.9-1.6H17a4 4 0 004-4c0-4-4-8.2-9-8.2z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="8" cy="11" r="1.3" fill="currentColor" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /><circle cx="16" cy="10" r="1.3" fill="currentColor" /></svg>
);

export function EditEntry(p: EditEntryProps) {
  const entry = useEditEntry();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [say, setSay] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const root = useRef<HTMLDivElement | null>(null);
  const main = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const menuId = useId();

  // Where we are, kept current on client navigation (the layout stays mounted).
  useEffect(() => {
    const read = () => setPath(window.location.pathname);
    read();
    const iv = window.setInterval(read, 400);
    window.addEventListener("popstate", read);
    return () => { window.clearInterval(iv); window.removeEventListener("popstate", read); };
  }, []);

  const fold = useCallback((refocus = false) => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPinned(false);
    if (refocus) main.current?.focus();
  }, []);

  // Esc folds the blobs back (and returns to the button); a press anywhere else does too.
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fold(true); } };
    const press = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) fold(); };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", press, true);
    return () => { document.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", press, true); };
  }, [open, fold]);

  // The hub's Site Builder card links to /?site-style=1: open Site style on arrival, as the old button did.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("site-style") === "1" && hasSiteStyle()) void openProvidedSiteStyle("drawer");
  }, []);

  const hidden = (p.hiddenOn ?? []).some((h) => path === h || path.startsWith(`${h}/`));
  if (entry.editing || entry.live || hidden) return null;

  const href = p.editPageHref?.(path || "/") ?? null;
  const inPlace = !!entry.editPage;
  const canPage = inPlace || !!href;
  // Where "Edit page" leaves the page for the site's page editor, Site style is not inside it: it gets its own small blob.
  const styleChild = !inPlace && hasSiteStyle();

  const kids: Array<{ id: "live" | "page" | "style"; label: string; icon: ReactNode; dx: number; dy: number }> = [
    { id: "live", label: "Live edit", icon: LIVE_ICON, dx: 2, dy: -76 },
    ...(canPage ? [{ id: "page" as const, label: "Edit page", icon: PAGE_ICON, dx: 62, dy: -40 }] : []),
    ...(styleChild ? [{ id: "style" as const, label: "Site style", icon: STYLE_ICON, dx: 70, dy: 2 }] : []),
  ];

  const choose = async (id: "live" | "page" | "style") => {
    fold();
    setSay(null);
    if (id === "live") { setLive(true); return; }
    if (id === "style") { try { await openProvidedSiteStyle("drawer"); } catch { setSay("Could not open Site style. Try again."); } return; }
    try {
      if (entry.editPage) { await entry.editPage(); setEditing(true); }
      else if (href) window.location.assign(href);
    } catch (err) {
      console.error("[edit entry] page editor:", err);
      setSay("Could not open the editor. Try again.");
    }
  };

  const toggle = () => {
    window.clearTimeout(timer.current);
    if (!open) { setOpen(true); setPinned(true); }
    else if (pinned) fold();
    else setPinned(true); // opened by hovering: a click keeps it open
  };

  const style = { "--ee-lift": `${p.phoneLift ?? 0}px` } as CSSProperties;

  return (
    <div
      ref={root}
      className="ee"
      data-de-ui=""
      data-edit-entry=""
      data-open={open ? "1" : "0"}
      style={style}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") { window.clearTimeout(timer.current); setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse" && !pinned) timer.current = window.setTimeout(() => setOpen(false), 260); }}
    >
      <style>{CSS}</style>
      {/* The goo: circles that merge where they touch, so the children stretch out of the parent and let go. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }} focusable="false">
        <defs>
          <filter id="ee-goo" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
          </filter>
        </defs>
      </svg>
      <div className="ee__zone" aria-hidden="true" />
      <div className="ee__goo" aria-hidden="true">
        <span className="ee__blob" />
        {kids.map((k, i) => (
          <span key={k.id} className={`ee__blob ee__blob--kid ee__blob--${i === 0 ? "a" : "b"}`} style={{ "--dx": `${k.dx}px`, "--dy": `${k.dy}px` } as CSSProperties} />
        ))}
      </div>
      {/* The button comes first in the tab order; its two children follow it while they are out. */}
      <button
        ref={main}
        type="button"
        className="ee__main"
        data-edit-main=""
        aria-label="Edit"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      >
        {PENCIL}
      </button>
      <div id={menuId} role="group" aria-label="Edit options">
        {kids.map((k) => (
          <button key={k.id} type="button" className="ee__kid" data-edit-choice={k.id} style={{ "--dx": `${k.dx}px`, "--dy": `${k.dy}px` } as CSSProperties} onClick={() => void choose(k.id)}>
            <span className="ee__ico">{k.icon}</span>
            <span className="ee__label">{k.label}</span>
          </button>
        ))}
      </div>
      {say && <span className="ee__say" role="status">{say}</span>}
    </div>
  );
}
