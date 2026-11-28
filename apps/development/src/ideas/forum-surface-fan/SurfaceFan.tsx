"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { fanPoses, PHONE_MAX, type FanTuning } from "./geometry";

// ============================================================================
// SurfaceFan (mock, 2026-11-27): a button on the right edge that fans its tabs out along rays converging on a point
// just past the edge, dims the page, and opens each tab's options to the left in up to two columns (a list, then a
// form or settings). On a phone the button sits bottom right, tabs rise as level chips and options open as a sheet.
//
// Positioned inside its stage (position: relative), not the viewport, so the mock can sit on a page and in a phone frame.
// Keyboard: Esc closes the deepest open level and returns focus one level up (finally to the button); Up/Down move
// between tabs; Enter, Space or Left opens a tab's options; Right goes back; Tab stays inside the fan while it is open.
// ============================================================================

export interface FanApi {
  /** The open second-column key, or null. */
  sub: string | null;
  openSub: (key: string | null) => void;
  close: () => void;
}

export interface FanTab {
  id: string;
  label: string;
  icon: string;
  hint?: string;
  title: string;
  /** First column (opens to the left of the tab). */
  panel: (api: FanApi) => ReactNode;
  /** Second column, further left, for the key passed to openSub. */
  sub?: (key: string, api: FanApi) => ReactNode;
  subTitle?: (key: string) => string;
}

export interface SurfaceFanProps {
  tabs: FanTab[];
  tuning: FanTuning;
  /** Stage size in px (the parent measures it). */
  size: { w: number; h: number };
  /** Transition length for one tab, ms. */
  duration: number;
  /** Delay between tabs, ms. */
  stagger: number;
  /** Backdrop opacity, 0..1. */
  dim: number;
  reduceMotion: boolean;
  /** Controlled open state + selected tab, so other parts of the page (menus) can open the fan at a tab. */
  open: boolean;
  active: string | null;
  sub: string | null;
  onChange: (next: { open: boolean; active: string | null; sub: string | null }) => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !["checkbox", "radio", "button"].includes((el as HTMLInputElement).type)));

export function SurfaceFan(props: SurfaceFanProps) {
  const { tabs, tuning, size, duration, stagger, dim, reduceMotion, open, active, sub, onChange } = props;
  const phone = size.w <= PHONE_MAX;
  const poses = useMemo(() => fanPoses(tabs.length, size.w, size.h, tuning), [tabs.length, size.w, size.h, tuning]);
  const trigger = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fanRef = useRef<HTMLDivElement>(null);
  const col1 = useRef<HTMLElement>(null);
  const col2 = useRef<HTMLElement>(null);
  const subOpener = useRef<HTMLElement | null>(null);
  const [focusTarget, setFocusTarget] = useState<"tab" | "col1" | "col2" | "trigger" | null>(null);

  const activeIndex = tabs.findIndex((t) => t.id === active);
  const activeTab = activeIndex >= 0 ? tabs[activeIndex] : null;

  const setOpen = useCallback(
    (v: boolean) => {
      onChange({ open: v, active: v ? active : null, sub: v ? sub : null });
      setFocusTarget(v ? (active ? "col1" : "tab") : "trigger");
    },
    [active, sub, onChange],
  );
  const choose = (id: string | null, focus: "col1" | "tab" = "col1") => {
    onChange({ open: true, active: id, sub: null });
    setFocusTarget(id ? focus : "tab");
  };
  const api: FanApi = {
    sub,
    openSub: (key) => {
      if (key) subOpener.current = document.activeElement as HTMLElement;
      onChange({ open: true, active, sub: key });
      setFocusTarget(key ? "col2" : "col1");
    },
    close: () => setOpen(false),
  };

  // Move focus after the state that reveals the target has rendered (and after the column's enter transition starts).
  useEffect(() => {
    if (!focusTarget) return;
    const id = window.setTimeout(() => {
      if (focusTarget === "trigger") trigger.current?.focus();
      else if (focusTarget === "tab") tabRefs.current[Math.max(0, activeIndex)]?.focus();
      else if (focusTarget === "col1") (col1.current?.querySelector(FOCUSABLE) as HTMLElement | null)?.focus();
      else if (focusTarget === "col2") (col2.current?.querySelector(FOCUSABLE) as HTMLElement | null)?.focus();
      setFocusTarget(null);
    }, 30);
    return () => window.clearTimeout(id);
  }, [focusTarget, activeIndex]);

  const onFanKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (sub) {
        onChange({ open: true, active, sub: null });
        const back = subOpener.current;
        window.setTimeout(() => (back && document.contains(back) ? back.focus() : col1.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()), 30);
      } else if (active) choose(null);
      else setOpen(false);
      return;
    }
    if (e.key === "Tab" && fanRef.current) {
      const items = [trigger.current, ...Array.from(fanRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))].filter(
        (el): el is HTMLElement => !!el && el.offsetParent !== null,
      );
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next].focus();
    }
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = tabs.length;
    const go = (j: number) => tabRefs.current[(j + n) % n]?.focus();
    if (e.key === "ArrowDown") (e.preventDefault(), go(i + 1));
    else if (e.key === "ArrowUp") (e.preventDefault(), go(i - 1));
    else if (e.key === "Home") (e.preventDefault(), go(0));
    else if (e.key === "End") (e.preventDefault(), go(n - 1));
    else if (e.key === "ArrowLeft") (e.preventDefault(), choose(tabs[i].id));
    else if (e.key === "ArrowRight" && active) (e.preventDefault(), choose(null));
  };

  const listKeys = (e: KeyboardEvent<HTMLElement>, level: 1 | 2) => {
    if (isTextField(e.target)) return;
    const box = level === 1 ? col1.current : col2.current;
    const items = Array.from(box?.querySelectorAll<HTMLElement>("[data-fan-item]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && items.length) {
      e.preventDefault();
      const j = i < 0 ? 0 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[j].focus();
    } else if (e.key === "ArrowLeft" && level === 1 && (document.activeElement as HTMLElement)?.dataset.hasSub) {
      e.preventDefault();
      (document.activeElement as HTMLElement).click();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (level === 2) {
        onChange({ open: true, active, sub: null });
        const back = subOpener.current;
        window.setTimeout(() => back?.focus(), 30);
      } else choose(null, "tab");
    }
  };

  // Submenu placement: right edge 14px left of the active tab's tip, centred on it, kept inside the stage.
  const tip = activeIndex >= 0 ? poses[activeIndex].tip : null;
  const menuStyle: CSSProperties | undefined =
    tip && !phone
      ? { right: Math.max(8, size.w - tip.x + 14), top: Math.min(Math.max(12, tip.y - 150), Math.max(12, size.h - 420)) }
      : undefined;

  const rootStyle = {
    "--fan-dur": `${duration}ms`,
    "--fan-stagger": `${stagger}ms`,
    "--fan-dim": dim,
    "--fan-ox": `${size.w + tuning.offset}px`,
    "--fan-oy": `${size.h / 2}px`,
  } as CSSProperties;

  return (
    <div
      className="sfan"
      data-open={open || undefined}
      data-phone={phone || undefined}
      data-rm={reduceMotion || undefined}
      data-active={active ?? undefined}
      style={rootStyle}
    >
      <div className="sfan-backdrop" aria-hidden onClick={() => setOpen(false)} />
      <button
        ref={trigger}
        type="button"
        className="sfan-trigger"
        aria-expanded={open}
        aria-controls="sfan-fan"
        aria-label={open ? "Close tools" : "Tools and quick navigation"}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (open && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft")) {
            e.preventDefault();
            tabRefs.current[e.key === "ArrowUp" ? tabs.length - 1 : 0]?.focus();
          }
          if (open && e.key === "Escape") (e.preventDefault(), setOpen(false));
          if (open && e.key === "Tab" && fanRef.current) {
            // Keep Tab inside the open fan: the button is the first stop, the last field the last.
            const items = Array.from(fanRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
            if (items.length) (e.preventDefault(), items[e.shiftKey ? items.length - 1 : 0].focus());
          }
        }}
      >
        <span className="sfan-trigger-glyph" aria-hidden>
          {open ? "×" : phone ? "✦" : "‹ ✦"}
        </span>
        {!phone && !open ? <span className="sfan-trigger-label">Tools</span> : null}
      </button>

      <div
        id="sfan-fan"
        ref={fanRef}
        className="sfan-fan"
        role="dialog"
        aria-modal="true"
        aria-label="Tools and quick navigation"
        inert={!open}
        onKeyDown={onFanKey}
      >
        {tabs.map((t, i) => {
          const p = poses[i];
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              className="sfan-tab"
              data-selected={selected || undefined}
              data-dimmed={(active && !selected) || undefined}
              aria-expanded={selected}
              aria-haspopup="true"
              style={
                {
                  left: p.left,
                  top: p.top,
                  width: phone ? undefined : p.width,
                  "--i": i,
                  "--ri": tabs.length - 1 - i,
                  "--open": p.open,
                  "--closed": p.closed,
                  "--label-rot": tuning.level && !phone ? `${-p.angle}deg` : "0deg",
                } as CSSProperties
              }
              onClick={() => choose(selected ? null : t.id, selected ? "tab" : "col1")}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className="sfan-tab-face">
                <span className="sfan-tab-icon" aria-hidden>
                  {t.icon}
                </span>
                <span className="sfan-tab-label">{t.label}</span>
                {t.hint && !phone ? <span className="sfan-tab-hint">{t.hint}</span> : null}
              </span>
            </button>
          );
        })}

        {activeTab ? (
          <div className="sfan-menu" style={menuStyle} key={activeTab.id}>
            {phone && sub && activeTab.sub ? (
              <section className="sfan-col sfan-col2" ref={col2} aria-label={activeTab.subTitle?.(sub) ?? sub} onKeyDown={(e) => listKeys(e, 2)}>
                <header className="sfan-col-head">
                  <button type="button" className="sfan-back" onClick={() => api.openSub(null)}>
                    ‹ {activeTab.title}
                  </button>
                  <span>{activeTab.subTitle?.(sub) ?? sub}</span>
                </header>
                {activeTab.sub(sub, api)}
              </section>
            ) : (
              <>
                <section className="sfan-col sfan-col1" ref={col1} aria-label={activeTab.title} onKeyDown={(e) => listKeys(e, 1)}>
                  <header className="sfan-col-head">
                    {phone ? (
                      <button type="button" className="sfan-back" onClick={() => choose(null, "tab")}>
                        ‹ Tools
                      </button>
                    ) : null}
                    <span>{activeTab.title}</span>
                  </header>
                  {activeTab.panel(api)}
                </section>
                {!phone && sub && activeTab.sub ? (
                  <section className="sfan-col sfan-col2" ref={col2} aria-label={activeTab.subTitle?.(sub) ?? sub} onKeyDown={(e) => listKeys(e, 2)}>
                    <header className="sfan-col-head">
                      <span>{activeTab.subTitle?.(sub) ?? sub}</span>
                    </header>
                    {activeTab.sub(sub, api)}
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
