"use client";

import * as React from "react";
import {
  LayerCtx,
  SurfaceCtx,
  useSurfaceOptional,
  type LayerMeta,
  type SurfaceApi,
  type SurfaceLayer,
} from "./context";
import type { SurfaceConnectors, SurfaceDescriptor, SurfaceKind } from "./types";
import { kindMeta } from "./kinds";
import { SurfaceChromeProvider } from "./SurfaceShell";
import { SurfaceRouter } from "./SurfaceRouter";
import { makeLayer } from "./SurfaceProvider";

// ============================================================================
// SurfaceStage: the dialog, docked.
//
// A second host for the same descriptors the popup renders. Instead of one
// <dialog> in the top layer, the layers draw into an in-page stage (no scrim,
// no ✕), with a strip of small faces under it. A face in the strip is a
// surface at rest; the stage is the surface it opens into.
//
// The stack behaves as the popup's does: layer 0 is the base (the active
// face's descriptor), `push` adds a layer with a "‹ crumb ·" kicker and a ←,
// `pop` removes it. What differs: the base is never closed (there is nothing
// to close to), and the base's head carries ‹ counter › over the sibling
// faces. A face marked `pushes` (a Book face) is not a sibling: it opens as a
// layer over the current base and is left out of ‹ › and the count.
//
// Layers render through SurfaceRouter, the router the popup uses, under a
// stage-scoped SurfaceApi, so a surface calling useSurface().push / pop /
// close works unchanged. `connectors` are the nearest provider's with
// `custom` merged under this stage's own.
// ============================================================================

export interface StageFace {
  id: string;
  descriptor: SurfaceDescriptor;
  title: string;
  /** Roman numeral or number in the glyph tile, the strip's medallion and the counter. */
  numeral?: string | null;
  kind?: SurfaceKind | string;
  kicker?: string | null;
  teaser?: string | null;
  cover?: string | null;
  /** Opens as a pushed layer over the current base; not in ‹ › order. */
  pushes?: boolean;
  /** Label after ‹ on a layer pushed over this face. Default: the title. */
  crumb?: string | null;
  /** Head counter text for this face ("Overview"). Default: "III / IX" from numerals, else "n / count". */
  counter?: string | null;
  /** Text of the strip medallion when it should differ from `numeral` (an app that numbers the strip 1, 2, 3 and the head I, II, III). */
  mark?: string | null;
}

type CustomRender = (p: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) => React.ReactNode;

export interface SurfaceStageProps {
  faces: StageFace[];
  initialId?: string;
  /** aria-label of the strip's region. */
  label: string;
  /** Merged over the nearest provider's `connectors.custom`. */
  custom?: Record<string, CustomRender>;
  backdrop?: React.ReactNode;
  backdropCaption?: React.ReactNode;
  showStrip?: boolean;
  height?: number | string;
  /** Keep the open face in `?<param>=<id>` (replaceState, never a history entry); read on mount. */
  urlParam?: string | null;
  className?: string;
  onSelect?: (id: string) => void;
  /**
   * "docked" (default): the panel and strip as on a desktop page, unchanged.
   * "phone": a media band above, the panel flowing under it, a dock fixed to the
   * bottom (strip + `dockFoot`), and pushed layers as bottom sheets over a scrim,
   * whatever the viewport width. `height`, `backdrop` and `showStrip` are ignored.
   */
  layout?: "docked" | "phone";
  /** Phone layout: the band above the panel, for the open (base) face. */
  media?: (activeFace: StageFace) => React.ReactNode;
  /** Phone layout: the app's foot inside the dock, under the strip (way back, tour line, counter, Book). */
  dockFoot?: React.ReactNode;
  /** Phone layout: swipe the panel left/right to step between faces. Default true. */
  swipe?: boolean;
  /**
   * A ✕ in the base layer's head, after ‹ counter ›: the stage drawn inside a popup (a `size: "stage"`
   * dialog) passes the popup's close. Absent on a page, where there is nothing to close.
   */
  onClose?: () => void;
}

export interface SurfaceStageApi {
  faces: StageFace[];
  /** The highlighted face: the pushing face while its layer is open, else the base's. */
  activeId: string;
  /** Position of the base face among the non-pushing faces. */
  index: number;
  /** Non-pushing faces. */
  count: number;
  select: (id: string) => void;
  next: () => void;
  prev: () => void;
  push: (d: SurfaceDescriptor) => void;
  pop: () => void;
  /** Layers above the base. */
  depth: number;
}

const StageCtx = React.createContext<SurfaceStageApi | null>(null);

/** The stage a component renders inside, or null outside one. */
export function useSurfaceStage(): SurfaceStageApi | null {
  return React.useContext(StageCtx);
}

function descriptorKey(d: SurfaceDescriptor): string {
  if (d.type === "custom") return `custom:${d.key}:${JSON.stringify(d.props ?? null)}`;
  return `${d.type}:${JSON.stringify(d)}`;
}

function baseLayerFor(face: StageFace): SurfaceLayer {
  const layer = makeLayer(face.descriptor);
  return {
    ...layer,
    meta: {
      ...layer.meta,
      title: face.title,
      kind: face.kind ?? layer.meta.kind,
      size: "stage",
    },
  };
}

interface StageState {
  baseId: string;
  stack: SurfaceLayer[];
  /** The `pushes` face whose layer is on top, if one is. */
  pushedFaceId: string | null;
}

export function SurfaceStage({
  faces,
  initialId,
  label,
  custom,
  backdrop,
  backdropCaption,
  showStrip = true,
  height = 552,
  urlParam = null,
  className,
  onSelect,
  layout = "docked",
  media,
  dockFoot,
  swipe = true,
  onClose,
}: SurfaceStageProps) {
  const parent = useSurfaceOptional();
  const facesRef = React.useRef(faces);
  facesRef.current = faces;

  const firstId = React.useMemo(() => {
    const wanted = initialId ? faces.find((f) => f.id === initialId && !f.pushes) : undefined;
    return (wanted ?? faces.find((f) => !f.pushes) ?? faces[0])?.id ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = React.useState<StageState>(() => {
    const face = faces.find((f) => f.id === firstId);
    return { baseId: firstId, stack: face ? [baseLayerFor(face)] : [], pushedFaceId: null };
  });
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  // ── navigation ───────────────────────────────────────────────────────────

  const selectFace = React.useCallback((id: string) => {
    const face = facesRef.current.find((f) => f.id === id);
    if (!face) return;
    setState((s) => {
      if (face.pushes) {
        const base = s.stack[0];
        if (!base) return s;
        // Re-pressing the open pushing face keeps its layer; any other pushed layers go.
        if (s.pushedFaceId === id && s.stack.length === 2) return s;
        return { ...s, stack: [base, makeLayer(face.descriptor)], pushedFaceId: id };
      }
      if (s.baseId === id && s.stack.length === 1) return s;
      if (s.baseId === id) return { ...s, stack: [s.stack[0]], pushedFaceId: null };
      return { baseId: id, stack: [baseLayerFor(face)], pushedFaceId: null };
    });
    onSelectRef.current?.(id);
  }, []);

  const siblings = React.useMemo(() => faces.filter((f) => !f.pushes), [faces]);
  const index = Math.max(0, siblings.findIndex((f) => f.id === state.baseId));

  // Faces can change under an open base (a stop hidden in the layout editor): fall back to the first face.
  const siblingKey = siblings.map((f) => f.id).join("|");
  React.useEffect(() => {
    if (siblings.length > 0 && !siblings.some((f) => f.id === state.baseId)) selectFace(siblings[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siblingKey, state.baseId]);

  const step = React.useCallback(
    (delta: number) => {
      const list = facesRef.current.filter((f) => !f.pushes);
      const at = list.findIndex((f) => f.id === stateRef.current.baseId);
      const to = list[at + delta];
      if (to) selectFace(to.id);
    },
    [selectFace]
  );
  const next = React.useCallback(() => step(1), [step]);
  const prev = React.useCallback(() => step(-1), [step]);

  // ── the stage-scoped SurfaceApi ──────────────────────────────────────────

  const push = React.useCallback((d: SurfaceDescriptor) => {
    setState((s) => ({ ...s, stack: [...s.stack, makeLayer(d)] }));
  }, []);

  const pop = React.useCallback(() => {
    setState((s) =>
      s.stack.length <= 1
        ? s
        : { ...s, stack: s.stack.slice(0, -1), pushedFaceId: s.stack.length <= 2 ? null : s.pushedFaceId }
    );
  }, []);

  const replace = React.useCallback((d: SurfaceDescriptor) => {
    setState((s) => {
      const layer = makeLayer(d);
      // The base belongs to its face: replacing it would lose the stage size and the face. Push instead.
      if (s.stack.length <= 1) return { ...s, stack: [...s.stack, layer] };
      return { ...s, stack: [...s.stack.slice(0, -1), layer], pushedFaceId: s.stack.length <= 2 ? null : s.pushedFaceId };
    });
  }, []);

  const close = React.useCallback(() => {
    setState((s) => (s.stack.length <= 1 ? s : { ...s, stack: [s.stack[0]], pushedFaceId: null }));
  }, []);

  const open = React.useCallback(
    (d: SurfaceDescriptor) => {
      const key = descriptorKey(d);
      const match = facesRef.current.find((f) => descriptorKey(f.descriptor) === key);
      if (match) return selectFace(match.id);
      // No face carries it: show it over the base, which is never lost.
      setState((s) => ({ ...s, stack: [s.stack[0], makeLayer(d)], pushedFaceId: null }));
    },
    [selectFace]
  );

  const setLayerMeta = React.useCallback((id: number, patch: LayerMeta) => {
    setState((s) => {
      const at = s.stack.findIndex((layer) => layer.id === id);
      if (at === -1) return s;
      const layer = s.stack[at];
      const merged = { ...layer.meta, ...patch };
      if (merged.title === layer.meta.title && merged.kind === layer.meta.kind && merged.size === layer.meta.size) return s;
      const stack = s.stack.slice();
      stack[at] = { ...layer, meta: merged };
      return { ...s, stack };
    });
  }, []);

  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      ({
        ...(parent?.connectors ?? {}),
        custom: { ...(parent?.connectors.custom ?? {}), ...(custom ?? {}) },
      }) as SurfaceConnectors,
    [parent?.connectors, custom]
  );

  const api = React.useMemo<SurfaceApi>(
    () => ({ stack: state.stack, open, push, replace, pop, close, connectors }),
    [state.stack, open, push, replace, pop, close, connectors]
  );

  const activeId = state.pushedFaceId ?? state.baseId;
  const depth = Math.max(0, state.stack.length - 1);

  const stageApi = React.useMemo<SurfaceStageApi>(
    () => ({ faces, activeId, index, count: siblings.length, select: selectFace, next, prev, push, pop, depth }),
    [faces, activeId, index, siblings.length, selectFace, next, prev, push, pop, depth]
  );

  // ── URL: read on mount, replaceState after ───────────────────────────────

  const urlReady = React.useRef(false);
  React.useEffect(() => {
    if (!urlParam || typeof window === "undefined") {
      urlReady.current = true;
      return;
    }
    const wanted = new URLSearchParams(window.location.search).get(urlParam);
    if (wanted && wanted !== stateRef.current.baseId && facesRef.current.some((f) => f.id === wanted && !f.pushes)) {
      selectFace(wanted);
    }
    urlReady.current = true;
  }, [urlParam, selectFace]);

  React.useEffect(() => {
    if (!urlParam || typeof window === "undefined" || !urlReady.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(urlParam) === state.baseId) return;
    url.searchParams.set(urlParam, state.baseId);
    window.history.replaceState(window.history.state, "", url);
  }, [urlParam, state.baseId]);

  // ── head controls and counter ────────────────────────────────────────────

  const baseFace = faces.find((f) => f.id === state.baseId);
  const lastNumeral = siblings[siblings.length - 1]?.numeral;
  const counter =
    baseFace?.counter ??
    (baseFace?.numeral ? `${baseFace.numeral} / ${lastNumeral ?? siblings.length}` : `${index + 1} / ${siblings.length}`);

  const controls = (
    <div className="eac-stage-siblings" role="group" aria-label="Sibling pages">
      <button
        type="button"
        className="eac-surface-iconbtn"
        onClick={prev}
        disabled={index <= 0}
        aria-label="Previous"
      >
        ‹
      </button>
      <span className="eac-stage-counter" aria-live="polite">
        {counter}
      </span>
      <button
        type="button"
        className="eac-surface-iconbtn"
        onClick={next}
        disabled={index >= siblings.length - 1}
        aria-label="Next"
      >
        ›
      </button>
    </div>
  );

  const phone = layout === "phone";

  // Phone: Escape closes the top sheet; a sideways swipe on the panel steps between faces.
  React.useEffect(() => {
    if (!phone || depth === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") pop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phone, depth, pop]);

  const touch = React.useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const blocked = (e.target as HTMLElement).closest?.("input,textarea,select,[role=slider],[data-no-swipe]");
    touch.current = e.touches.length === 1 && t && !blocked && stateRef.current.stack.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touch.current;
    touch.current = null;
    const t = e.changedTouches[0];
    if (!from || !t) return;
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    if (Math.abs(dx) < 56 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    step(dx < 0 ? 1 : -1);
  };

  const heightCss = typeof height === "number" ? `${height}px` : height;
  const pushed = state.stack.length > 1;

  return (
    <SurfaceCtx.Provider value={api}>
      <StageCtx.Provider value={stageApi}>
        <section
          className={`eac-stage${phone ? " eac-stage--phone" : ""}${className ? ` ${className}` : ""}`}
          data-pushed={pushed || undefined}
          data-layout={phone ? "phone" : undefined}
        >
          {phone && media && baseFace ? (
            <div className="eac-stage-media" data-face-id={baseFace.id}>
              {media(baseFace)}
            </div>
          ) : null}
          {backdrop && !phone ? (
            <div className="eac-stage-backdrop" aria-hidden={backdropCaption ? undefined : true}>
              {backdrop}
              {backdropCaption ? <span className="eac-stage-backdrop-caption">{backdropCaption}</span> : null}
            </div>
          ) : null}
          <div
            className="eac-stage-view"
            style={phone ? undefined : { height: heightCss }}
            {...(phone && swipe ? { onTouchStart, onTouchEnd } : {})}
          >
            {state.stack.map((layer, i) => {
              const isTop = i === state.stack.length - 1;
              const beneath = state.stack[i - 1];
              const backLabel = !beneath
                ? null
                : i === 1
                  ? (baseFace?.crumb ?? baseFace?.title ?? beneath.meta.title ?? kindMeta(beneath.meta.kind).label)
                  : (beneath.meta.title ?? kindMeta(beneath.meta.kind).label);
              return (
                <StageLayer
                  key={layer.id}
                  layer={layer}
                  depth={i + 1}
                  isBase={i === 0}
                  isTop={isTop}
                  underPushed={i === 0 && pushed}
                  backLabel={backLabel}
                  onBack={i > 0 ? pop : undefined}
                  controls={i === 0 ? controls : undefined}
                  onClose={i === 0 ? onClose : undefined}
                  glyph={i === 0 ? (baseFace?.numeral ?? null) : null}
                  setLayerMeta={setLayerMeta}
                />
              );
            })}
          </div>
          {phone && pushed ? <button type="button" className="eac-stage-scrim" aria-label="Close" onClick={pop} /> : null}
          {phone ? (
            <div className="eac-stage-dock" data-under={pushed || undefined}>
              <Strip faces={faces} activeId={activeId} baseId={state.baseId} label={label} select={selectFace} phone />
              {dockFoot ? <div className="eac-stage-dock-foot">{dockFoot}</div> : null}
            </div>
          ) : showStrip ? (
            <Strip faces={faces} activeId={activeId} baseId={state.baseId} label={label} select={selectFace} />
          ) : null}
        </section>
      </StageCtx.Provider>
    </SurfaceCtx.Provider>
  );
}

function StageLayer({
  layer,
  depth,
  isBase,
  isTop,
  underPushed,
  backLabel,
  onBack,
  controls,
  onClose,
  glyph,
  setLayerMeta,
}: {
  layer: SurfaceLayer;
  depth: number;
  isBase: boolean;
  isTop: boolean;
  underPushed: boolean;
  backLabel: string | null;
  onBack?: () => void;
  controls?: React.ReactNode;
  onClose?: () => void;
  glyph: string | null;
  setLayerMeta: (id: number, patch: LayerMeta) => void;
}) {
  const setMeta = React.useCallback((patch: LayerMeta) => setLayerMeta(layer.id, patch), [setLayerMeta, layer.id]);
  const layerValue = React.useMemo(
    () => ({ id: layer.id, depth, isTop, meta: layer.meta, setMeta }),
    [layer.id, layer.meta, depth, isTop, setMeta]
  );
  const chrome = React.useMemo(
    () => ({
      onBack,
      onClose,
      backLabel,
      titleId: `eac-surface-title-${layer.id}`,
      glyph,
      glyphFilled: isBase,
      controls,
    }),
    [onBack, onClose, backLabel, layer.id, glyph, isBase, controls]
  );
  // A pushed layer under another pushed layer stays mounted, hidden.
  const hidden = !isBase && !isTop;

  return (
    <div
      className="eac-surface-panel eac-stage-panel"
      data-size={isBase ? "stage" : (layer.meta.size ?? "standard")}
      data-kind={layer.meta.kind ?? "neutral"}
      data-layer={isBase ? "base" : "pushed"}
      data-under={underPushed || undefined}
      role={isBase ? undefined : "group"}
      aria-labelledby={`eac-surface-title-${layer.id}`}
      hidden={hidden || undefined}
      // `inert`: the dimmed base takes no focus or clicks while a layer is over it.
      {...(underPushed ? { inert: true } : {})}
    >
      <LayerCtx.Provider value={layerValue}>
        <SurfaceChromeProvider value={chrome}>
          <SurfaceRouter descriptor={layer.descriptor} />
        </SurfaceChromeProvider>
      </LayerCtx.Provider>
    </div>
  );
}

function Strip({
  faces,
  activeId,
  baseId,
  label,
  select,
  phone,
}: {
  faces: StageFace[];
  activeId: string;
  baseId: string;
  label: string;
  select: (id: string) => void;
  phone?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Phones scroll the strip sideways: keep the open face in view.
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const box = ref.current;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [activeId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const list = faces.filter((f) => !f.pushes);
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset.faceId;
    const at = list.findIndex((f) => f.id === (focusedId ?? baseId));
    const to = list[at + (e.key === "ArrowRight" ? 1 : -1)];
    if (!to) return;
    e.preventDefault();
    select(to.id);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-face-id="${CSS.escape(to.id)}"]`)?.focus());
  };

  return (
    <div className="eac-stage-strip" role="region" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {faces.map((f) => {
        const open = f.id === activeId;
        const meta = kindMeta(f.kind);
        return (
          <button
            key={f.id}
            type="button"
            className="eac-stage-face"
            data-kind={f.kind ?? "neutral"}
            data-face-id={f.id}
            data-open={open || undefined}
            aria-current={open ? "true" : undefined}
            onClick={() => select(f.id)}
          >
            <span
              className="eac-stage-face-cover"
              style={f.cover ? { backgroundImage: `url("${f.cover.replace(/"/g, "%22")}")` } : undefined}
            >
              <span className="eac-stage-face-numeral">{f.mark ?? f.numeral ?? meta.glyph}</span>
              <span className="eac-stage-face-cue" aria-hidden>
                +
              </span>
            </span>
            <span className="eac-stage-face-title">{f.title}</span>
            {phone ? (
              <span className="eac-stage-face-more">
                <span className="eac-stage-face-kicker">{f.kicker ?? meta.label}</span>
              </span>
            ) : f.kicker || f.teaser ? (
              <span className="eac-stage-face-more">
                {f.kicker ? <span className="eac-stage-face-kicker">{f.kicker}</span> : null}
                {f.teaser ? <span className="eac-stage-face-teaser">{f.teaser}</span> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
