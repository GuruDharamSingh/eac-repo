'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { SceneStage } from '../canvas/SceneStage';
import { Thumbstick } from '../gallery/ui/Thumbstick';
import { useMediaQuery } from '../gallery/useMediaQuery';
import { HallwayControls } from './HallwayControls';
import { HungPiece, neighbourPlacements } from './HungPiece';
import { SlotPiece } from './SlotPiece';
import { PieceLights } from './PieceLights';
import { SceneLights } from './SceneLights';
import { normalizeLighting, type SceneLighting } from './lighting';
import { DropTarget } from './DropTarget';
import { ViewRig } from './ViewRig';
import { NUDGE, NUDGE_FAST, placementScale, type Placement } from './layout';
import { placementRatio } from './framing';
import { HALLWAY_VENUE, orderInVenue, type Venue } from './venue';
import { FRAME_STYLES, getFrame, type FrameStyle } from './frames';
import { useHallwayStore, type ViewMode } from './store';
import type { HallwayPiece } from './types';

export interface HallwayExperienceProps {
  /** Every work the hall might show; placements refer to these by id. */
  pieces: readonly HallwayPiece[];
  placements: readonly Placement[];
  /** Curating: pieces can be dropped, moved and selected for framing. */
  editable?: boolean;
  frames?: readonly FrameStyle[];
  height?: number | string;
  className?: string;
  /** A piece was hung, moved or resized. Same `pieceId` means it changed. */
  onPlace?: (placement: Placement) => void;
  /** Delete or Backspace on the selected piece, when curating. */
  onRemove?: (pieceId: string) => void;
  onSelect?: (pieceId: string | null) => void;
  /** Visiting: the panel for the piece the tour is stopped at. */
  renderDetail?: (piece: HallwayPiece, sequence: number, close: () => void) => React.ReactNode;
  fallback?: React.ReactNode;
  /** How the hall first appears. Curating opens on the overview; visiting, on the cutaway. */
  initialView?: ViewMode;
  /** The space to hang in. Defaults to the long hallway. */
  venue?: Venue;
  /** Open the cutaway already looking at this hung piece. */
  focusPieceId?: string | null;
  /**
   * How the room and the picture lamps are lit; partial or absent values take
   * the defaults, which draw each venue as built. Changes apply live.
   */
  lighting?: Partial<SceneLighting> | null;
}

const VIEW_LABELS: Array<[ViewMode, string]> = [
  ['overview', 'Overview'],
  ['wall', 'Wall view'],
  ['walk', 'Walk'],
];

const SCRIM = 'rgba(24, 21, 18, 0.88)';
const PANEL_SURFACE = '#fbf9f5';
const PANEL_INK = '#1d1a16';
const TAP = 44;
/** Pointer travel under which a press on a hung piece is a click, not a carry. */
const CLICK_SLOP = 6;

const pill: React.CSSProperties = {
  minWidth: TAP,
  height: TAP,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(255, 255, 255, 0.22)',
  background: SCRIM,
  color: '#ffffff',
  font: '600 14px/1 system-ui, sans-serif',
  cursor: 'pointer',
  pointerEvents: 'auto',
  touchAction: 'manipulation',
};

/**
 * Carry a work from a tray in the host page. Call from the tray item's
 * `dragstart`; the hall outlines where it would land and reports the drop
 * through `onPlace`. The aspect is the thumbnail's, so the outline has the
 * right shape before the full image has loaded.
 */
export function beginTrayDrag(piece: HallwayPiece, aspect: number, frameId: string | null = null) {
  useHallwayStore.getState().startDrag({
    pieceId: piece.id,
    aspect: aspect > 0 ? aspect : 1,
    heightCm: piece.heightCm ?? null,
    widthCm: piece.widthCm ?? null,
    frameId,
    scale: 1,
    ratio: 'auto',
    source: 'tray',
  });
}

export function endTrayDrag() {
  useHallwayStore.getState().endDrag();
}

/**
 * Bring a hung piece into view and select it — for a host's list of what is
 * on the walls, and for the tour. Side walls are shown in the cutaway, centred
 * on the piece; the two end walls, which the cutaway never faces, by walking
 * up to them.
 */
export function goToPlacement(placement: Placement) {
  const state = useHallwayStore.getState();
  const venue = state.venue!;
  const at = venue.wall.locate(placement.wallId, placement.x);
  if (at && state.viewMode !== 'walk') {
    state.setWall(at.side, at.s);
    useHallwayStore.setState({ selectedId: placement.pieceId });
    return;
  }
  if (state.viewMode !== 'walk') state.setViewMode('walk');
  useHallwayStore.getState().select(placement.pieceId, venue.viewpoint(placement.wallId, placement.x, placement.y));
}

/**
 * A hallway that can be walked, and — when `editable` — hung.
 *
 * Hanging is drag and drop in two forms: a work carried in from a DOM tray
 * (native HTML drag), or a hung work picked up off its wall (pointer drag in
 * the scene). Both feed one store, the canvas works out the landing spot and
 * draws it, and the release commits it. The walking order of whatever is hung
 * is the collection's sequence; `orderInVenue` is the one rule for it.
 */
export function HallwayExperience({
  pieces,
  placements,
  editable = false,
  frames = FRAME_STYLES,
  height = 640,
  className,
  onPlace,
  onRemove,
  onSelect,
  renderDetail,
  fallback,
  initialView,
  venue = HALLWAY_VENUE,
  focusPieceId = null,
  lighting: lightingProp = null,
}: HallwayExperienceProps) {
  const lighting = useMemo(() => normalizeLighting(lightingProp), [lightingProp]);
  // Everything in the scene reads the venue from the store, so it is put there
  // before any of it renders. A host showing a different space remounts the
  // experience (key it by venue id) rather than swapping it underneath.
  if (useHallwayStore.getState().venue !== venue) useHallwayStore.setState({ venue });
  const container = useRef<HTMLDivElement>(null);
  const viewMode = useHallwayStore((s) => s.viewMode);
  const wallSide = useHallwayStore((s) => s.wallSide);
  const setViewMode = useHallwayStore((s) => s.setViewMode);
  const crouching = useHallwayStore((s) => s.crouching);

  // Open on the view this use calls for, starting the cutaway near the entrance.
  useEffect(() => {
    const focus = focusPieceId ? placements.find((p) => p.pieceId === focusPieceId) : undefined;
    const at = focus ? venue.wall.locate(focus.wallId, focus.x) : null;
    useHallwayStore.setState({
      viewMode: initialView ?? (editable ? 'overview' : 'wall'),
      wallSide: at?.side ?? 'L',
      wallS: at?.s ?? Math.min(venue.wall.length / 2, 6),
    });
    // Opening state only: later placements must not pull the camera back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView, editable, venue, focusPieceId]);

  const flipWall = () => {
    const s = useHallwayStore.getState();
    const next = venue.wall.flip(s.wallS, s.wallSide);
    s.setWall(next.side, next.s);
  };
  const slideWall = (screenRight: number) => {
    const s = useHallwayStore.getState();
    // Held within the same bounds as a swipe (ViewRig's slide), so neither end runs off.
    const { length, margin } = venue.wall;
    const next = s.wallS + screenRight * 6 * (s.wallSide === 'L' ? 1 : -1);
    s.setWall(s.wallSide, Math.max(margin, Math.min(length - margin, next)));
  };
  const byId = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);
  const ordered = useMemo(
    () => orderInVenue(venue, placements.filter((p) => byId.has(p.pieceId))),
    [venue, placements, byId],
  );
  // The corner handles read neighbours from here (see HungPiece).
  neighbourPlacements.current = ordered;

  const drag = useHallwayStore((s) => s.drag);
  const target = useHallwayStore((s) => s.target);
  const selectedId = useHallwayStore((s) => s.selectedId);
  const release = useHallwayStore((s) => s.release);
  const isTouch = useMediaQuery('(pointer: coarse)');
  const isNarrow = useMediaQuery('(max-width: 640px)');

  useEffect(() => {
    onSelect?.(selectedId);
  }, [selectedId, onSelect]);

  // A hall outlives the page that mounted it otherwise.
  useEffect(
    () => () => {
      useHallwayStore.setState({ selectedId: null, focus: null, drag: null, target: null, pointer: null });
    },
    [],
  );

  const toNdc = useCallback((clientX: number, clientY: number) => {
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  }, []);

  const commit = useCallback(() => {
    const { drag: d, target: t, endDrag } = useHallwayStore.getState();
    if (d && t?.valid) {
      const existing = placements.find((p) => p.pieceId === d.pieceId);
      onPlace?.({
        pieceId: d.pieceId,
        wallId: t.wallId,
        x: t.x,
        y: t.y,
        frameId: existing?.frameId ?? d.frameId,
        scale: existing ? placementScale(existing) : d.scale,
        ratio: existing?.ratio ?? null,
        crop: existing?.crop ?? null,
        lamp: existing?.lamp ?? null,
      });
    }
    endDrag();
  }, [placements, onPlace]);

  // ── Native drag from a tray ───────────────────────────────────────────────
  const onDragOver = (event: React.DragEvent) => {
    if (!editable || !useHallwayStore.getState().drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    useHallwayStore.getState().setPointer(toNdc(event.clientX, event.clientY));
  };
  const onDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    useHallwayStore.getState().setPointer(null);
  };
  const onDrop = (event: React.DragEvent) => {
    if (!editable) return;
    event.preventDefault();
    commit();
  };

  // ── Picking a hung piece up off the wall ──────────────────────────────────
  const press = useRef<{ x: number; y: number; id: string; aspect: number } | null>(null);

  const onPiecePointerDown = useCallback(
    (placement: Placement) => (event: ThreeEvent<PointerEvent>, aspect: number) => {
      if (!editable || event.button !== 0) return;
      event.stopPropagation();
      press.current = { x: event.clientX, y: event.clientY, id: placement.pieceId, aspect };
      useHallwayStore.getState().setPressing(true);
    },
    [editable],
  );

  useEffect(() => {
    if (!editable) return;
    const onMove = (event: PointerEvent) => {
      const p = press.current;
      const state = useHallwayStore.getState();
      if (p && !state.drag && Math.hypot(event.clientX - p.x, event.clientY - p.y) > CLICK_SLOP) {
        const piece = byId.get(p.id);
        const placement = placements.find((q) => q.pieceId === p.id);
        if (piece && placement) {
          state.startDrag({
            pieceId: p.id,
            aspect: p.aspect,
            heightCm: piece.heightCm ?? null,
            widthCm: piece.widthCm ?? null,
            frameId: placement.frameId,
            scale: placementScale(placement),
            ratio: placementRatio(placement),
            source: 'wall',
          });
        }
      }
      if (useHallwayStore.getState().drag?.source === 'wall') {
        useHallwayStore.getState().setPointer(toNdc(event.clientX, event.clientY));
      }
    };
    const onUp = () => {
      const p = press.current;
      press.current = null;
      const state = useHallwayStore.getState();
      if (state.pressing) state.setPressing(false);
      if (state.drag?.source === 'wall') {
        commit();
      } else if (p) {
        state.select(p.id, state.selectedId === p.id ? state.focus : null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [editable, byId, placements, toNdc, commit]);

  // Escape puts a carried piece back, then clears the selection. Alt turns
  // snapping off while held.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Alt') useHallwayStore.getState().setSnapOff(true);
      if (event.key !== 'Escape') return;
      const state = useHallwayStore.getState();
      if (state.drag) state.endDrag();
      else release();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') useHallwayStore.getState().setSnapOff(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [release]);

  // Curating from the keyboard: arrows nudge the selected piece a centimetre
  // (ten with Shift) within the hang band and the wall; Delete takes it down.
  // Ignored while something else has the keyboard (a field in the host page).
  useEffect(() => {
    if (!editable) return;
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const state = useHallwayStore.getState();
      const id = state.selectedId;
      if (!id || state.drag || state.resize) return;
      const placement = placements.find((p) => p.pieceId === id);
      if (!placement) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onRemove?.(id);
        return;
      }
      const step = event.shiftKey ? NUDGE_FAST : NUDGE;
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowLeft') dx = -step;
      else if (event.key === 'ArrowRight') dx = step;
      else if (event.key === 'ArrowUp') dy = step;
      else if (event.key === 'ArrowDown') dy = -step;
      else return;
      event.preventDefault();
      const face = venue.faces.find((f) => f.id === placement.wallId);
      const size = state.sizes[id];
      if (!face || !size || venue.slots) return;
      const halfSpan = Math.max(0, face.length / 2 - size.width / 2 - 0.05);
      const lowest = venue.hang.minBottom + size.height / 2;
      const highest = Math.max(lowest, venue.hang.maxTop - size.height / 2);
      const x = Math.round(Math.max(-halfSpan, Math.min(halfSpan, placement.x + dx)) * 100) / 100;
      const y = Math.round(Math.max(lowest, Math.min(highest, placement.y + dy)) * 100) / 100;
      if (x === placement.x && y === placement.y) return;
      onPlace?.({ ...placement, x, y });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, placements, venue, onPlace, onRemove]);

  // ── Touring, when visiting ────────────────────────────────────────────────
  const tourIndex = ordered.findIndex((p) => p.pieceId === selectedId);
  const stepTour = (delta: number) => {
    if (ordered.length === 0) return;
    const next =
      tourIndex < 0 ? (delta > 0 ? 0 : ordered.length - 1) : (tourIndex + delta + ordered.length) % ordered.length;
    goToPlacement(ordered[next]!);
  };
  const selectedPiece = selectedId ? byId.get(selectedId) : undefined;
  const selectedStop = tourIndex >= 0 ? ordered[tourIndex] : undefined;

  const hint = drag
    ? target
      ? target.valid
        ? 'Let go to hang it here'
        : venue.slots
          ? 'That frame already holds a work'
          : 'Not enough clear wall here'
      : 'Hold it over a wall'
    : viewMode === 'overview'
      ? editable
        ? 'Drag a work onto any wall · drag to turn the view · click a wall to look at it'
        : 'Drag to turn the view · scroll to zoom · click a wall to look at it'
      : viewMode === 'wall'
        ? editable
          ? 'Drag a work onto the wall · corners resize the selected piece · arrows nudge · Alt: no snapping'
          : 'Swipe or A / D to slide along the walls · flip to see the other wall'
        : isTouch
          ? 'Drag to look · stick to walk'
          : `Drag to look · W A S D to walk · Space to ${crouching ? 'stand' : 'crouch'}`;

  return (
    <div
      ref={container}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={className}
      style={{ position: 'relative', width: '100%' }}
    >
      <SceneStage
        height={height}
        camera={{ position: venue.overview.position, fov: 42, near: 0.05, far: 400 }}
        gl={{ antialias: true }}
        style={{ touchAction: 'none' }}
        containerStyle={{ overscrollBehavior: 'contain' }}
        webglFallback={fallback}
        reducedMotionFallback={fallback ?? undefined}
        overlay={
          <>
            <div
              style={{
                position: 'absolute',
                left: 16,
                top: 16,
                maxWidth: 320,
                padding: '8px 12px',
                borderRadius: 8,
                background: SCRIM,
                color: '#f4f1ec',
                font: '500 12px/1.5 system-ui, sans-serif',
                pointerEvents: 'none',
              }}
            >
              {hint}
            </div>

            {venue.credit && (
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  bottom: 12,
                  font: "400 11px/1.3 system-ui, sans-serif",
                  color: "rgba(244, 241, 236, 0.7)",
                  pointerEvents: "none",
                }}
              >
                {venue.credit}
              </div>
            )}

            {isTouch && !drag && viewMode === 'walk' && <Thumbstick />}

            {/* Seated or standing eye height; Space does the same from the keyboard. */}
            {viewMode === 'walk' && !drag && !(selectedPiece && !editable) && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  useHallwayStore.getState().setCrouching(!crouching);
                }}
                style={{ ...pill, position: 'absolute', right: 16, bottom: 20 }}
              >
                {crouching ? 'Stand' : 'Crouch'}
              </button>
            )}

            {/* How to look: the hall from above, one wall at a time, or on foot. */}
            <div
              role="group"
              aria-label="View"
              style={{
                position: 'absolute',
                right: 16,
                top: 16,
                display: 'flex',
                gap: 4,
                padding: 4,
                borderRadius: 999,
                background: SCRIM,
                pointerEvents: 'auto',
              }}
            >
              {VIEW_LABELS.map(([mode, label]) => {
                const active = mode === viewMode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => (mode === 'wall' ? useHallwayStore.getState().setWall(wallSide, useHallwayStore.getState().wallS) : setViewMode(mode))}
                    style={{
                      height: 34,
                      padding: '0 14px',
                      borderRadius: 999,
                      border: 'none',
                      background: active ? '#faf7f2' : 'transparent',
                      color: active ? '#1d1a16' : '#f4f1ec',
                      font: '600 13px/1 system-ui, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {viewMode === 'wall' && !(selectedPiece && !editable) && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: !editable && ordered.length > 1 ? 76 : 20,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <button type="button" style={pill} onClick={() => slideWall(-1)} aria-label="Slide left">
                  ‹
                </button>
                <button type="button" style={pill} onClick={flipWall}>
                  Flip to the other wall
                </button>
                <button type="button" style={pill} onClick={() => slideWall(1)} aria-label="Slide right">
                  ›
                </button>
              </div>
            )}

            {!editable && ordered.length > 1 && !selectedPiece && (
              <div style={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
                <button type="button" style={pill} onClick={() => stepTour(1)}>
                  Start the walk · {ordered.length} {ordered.length === 1 ? 'piece' : 'pieces'}
                </button>
              </div>
            )}

            {!editable && selectedPiece && selectedStop && (
              <div
                role="dialog"
                aria-modal="false"
                aria-label={`${selectedPiece.title} — details`}
                style={{
                  position: 'absolute',
                  background: PANEL_SURFACE,
                  color: PANEL_INK,
                  overflowY: 'auto',
                  ...(isNarrow
                    ? { left: 0, right: 0, bottom: 0, maxHeight: '60%', borderRadius: '16px 16px 0 0', padding: 16 }
                    : { top: 0, right: 0, bottom: 0, width: 'min(380px, 100%)', padding: 24, boxShadow: '-16px 0 40px rgba(24,21,18,0.28)' }),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button type="button" style={{ ...pill, ...inverted }} onClick={() => stepTour(-1)} aria-label="Previous piece">
                    ‹
                  </button>
                  <button type="button" style={{ ...pill, ...inverted, font: '600 13px/1 system-ui, sans-serif' }} onClick={() => stepTour(1)}>
                    Next ›
                  </button>
                  <span style={{ marginLeft: 'auto', font: '500 12px/1 system-ui, sans-serif', opacity: 0.6 }}>
                    {selectedStop.sequence} of {ordered.length}
                  </span>
                  <button type="button" style={{ ...pill, ...inverted, padding: 0, font: '500 20px/1 system-ui' }} onClick={release} aria-label="Close">
                    ×
                  </button>
                </div>
                {renderDetail ? (
                  renderDetail(selectedPiece, selectedStop.sequence, release)
                ) : (
                  <div>
                    <h2 style={{ margin: 0, font: '600 20px/1.3 Georgia, serif' }}>{selectedPiece.title}</h2>
                    {selectedPiece.artistName && (
                      <p style={{ margin: '6px 0 0', font: '400 14px/1.5 system-ui', opacity: 0.7 }}>{selectedPiece.artistName}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        }
      >
        <SceneLights venue={venue} lighting={lighting} />
        <venue.Shell />
        <ViewRig />
        {viewMode === 'walk' && <HallwayControls />}
        <PieceLights placements={ordered} lamps={lighting.lamps} />
        {ordered.map((placement) => {
          const piece = byId.get(placement.pieceId)!;
          const slot = venue.slots?.find((s) => s.id === placement.wallId);
          if (slot) {
            return (
              <SlotPiece
                key={placement.pieceId}
                piece={piece}
                slot={slot}
                editable={editable}
                lifted={drag?.source === 'wall' && drag.pieceId === placement.pieceId}
                onPointerDown={onPiecePointerDown(placement)}
                onClick={
                  editable
                    ? undefined
                    : (event) => {
                        if (event.delta > 10) return;
                        event.stopPropagation();
                        goToPlacement(placement);
                      }
                }
              />
            );
          }
          return (
            <HungPiece
              key={placement.pieceId}
              piece={piece}
              placement={placement}
              frame={getFrame(placement.frameId, frames)}
              editable={editable}
              lifted={drag?.source === 'wall' && drag.pieceId === placement.pieceId}
              onPointerDown={onPiecePointerDown(placement)}
              onResize={editable ? (scale) => onPlace?.({ ...placement, scale }) : undefined}
              onClick={
                editable
                  ? undefined
                  : (event) => {
                      if (event.delta > 10) return;
                      event.stopPropagation();
                      goToPlacement(placement);
                    }
              }
            />
          );
        })}
        {editable && <DropTarget placements={ordered} frames={frames} />}
      </SceneStage>
    </div>
  );
}

const inverted: React.CSSProperties = {
  background: 'transparent',
  color: PANEL_INK,
  border: '1px solid rgba(29, 26, 22, 0.22)',
};
