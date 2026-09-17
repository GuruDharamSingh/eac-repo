'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SceneStage } from '../canvas/SceneStage';
import { GalleryScene } from './GalleryScene';
import { Thumbstick } from './ui/Thumbstick';
import { useMediaQuery } from './useMediaQuery';
import { useGalleryStore } from './store';
import { EYE_Y, viewpointForPlinth, viewpointForSlot } from './room';
import { getDesign, ROOM_DESIGNS, type RoomDesignId } from './designs';
import type { GalleryLayout, GalleryPiece } from './types';
import type { Viewpoint } from './store';

export interface GalleryExperienceProps {
  pieces: readonly GalleryPiece[];
  height?: number | string;
  className?: string;

  /** Which room to hold the gallery in. Defaults to the enclosed hall. */
  design?: RoomDesignId;
  /**
   * Offer the visitor a room switcher. The rooms differ in height, daylight
   * and how much wall there is, so which one suits a given collection is a
   * matter of taste rather than a setting to be decided for them.
   */
  allowRoomChange?: boolean;

  /**
   * The panel shown once the visitor has walked up to a piece. This package
   * knows nothing about prices, carts or auctions, so the consuming app draws
   * it — which is also what lets art-auction reuse its own `BuyNowButton`
   * against the same server action the detail page uses, instead of growing a
   * second purchase path that can drift.
   */
  renderDetail?: (piece: GalleryPiece, close: () => void) => React.ReactNode;

  /** Shown instead of the room when WebGL is missing or motion is unwanted. */
  fallback?: React.ReactNode;

  onSelect?: (piece: GalleryPiece) => void;
}

const PANEL_SURFACE = '#fbf9f5';
const PANEL_INK = '#1d1a16';
const SCRIM = 'rgba(24, 21, 18, 0.88)';

/** Comfortable thumb target. Anything smaller is a miss on a phone. */
const TAP_SIZE = 44;

const pill: React.CSSProperties = {
  minWidth: TAP_SIZE,
  height: TAP_SIZE,
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
 * A room you can walk around, with the work in it clickable.
 *
 * Detail is drawn in the DOM over the canvas rather than on a surface inside
 * it: a purchase panel has to be readable by a screen reader, reachable by
 * keyboard and selectable as text, none of which a texture is.
 */
export function GalleryExperience({
  pieces,
  height = 600,
  className,
  design: designId,
  allowRoomChange = false,
  renderDetail,
  fallback,
  onSelect,
}: GalleryExperienceProps) {
  // Controlled when the host passes a design, self-managed when it does not,
  // so a switcher works without the host having to hold the state.
  const [chosen, setChosen] = useState<RoomDesignId | undefined>(designId);
  useEffect(() => setChosen(designId), [designId]);
  const design = useMemo(() => getDesign(chosen), [chosen]);
  const selected = useGalleryStore((s) => s.selected);
  const hoveredId = useGalleryStore((s) => s.hoveredId);
  const release = useGalleryStore((s) => s.release);
  const approach = useGalleryStore((s) => s.approach);
  const [layout, setLayout] = useState<GalleryLayout | null>(null);

  const isTouch = useMediaQuery('(pointer: coarse)');
  const isNarrow = useMediaQuery('(max-width: 640px)');

  // Leaving a piece is Escape everywhere else on the web; the controls
  // deliberately let that key through rather than treating it as movement.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') release();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, release]);

  useEffect(() => {
    if (selected) onSelect?.(selected);
  }, [selected, onSelect]);

  // The room outlives the page that mounted it otherwise, and the next visit
  // opens with a stale piece already selected.
  useEffect(() => () => release(), [release]);

  const hovered = useMemo(() => {
    if (!hoveredId || selected) return null;
    return pieces.find((p) => p.id === hoveredId) ?? null;
  }, [hoveredId, selected, pieces]);

  /**
   * Every piece in the order you would meet them walking the room, so the
   * gallery can be toured start to finish without moving at all. On a phone
   * this is the primary way around; on a desktop it is the way to be sure you
   * have not missed a wall.
   */
  const tour = useMemo<Array<{ piece: GalleryPiece; viewpoint: Viewpoint }>>(() => {
    if (!layout) return [];
    return [
      ...layout.walls.map((slot) => ({ piece: slot.piece, viewpoint: viewpointForSlot(slot, design) })),
      ...layout.plinths.map((slot) => ({ piece: slot.piece, viewpoint: viewpointForPlinth(slot, design) })),
    ];
  }, [layout, design]);

  const tourIndex = useMemo(
    () => (selected ? tour.findIndex((stop) => stop.piece.id === selected.id) : -1),
    [tour, selected],
  );

  const stepTour = useCallback(
    (delta: number) => {
      if (tour.length === 0) return;
      const next =
        tourIndex < 0
          ? delta > 0
            ? 0
            : tour.length - 1
          : (tourIndex + delta + tour.length) % tour.length;
      const stop = tour[next]!;
      approach(stop.piece, stop.viewpoint);
    },
    [tour, tourIndex, approach],
  );

  const close = useCallback(() => release(), [release]);

  const changeRoom = useCallback(
    (id: RoomDesignId) => {
      // A viewpoint is only meaningful in the room it was computed for.
      release();
      setChosen(id);
    },
    [release],
  );

  const omittedCount = layout?.omitted.length ?? 0;
  const position = tourIndex >= 0 ? `${tourIndex + 1} of ${tour.length}` : null;

  const tourButtons = (invert: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={() => stepTour(-1)}
        aria-label="Previous piece"
        style={invert ? { ...pill, ...invertedPill } : pill}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => stepTour(1)}
        style={{
          ...(invert ? { ...pill, ...invertedPill } : pill),
          font: '600 13px/1 system-ui, sans-serif',
        }}
      >
        {tourIndex < 0 ? 'Start the tour' : 'Next piece ›'}
      </button>
    </div>
  );

  return (
    <SceneStage
      height={height}
      className={className}
      // `near` is as far out as it can be without clipping anything a visitor
      // can get to — they stand 1.6m up and are held half a metre off every
      // wall. A tighter near/far ratio is depth precision, which is what
      // stops surfaces flickering against each other in the distance.
      camera={{ position: [0, EYE_Y, design.start[2]], fov: 62, near: 0.1, far: 320 }}
      gl={{ antialias: true }}
      // Without this a drag on a phone is claimed by the page as a scroll, and
      // looking around the room becomes impossible.
      style={{ touchAction: 'none' }}
      containerStyle={{ overscrollBehavior: 'contain' }}
      webglFallback={fallback}
      reducedMotionFallback={fallback ?? undefined}
      overlay={
        <>
          {/* How to move. Top-left, where neither the thumbstick nor the
              detail sheet will ever cover it. */}
          {!selected && (
            <div
              style={{
                position: 'absolute',
                left: 16,
                top: 16,
                maxWidth: 260,
                padding: '8px 12px',
                borderRadius: 8,
                background: SCRIM,
                color: '#f4f1ec',
                font: '500 12px/1.5 system-ui, sans-serif',
                pointerEvents: 'none',
              }}
            >
              {isTouch
                ? 'Drag to look · stick to walk · tap a piece to step up to it'
                : 'Drag to look · W A S D to walk · click a piece to step up to it'}
              {omittedCount > 0 && (
                <div style={{ marginTop: 4, opacity: 0.75 }}>
                  {omittedCount} {omittedCount === 1 ? 'piece is' : 'pieces are'} not on
                  show — the room is full.
                </div>
              )}
            </div>
          )}

          {allowRoomChange && !selected && ROOM_DESIGNS.length > 1 && (
            <div
              style={{
                position: 'absolute',
                right: 16,
                top: 16,
                display: 'flex',
                gap: 6,
                padding: 4,
                borderRadius: 999,
                background: SCRIM,
                pointerEvents: 'auto',
              }}
            >
              {ROOM_DESIGNS.map((room) => {
                const active = room.id === design.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => changeRoom(room.id)}
                    title={room.description}
                    aria-pressed={active}
                    style={{
                      height: 36,
                      padding: '0 14px',
                      borderRadius: 999,
                      border: 'none',
                      background: active ? '#faf7f2' : 'transparent',
                      color: active ? '#1d1a16' : '#f4f1ec',
                      font: '600 13px/1 system-ui, sans-serif',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    {room.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Walking control. Only where there is no keyboard to do it with. */}
          {isTouch && !selected && <Thumbstick />}

          {/* Hover caption, so a visitor knows what they are about to open.
              Pointer-coarse devices have no hover, so it is desktop-only. */}
          {hovered && !isTouch && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 78,
                transform: 'translateX(-50%)',
                padding: '8px 14px',
                borderRadius: 999,
                background: SCRIM,
                color: '#ffffff',
                font: '500 13px/1.4 system-ui, sans-serif',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {hovered.title}
              {hovered.artistName ? (
                <span style={{ opacity: 0.72 }}> · {hovered.artistName}</span>
              ) : null}
            </div>
          )}

          {/* The tour. Sits bottom-centre while you are free in the room, and
              moves into the panel header once a piece is open so the sheet
              cannot bury it. */}
          {!selected && tour.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 20,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }}
            >
              {tourButtons(false)}
            </div>
          )}

          {selected && (
            <div
              role="dialog"
              aria-modal="false"
              aria-label={`${selected.title} — details`}
              style={{
                position: 'absolute',
                background: PANEL_SURFACE,
                color: PANEL_INK,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                // A phone gets a bottom sheet that leaves the room visible
                // above it; anything wider gets a side panel.
                ...(isNarrow
                  ? {
                      left: 0,
                      right: 0,
                      bottom: 0,
                      maxHeight: '64%',
                      borderRadius: '16px 16px 0 0',
                      boxShadow: '0 -16px 40px rgba(24, 21, 18, 0.32)',
                      padding: 16,
                    }
                  : {
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: 'min(420px, 100%)',
                      boxShadow: '-16px 0 40px rgba(24, 21, 18, 0.28)',
                      padding: 24,
                    }),
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {tourButtons(true)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {position && (
                    <span style={{ font: '500 12px/1 system-ui, sans-serif', opacity: 0.6 }}>
                      {position}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Back to the gallery"
                    style={{
                      ...pill,
                      ...invertedPill,
                      minWidth: TAP_SIZE,
                      padding: 0,
                      font: '500 20px/1 system-ui, sans-serif',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {renderDetail ? (
                renderDetail(selected, close)
              ) : (
                <div>
                  <h2 style={{ margin: 0, font: '600 20px/1.3 Georgia, serif' }}>
                    {selected.title}
                  </h2>
                  {selected.artistName && (
                    <p style={{ margin: '6px 0 0', font: '400 14px/1.5 system-ui, sans-serif', opacity: 0.7 }}>
                      {selected.artistName}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      }
    >
      <GalleryScene key={design.id} pieces={pieces} design={design} onLayout={setLayout} />
    </SceneStage>
  );
}

/** The same pill, for use on the panel's light ground. */
const invertedPill: React.CSSProperties = {
  background: 'transparent',
  color: PANEL_INK,
  border: `1px solid rgba(29, 26, 22, 0.22)`,
};
