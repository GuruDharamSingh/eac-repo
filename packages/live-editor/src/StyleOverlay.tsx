"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CssPanel } from "./CssPanel";
import type { CssVarDef, SaveResult } from "./types";

/**
 * Style pins — the inline half of theming.
 *
 * The full CssPanel lists every variable an app exposes, which is the right
 * tool for an admin repainting a site and the wrong one for "I want THIS box's
 * border a different colour". So a template marks the elements whose look is
 * adjustable:
 *
 *   <aside data-theme-vars="--frame,--frame-width" data-theme-label="Sidebar">
 *
 * and in edit mode each such element gets a paint pin at its top-right corner.
 * Clicking it opens a CssPanel narrowed to just those variables, anchored to
 * the element, previewing live on the page. The attribute names VARIABLES,
 * not values, so the same pin on an IFAC section and on an amrit-canada card
 * means the same thing; each app still decides which variables exist (its
 * CssVarDef[]) and where they are saved (its onSave). Variables the app has
 * not declared are ignored rather than invented.
 *
 * Pins sit top-RIGHT so they never collide with EditOverlay's field pins,
 * which sit top-left of their element.
 */

interface PinState {
  el: Element;
  rect: DOMRect;
  vars: string[];
  label: string;
  key: string;
}

interface Props {
  cssVars: CssVarDef[];
  /** The scope's saved overrides, unmerged. */
  overrides: Record<string, string>;
  onSave: (overrides: Record<string, string>) => Promise<SaveResult>;
  onApplied?: (overrides: Record<string, string>) => void;
}

const PIN = 20;
const PAD = 4;

export function StyleOverlay({ cssVars, overrides, onSave, onApplied }: Props) {
  const [pins, setPins] = useState<PinState[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const pinsRef = useRef<PinState[]>([]);
  const rafRef = useRef<number>(0);

  const known = new Set(cssVars.map((v) => v.name));

  const scan = useCallback(() => {
    const next: PinState[] = [];
    document.querySelectorAll("[data-theme-vars]").forEach((el, index) => {
      const vars = (el.getAttribute("data-theme-vars") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && known.has(s));
      if (vars.length === 0) return;
      next.push({
        el,
        rect: el.getBoundingClientRect(),
        vars,
        label: el.getAttribute("data-theme-label") ?? "Styles",
        key: `${index}:${vars.join(",")}`,
      });
    });
    pinsRef.current = next;
    setPins([...next]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cssVars]);

  const refresh = useCallback(() => {
    const next = pinsRef.current.map((p) => ({ ...p, rect: p.el.getBoundingClientRect() }));
    pinsRef.current = next;
    setPins([...next]);
  }, []);

  useEffect(() => {
    scan();
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(refresh);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", refresh);
      cancelAnimationFrame(rafRef.current);
    };
  }, [scan, refresh]);

  const active = activeKey ? pins.find((p) => p.key === activeKey) : null;

  return (
    <>
      {pins.map(({ key, rect, label }) => {
        const isActive = activeKey === key;
        const isHovered = hoveredKey === key;
        const x = rect.right + window.scrollX - PIN + PAD;
        const y = rect.top + window.scrollY - PAD;
        return (
          <div key={key} style={{ position: "absolute", top: y, left: x, zIndex: 9997 }}>
            {(isHovered || isActive) && (
              <div
                style={{
                  position: "absolute",
                  top: PAD,
                  right: PAD,
                  width: rect.width,
                  height: rect.height,
                  border: `1.5px dashed ${isActive ? "rgba(236,72,153,0.9)" : "rgba(236,72,153,0.5)"}`,
                  borderRadius: 4,
                  pointerEvents: "none",
                }}
              />
            )}
            <button
              type="button"
              onClick={() => setActiveKey(isActive ? null : key)}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey(null)}
              title={`${label} — styles`}
              aria-label={`Edit styles of ${label}`}
              style={pinStyle(isActive, isHovered)}
            >
              ◐
            </button>
            {isHovered && !isActive && <div style={tooltipStyle}>{label}</div>}
          </div>
        );
      })}

      {active && (
        <CssPanel
          key={active.key}
          cssVars={cssVars}
          only={active.vars}
          title={active.label}
          initialOverrides={overrides}
          onSave={onSave}
          onApplied={onApplied}
          anchor={{
            x: active.rect.right + window.scrollX - 300,
            y: active.rect.top + window.scrollY + PIN + 4,
          }}
          onClose={() => setActiveKey(null)}
        />
      )}
    </>
  );
}

function pinStyle(isActive: boolean, isHovered: boolean): React.CSSProperties {
  return {
    width: PIN,
    height: PIN,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isActive
      ? "rgba(236,72,153,1)"
      : isHovered
        ? "rgba(236,72,153,0.85)"
        : "rgba(236,72,153,0.6)",
    boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
    transition: "background 0.12s, transform 0.12s",
    transform: isActive ? "scale(1.15)" : "scale(1)",
    padding: 0,
    fontSize: 11,
    color: "#fff",
    lineHeight: 1,
  };
}

const tooltipStyle: React.CSSProperties = {
  position: "absolute",
  top: PIN + 4,
  right: 0,
  background: "rgba(15,23,42,0.97)",
  color: "rgba(255,255,255,0.9)",
  fontSize: 11,
  fontFamily: "system-ui, sans-serif",
  padding: "6px 10px",
  borderRadius: 6,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  border: "0.5px solid rgba(255,255,255,0.12)",
};
