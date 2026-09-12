"use client";

import * as React from "react";
import {
  LayerCtx,
  SurfaceCtx,
  type LayerMeta,
  type SurfaceApi,
  type SurfaceLayer,
} from "./context";
import type { SurfaceConnectors, SurfaceDescriptor } from "./types";
import { kindMeta } from "./kinds";
import { SurfaceChromeProvider } from "./SurfaceShell";
import { SurfaceRouter } from "./SurfaceRouter";
import { parseDescriptor, readSurfaceParam, serializeDescriptor, urlWithSurface } from "./url";

// ============================================================================
// One <dialog> per app, a stack of surfaces inside it.
//
// Why one element rather than a dialog per feature: a flow that goes calendar
// → a day → "add something" → the thing you added is ONE thing opening and
// changing, not four popups. Stacking inside a single dialog keeps the
// backdrop still, keeps focus inside, and gives every layer the same
// masthead with a "‹ back" to the one beneath.
//
// Why native <dialog>: it already does the hard parts — top layer, backdrop,
// focus trap, Escape — and this package must not carry Radix or Mantine,
// because it is imported by apps that carry neither. `cancel` (Escape) is
// intercepted so it pops a layer instead of closing everything.
//
// The URL carries the top layer when it can (`?surface=thread:…`), so a
// meeting popup is a link someone can paste, a reload reopens it, and the
// browser's Back closes it. Layer changes replaceState; only the first open
// pushes, so Back never has to be pressed four times to get out.
// ============================================================================

export interface SurfaceProviderProps {
  connectors: SurfaceConnectors;
  children: React.ReactNode;
  /** Open from `?surface=` on load. Default true. */
  syncUrl?: boolean;
}

let nextId = 1;

function initialMeta(d: SurfaceDescriptor): LayerMeta {
  switch (d.type) {
    case "thread":
      return {
        title: d.preview?.title ?? null,
        kind: d.preview?.kind ?? "neutral",
        size: kindMeta(d.preview?.kind).size,
      };
    case "compose":
      return {
        title: d.kind ? `${d.threadId ? "Edit" : "New"} ${kindMeta(d.kind).label.toLowerCase()}` : "Compose",
        kind: d.kind ?? "compose",
        size: d.kind ? (d.tier === "quick" || (d.prefill && d.tier !== "full") ? "compact" : "standard") : "standard",
      };
    case "calendar":
      return { title: "Calendar", kind: "calendar", size: "wide" };
    case "gallery":
      return { title: d.title ?? "Gallery", kind: "gallery", size: "wide" };
    case "write":
      return { title: d.threadId ? "Edit" : "New post", kind: "post", size: "full" };
    case "board":
      return { title: "Board", kind: "board", size: "full" };
    case "boardCard":
      return { title: d.preview?.title ?? null, kind: "board", size: "standard" };
    case "forum":
      return { title: "Forum", kind: "forum", size: "wide" };
    case "profile":
      return { title: d.target ? "Organisation" : "Your profile", kind: "neutral", size: "wide" };
    case "centerLayout":
      return { title: "Arrange the center", kind: "neutral", size: "wide" };
    case "define":
      return { title: d.term, kind: "define", size: "compact" };
    case "custom":
      return { title: d.title ?? null, kind: d.kind ?? "neutral", size: d.size ?? "standard" };
  }
}

function makeLayer(d: SurfaceDescriptor): SurfaceLayer {
  return { id: nextId++, descriptor: d, meta: initialMeta(d) };
}

export function SurfaceProvider({ connectors, children, syncUrl = true }: SurfaceProviderProps) {
  const [stack, setStack] = React.useState<SurfaceLayer[]>([]);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const returnFocusTo = React.useRef<Element | null>(null);
  /** True when this provider pushed the history entry the popup lives on. */
  const ownsEntry = React.useRef(false);
  const stackRef = React.useRef(stack);
  stackRef.current = stack;

  // ── URL ──────────────────────────────────────────────────────────────────

  const writeUrl = React.useCallback(
    (top: SurfaceLayer | undefined, mode: "push" | "replace") => {
      if (!syncUrl || typeof window === "undefined") return;
      const value = top ? serializeDescriptor(top.descriptor) : null;
      const url = urlWithSurface(value);
      const state = { ...(window.history.state ?? {}), eacSurface: Boolean(top) };
      if (mode === "push") window.history.pushState(state, "", url);
      else window.history.replaceState(state, "", url);
    },
    [syncUrl]
  );

  // ── the API ──────────────────────────────────────────────────────────────

  const open = React.useCallback(
    (d: SurfaceDescriptor) => {
      const layer = makeLayer(d);
      const wasOpen = stackRef.current.length > 0;
      setStack([layer]);
      if (wasOpen || ownsEntry.current) {
        writeUrl(layer, "replace");
      } else {
        writeUrl(layer, "push");
        ownsEntry.current = true;
      }
    },
    [writeUrl]
  );

  const push = React.useCallback(
    (d: SurfaceDescriptor) => {
      if (stackRef.current.length === 0) return open(d);
      const layer = makeLayer(d);
      setStack((s) => [...s, layer]);
      writeUrl(layer, "replace");
    },
    [open, writeUrl]
  );

  const replace = React.useCallback(
    (d: SurfaceDescriptor) => {
      if (stackRef.current.length === 0) return open(d);
      const layer = makeLayer(d);
      setStack((s) => [...s.slice(0, -1), layer]);
      writeUrl(layer, "replace");
    },
    [open, writeUrl]
  );

  const close = React.useCallback(() => {
    if (stackRef.current.length === 0) return;
    setStack([]);
    if (!syncUrl || typeof window === "undefined") return;
    if (ownsEntry.current) {
      // Back out of the entry we pushed; popstate sees no surface and stays closed.
      ownsEntry.current = false;
      window.history.back();
    } else {
      writeUrl(undefined, "replace");
    }
  }, [syncUrl, writeUrl]);

  const pop = React.useCallback(() => {
    const s = stackRef.current;
    if (s.length <= 1) return close();
    const next = s.slice(0, -1);
    setStack(next);
    writeUrl(next[next.length - 1], "replace");
  }, [close, writeUrl]);

  const setLayerMeta = React.useCallback((id: number, patch: LayerMeta) => {
    setStack((s) => {
      const index = s.findIndex((layer) => layer.id === id);
      if (index === -1) return s;
      const layer = s[index];
      const merged = { ...layer.meta, ...patch };
      // Surfaces call this from effects. Returning the SAME array when nothing
      // changed is what lets React bail out — a fresh array here, even with
      // identical contents, re-renders, re-runs the effect, and loops.
      if (
        merged.title === layer.meta.title &&
        merged.kind === layer.meta.kind &&
        merged.size === layer.meta.size
      ) {
        return s;
      }
      const next = s.slice();
      next[index] = { ...layer, meta: merged };
      return next;
    });
  }, []);

  // ── deep link on load, Back to close ─────────────────────────────────────

  React.useEffect(() => {
    if (!syncUrl) return;
    const initial = parseDescriptor(readSurfaceParam());
    if (initial) {
      // The entry already exists (someone followed a link), so closing must
      // strip the param rather than go back to wherever they came from.
      ownsEntry.current = false;
      setStack([makeLayer(initial)]);
      window.history.replaceState({ ...(window.history.state ?? {}), eacSurface: true }, "");
    }

    const onPop = (e: PopStateEvent) => {
      const hasSurface = Boolean(e.state?.eacSurface);
      if (!hasSurface) {
        ownsEntry.current = false;
        setStack([]);
        return;
      }
      // Forward into an entry that had a surface: reopen from the URL.
      const d = parseDescriptor(readSurfaceParam());
      if (d && stackRef.current.length === 0) {
        ownsEntry.current = true;
        setStack([makeLayer(d)]);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [syncUrl]);

  // ── the element ──────────────────────────────────────────────────────────

  const isOpen = stack.length > 0;

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (isOpen && !el.open) {
      returnFocusTo.current = document.activeElement;
      el.showModal();
      // Land on the panel, not the first input: the first thing in most
      // surfaces is something to read or a choice to make.
      el.focus();
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    if (!isOpen && el.open) {
      el.close();
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
      returnFocusTo.current = null;
    }
  }, [isOpen]);

  const api = React.useMemo<SurfaceApi>(
    () => ({ stack, open, push, replace, pop, close, connectors }),
    [stack, open, push, replace, pop, close, connectors]
  );

  const top = stack[stack.length - 1];
  const pressed = React.useRef(false);

  return (
    <SurfaceCtx.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        className="eac-surface"
        data-size={top?.meta.size ?? "standard"}
        data-kind={top?.meta.kind ?? "neutral"}
        aria-labelledby={top ? `eac-surface-title-${top.id}` : undefined}
        tabIndex={-1}
        // Escape: back a layer, or out when there is only one.
        onCancel={(e) => {
          e.preventDefault();
          pop();
        }}
        // The native `close` also fires when the browser force-closes (a
        // second Escape without activation, say) — keep state honest.
        onClose={() => {
          if (stackRef.current.length > 0) close();
        }}
        // A click that starts AND ends on the backdrop closes. A selection
        // dragged out of the panel does not lose someone their draft.
        onMouseDown={(e) => {
          pressed.current = e.target === e.currentTarget;
        }}
        onMouseUp={(e) => {
          if (pressed.current && e.target === e.currentTarget) close();
          pressed.current = false;
        }}
      >
        {isOpen && (
          <div className="eac-surface-panel">
            {stack.map((layer, index) => (
              <LayerHost
                key={layer.id}
                layer={layer}
                depth={index + 1}
                isTop={index === stack.length - 1}
                beneath={stack[index - 1]}
                setLayerMeta={setLayerMeta}
                onClose={close}
                onBack={index > 0 ? pop : undefined}
              />
            ))}
          </div>
        )}
      </dialog>
    </SurfaceCtx.Provider>
  );
}

/**
 * One layer's providers. Split out so the context values are memoised per
 * layer: an inline object literal would be a new identity every provider
 * render, and every surface effect keyed on `layer` would fire again.
 */
function LayerHost({
  layer,
  depth,
  isTop,
  beneath,
  setLayerMeta,
  onClose,
  onBack,
}: {
  layer: SurfaceLayer;
  depth: number;
  isTop: boolean;
  beneath: SurfaceLayer | undefined;
  setLayerMeta: (id: number, patch: LayerMeta) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const setMeta = React.useCallback(
    (patch: LayerMeta) => setLayerMeta(layer.id, patch),
    [setLayerMeta, layer.id]
  );
  const layerValue = React.useMemo(
    () => ({ id: layer.id, depth, isTop, meta: layer.meta, setMeta }),
    [layer.id, layer.meta, depth, isTop, setMeta]
  );
  const backLabel = beneath ? beneath.meta.title ?? kindMeta(beneath.meta.kind).label : null;
  const chrome = React.useMemo(
    () => ({ onClose, onBack, backLabel, titleId: `eac-surface-title-${layer.id}` }),
    [onClose, onBack, backLabel, layer.id]
  );

  return (
    <div style={{ display: isTop ? "contents" : "none" }}>
      <LayerCtx.Provider value={layerValue}>
        <SurfaceChromeProvider value={chrome}>
          <SurfaceRouter descriptor={layer.descriptor} />
        </SurfaceChromeProvider>
      </LayerCtx.Provider>
    </div>
  );
}
