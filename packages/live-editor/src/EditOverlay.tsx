"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FieldDef } from "./types";
import { FieldPopover } from "./FieldPopover";
import type { SaveFieldPayload, SaveResult } from "./types";

interface PinState {
  def: FieldDef;
  rect: DOMRect;
  el: Element;
}

interface Props {
  fields: FieldDef[];
  onSaveField: (payload: SaveFieldPayload) => Promise<SaveResult>;
}

const PIN = 20;
const PAD = 4;

export function EditOverlay({ fields, onSaveField }: Props) {
  const [pins, setPins] = useState<PinState[]>([]);
  const [activeTrait, setActiveTrait] = useState<string | null>(null);
  const [hoveredTrait, setHoveredTrait] = useState<string | null>(null);
  const pinsRef = useRef<PinState[]>([]);
  const rafRef = useRef<number>(0);

  const traitSet = new Set(fields.map((f) => f.trait));

  const scan = useCallback(() => {
    const seen = new Set<string>();
    const next: PinState[] = [];
    document.querySelectorAll("[data-trait]").forEach((el) => {
      const trait = el.getAttribute("data-trait");
      if (!trait || seen.has(trait) || !traitSet.has(trait)) return;
      seen.add(trait);
      const def = fields.find((f) => f.trait === trait)!;
      if (def.input === "readonly") return;
      next.push({ def, rect: el.getBoundingClientRect(), el });
    });
    pinsRef.current = next;
    setPins([...next]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const refresh = useCallback(() => {
    const next = pinsRef.current.map((p) => ({
      ...p,
      rect: p.el.getBoundingClientRect(),
    }));
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

  const activePin = activeTrait ? pins.find((p) => p.def.trait === activeTrait) : null;

  return (
    <>
      {pins.map(({ def, rect }) => {
        const isActive = activeTrait === def.trait;
        const isHovered = hoveredTrait === def.trait;
        const x = rect.left + window.scrollX - PAD;
        const y = rect.top + window.scrollY - PAD;

        return (
          <div
            key={def.trait}
            style={{ position: "absolute", top: y, left: x, zIndex: 9997, pointerEvents: "auto" }}
          >
            {/* Element highlight ring */}
            {(isHovered || isActive) && (
              <div
                style={{
                  position: "absolute",
                  top: PAD,
                  left: PAD,
                  width: rect.width,
                  height: rect.height,
                  border: `1.5px solid ${isActive ? "rgba(99,102,241,0.9)" : "rgba(99,102,241,0.5)"}`,
                  borderRadius: 4,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Pin badge */}
            <button
              type="button"
              onClick={() => setActiveTrait(isActive ? null : def.trait)}
              onMouseEnter={() => setHoveredTrait(def.trait)}
              onMouseLeave={() => setHoveredTrait(null)}
              title={def.label}
              style={pinStyle(isActive, isHovered)}
              aria-label={`Edit ${def.label}`}
            >
              ✏
            </button>

            {/* Hover tooltip */}
            {isHovered && !isActive && (
              <div style={tooltipStyle}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{def.label}</div>
                {def.hint && (
                  <div style={{ color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.4, maxWidth: 220, whiteSpace: "normal" }}>
                    {def.hint}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {activePin && (
        <FieldPopover
          def={activePin.def}
          rect={activePin.rect}
          onSave={onSaveField}
          onClose={() => setActiveTrait(null)}
        />
      )}
    </>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

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
      ? "rgba(99,102,241,1)"
      : isHovered
        ? "rgba(99,102,241,0.85)"
        : "rgba(99,102,241,0.6)",
    boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
    transition: "background 0.12s, transform 0.12s",
    transform: isActive ? "scale(1.15)" : "scale(1)",
    padding: 0,
    fontSize: 10,
    color: "#fff",
    lineHeight: 1,
  };
}

const tooltipStyle: React.CSSProperties = {
  position: "absolute",
  top: PIN + 4,
  left: 0,
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
  zIndex: 1,
};
