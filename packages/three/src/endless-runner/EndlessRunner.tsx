'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SceneStage } from '../canvas/SceneStage';
import { useMediaTextures } from '../hooks/useMediaTextures';
import { RunnerScene } from './RunnerScene';
import { randomTheme, type RunnerTheme } from './themes';
import type { RunnerInput, RunnerWorld } from './world';

export interface RunnerArtwork {
  /** Media path without a size hint; widths are requested as needed. */
  src: string;
  title?: string;
  artist?: string;
  /** Listing to link to. Omit and no link is shown. */
  href?: string | null;
}

export interface EndlessRunnerProps {
  title?: string;
  subtitle?: string;
  height?: number | string;
  /** Fixed theme. Omit to draw a different one each run. */
  theme?: RunnerTheme;
  /** Images to texture the obstacles with — `/api/media/...` paths are fine. */
  obstacleImageUrls?: readonly string[];
  /** The runner's face. An avatar URL belongs here. */
  playerImageUrl?: string | null;
  /** Tiled and scrolled underfoot as the ground. */
  groundImageUrl?: string | null;
  /**
   * Paintings to stand beside the road and hang on obstacles. Fetched only
   * when a run starts, so a page carrying this game pays nothing for them
   * unless somebody plays. Colliding with one credits it on the end screen.
   */
  artwork?: readonly RunnerArtwork[];
  /** Grow into a centred overlay for the duration of a run. */
  expandOnPlay?: boolean;
  onGameOver?: (score: number) => void;
}

const FONT = "'VT323', ui-monospace, SFMono-Regular, Menlo, monospace";
const TAP_SLOP = 24;
const MAX_ARTWORK = 6;
const TEXTURE_WIDTH = 512;
const DETAIL_WIDTH = 1024;
const ARTWORK_TEXTURE_OPTIONS = { maxSize: TEXTURE_WIDTH };

// Counted, because a page may carry more than one of these: without it the
// second to open captures `hidden` as the value to restore and the page is
// left unscrollable once both close.
let scrollLocks = 0;
let restoreOverflow = '';

function lockScroll(): void {
  if (scrollLocks === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
}

function unlockScroll(): void {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = restoreOverflow;
}

/** Asks the media route for a sized variant rather than the master. */
function withWidth(src: string, width: number): string {
  return `${src}${src.includes('?') ? '&' : '?'}w=${width}`;
}

export function EndlessRunner({
  title = 'SUPER HOPPER',
  subtitle = 'MY CUTE ADVENTURE',
  height = 460,
  theme: fixedTheme,
  obstacleImageUrls,
  playerImageUrl,
  groundImageUrl,
  artwork,
  expandOnPlay = true,
  onGameOver,
}: EndlessRunnerProps) {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [runId, setRunId] = useState(0);
  const [theme, setTheme] = useState<RunnerTheme>(() => fixedTheme ?? randomTheme());
  const [isTouch, setIsTouch] = useState(false);
  const worldRef = useRef<RunnerWorld | null>(null);

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  // A sidebar column is too narrow to actually play in, so a run takes over the
  // screen and hands it back when the visitor is done.
  const expanded = expandOnPlay && phase !== 'idle';
  /** Collapsed into a tile, which may be only a couple of hundred px wide. */
  const compact = !expanded;

  useEffect(() => {
    if (!expanded) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhase('idle');
    };
    lockScroll();
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unlockScroll();
    };
  }, [expanded]);

  const obstacleUrls = useMemo(() => obstacleImageUrls ?? [], [obstacleImageUrls]);
  const playerUrls = useMemo(() => (playerImageUrl ? [playerImageUrl] : []), [playerImageUrl]);
  const groundUrls = useMemo(() => (groundImageUrl ? [groundImageUrl] : []), [groundImageUrl]);

  const pieces = useMemo(() => (artwork ?? []).slice(0, MAX_ARTWORK), [artwork]);

  // Gallery originals are many megabytes each, so they are fetched only once a
  // run is under way, at the width actually needed.
  const artworkUrls = useMemo(
    () => (phase === 'idle' ? [] : pieces.map((p) => withWidth(p.src, TEXTURE_WIDTH))),
    [phase, pieces],
  );

  const pieceByTextureUrl = useMemo(
    () => new Map(pieces.map((p) => [withWidth(p.src, TEXTURE_WIDTH), p])),
    [pieces],
  );

  const obstacleTextures = useMediaTextures(obstacleUrls);
  const playerTexture = useMediaTextures(playerUrls)[0] ?? null;
  const groundTexture = useMediaTextures(groundUrls)[0] ?? null;
  const artworkTextures = useMediaTextures(artworkUrls, ARTWORK_TEXTURE_OPTIONS);

  const send = useCallback((action: RunnerInput) => {
    worldRef.current?.input(action);
  }, []);

  const start = useCallback(() => {
    setTheme(fixedTheme ?? randomTheme());
    setHitPiece(null);
    setScore(0);
    setRunId((id) => id + 1);
    setPhase('playing');
  }, [fixedTheme]);

  const [hitPiece, setHitPiece] = useState<RunnerArtwork | null>(null);

  const crash = useCallback(
    (finalScore: number, hitSrc: string | null) => {
      setScore(finalScore);
      setHitPiece(hitSrc ? (pieceByTextureUrl.get(hitSrc) ?? null) : null);
      setPhase('over');
      onGameOver?.(Math.floor(finalScore));
    },
    [onGameOver, pieceByTextureUrl],
  );

  // Arrow keys scroll the page, so they are only claimed while a run is
  // actually in progress — this is one section of a longer page, not a game
  // that owns the whole window.
  useEffect(() => {
    if (phase !== 'playing') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const action: RunnerInput | null =
        event.code === 'ArrowLeft'
          ? 'left'
          : event.code === 'ArrowRight'
            ? 'right'
            : event.code === 'ArrowUp' || event.code === 'Space'
              ? 'jump'
              : null;
      if (!action) return;
      event.preventDefault();
      send(action);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, send]);

  const gesture = useRef<{ x: number; y: number; onButton: boolean } | null>(null);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    const target = event.target as HTMLElement | null;
    gesture.current = {
      x: touch.clientX,
      y: touch.clientY,
      onButton: Boolean(target?.closest('button')),
    };
  };

  // Tap anywhere to jump, swipe to change lane — so the game is playable
  // one-thumbed even without aiming for the on-screen buttons.
  const onTouchEnd = (event: React.TouchEvent) => {
    const origin = gesture.current;
    const touch = event.changedTouches[0];
    gesture.current = null;
    if (!origin || !touch || origin.onButton || phase !== 'playing') return;

    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;

    if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) send('jump');
    else if (Math.abs(dx) > Math.abs(dy)) send(dx > 0 ? 'right' : 'left');
    else if (dy < 0) send('jump');
  };

  const touchButton = (label: string, action: RunnerInput, grow: number) => (
    <button
      type="button"
      aria-label={action}
      onPointerDown={(event) => {
        event.preventDefault();
        send(action);
      }}
      style={{
        pointerEvents: 'auto',
        flex: grow,
        minHeight: 64,
        fontFamily: FONT,
        fontSize: '1.75rem',
        color: '#fff',
        background: 'rgba(0,0,0,0.35)',
        border: '2px solid rgba(255,255,255,0.45)',
        borderRadius: 12,
        cursor: 'pointer',
        touchAction: 'none',
      }}
    >
      {label}
    </button>
  );

  const startButton = (
    <button
      type="button"
      onClick={start}
      style={{
        pointerEvents: 'auto',
        background: '#fff',
        color: '#222',
        border: 'none',
        padding: compact ? '0.35rem 0.9rem' : '0.6rem 1.5rem',
        fontSize: compact ? '1.1rem' : '1.75rem',
        fontFamily: FONT,
        cursor: 'pointer',
        boxShadow: compact ? '0 4px 0 #999' : '0 6px 0 #999',
        whiteSpace: 'nowrap',
      }}
    >
      {phase === 'over' ? 'TRY AGAIN' : 'PRESS START'}
    </button>
  );

  const overlay = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: FONT,
        color: '#fff',
      }}
    >
      {phase === 'playing' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: compact ? 8 : 16,
              left: compact ? 8 : 16,
              fontSize: compact ? '1.1rem' : '2rem',
              textShadow: '2px 2px #000',
            }}
          >
            SCORE: {Math.floor(score)}
          </div>
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              fontSize: '1.1rem',
              textAlign: 'right',
              lineHeight: 1.4,
              padding: '0.6rem 0.8rem',
              borderRadius: 10,
              border: '2px solid rgba(255,255,255,0.3)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            {isTouch ? (
              <>
                TAP JUMP
                <br />
                SWIPE MOVE
              </>
            ) : (
              <>
                ← → MOVE
                <br />↑ JUMP
              </>
            )}
          </div>

          {isTouch && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 12,
                display: 'flex',
                gap: 10,
              }}
            >
              {touchButton('◀', 'left', 1)}
              {touchButton('JUMP', 'jump', 1.4)}
              {touchButton('▶', 'right', 1)}
            </div>
          )}
        </>
      )}

      {phase !== 'playing' && (
        <div
          // Centred by filling the stage rather than by translating a box off
          // its own middle: the panel can then never extend past the edges of
          // a small tile, taking its buttons out of reach with it.
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: compact ? 8 : 16,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
        <div
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            overflowY: 'auto',
            boxSizing: 'border-box',
            textAlign: 'center',
            background: 'rgba(0,0,0,0.55)',
            padding: compact ? '0.75rem 1rem' : '1.25rem 2rem',
            borderRadius: '1rem',
            border: compact ? '2px solid #fff' : '4px solid #fff',
            backdropFilter: 'blur(4px)',
          }}
        >
          {phase === 'over' && hitPiece && !compact ? (
            <div
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <img
                src={withWidth(hitPiece.src, DETAIL_WIDTH)}
                alt={hitPiece.title ?? 'Artwork'}
                // Capped in pixels, not viewport units: this sits inside a
                // container whose size has nothing to do with the viewport's.
                style={{
                  maxWidth: '100%',
                  maxHeight: 300,
                  objectFit: 'contain',
                  border: '3px solid #fff',
                }}
              />
              <div style={{ textAlign: 'left', minWidth: 180, maxWidth: 280 }}>
                <h3 style={{ fontSize: '2rem', margin: 0, color: '#ffd700', textShadow: '3px 3px #ff6b6b', lineHeight: 1 }}>
                  GAME OVER
                </h3>
                <p style={{ fontSize: '1.2rem', margin: '0.25rem 0 0.75rem' }}>SCORE: {Math.floor(score)}</p>
                <p style={{ fontSize: '1.4rem', margin: 0 }}>{hitPiece.title ?? 'Untitled'}</p>
                {hitPiece.artist && (
                  <p style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', opacity: 0.8 }}>
                    by {hitPiece.artist}
                  </p>
                )}
                {hitPiece.href && (
                  <p style={{ margin: '0 0 0.75rem' }}>
                    <a
                      href={hitPiece.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ pointerEvents: 'auto', color: '#7fd7ff', fontSize: '1.1rem' }}
                    >
                      VIEW IN SHOP &rarr;
                    </a>
                  </p>
                )}
                {startButton}
              </div>
            </div>
          ) : (
            <>
              <h3
                style={{
                  fontSize: compact ? '1.5rem' : '3rem',
                  margin: 0,
                  color: '#ffd700',
                  textShadow: compact ? '2px 2px #ff6b6b' : '3px 3px #ff6b6b',
                  lineHeight: 1,
                }}
              >
                {phase === 'over' ? 'GAME OVER' : title}
              </h3>
              <p
                style={{
                  fontSize: compact ? '0.95rem' : '1.5rem',
                  margin: compact ? '0.35rem 0 0.6rem' : '0.5rem 0 1.25rem',
                  textTransform: 'uppercase',
                }}
              >
                {phase === 'over' ? `SCORE: ${Math.floor(score)}` : subtitle}
              </p>
              {startButton}
              {phase === 'idle' && !compact && (
                <p style={{ margin: '1rem 0 0', fontSize: '0.95rem', opacity: 0.65 }}>
                  after{' '}
                  <a
                    href="https://codepen.io/holasoymalva/pen/XJKdqVj"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', pointerEvents: 'auto' }}
                  >
                    SUPER HOPPER
                  </a>{' '}
                  by holasoymalva
                </p>
              )}
            </>
          )}
        </div>
        </div>
      )}
    </div>
  );

  const stage = (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      // Without this a vertical swipe scrolls the page instead of jumping.
      style={{ touchAction: phase === 'playing' ? 'none' : 'auto', height: expanded ? '100%' : undefined }}
    >
      <SceneStage
        height={expanded ? '100%' : height}
        overlay={overlay}
        // Shadow passes and high DPR are what actually cost a phone GPU here;
        // the geometry is trivial either way.
        shadows={!isTouch}
        dpr={isTouch ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 7, 10], fov: 60, near: 0.1, far: 100 }}
        webglFallback={
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', opacity: 0.7 }}>
            This game needs WebGL, which this browser has turned off.
          </div>
        }
      >
        <RunnerScene
          runId={runId}
          theme={theme}
          obstacleTextures={obstacleTextures}
          playerTexture={playerTexture}
          groundTexture={groundTexture}
          artworkTextures={artworkTextures}
          paused={phase !== 'playing'}
          worldRef={worldRef}
          onScore={setScore}
          onCrash={crash}
        />
      </SceneStage>
    </div>
  );

  if (!expanded) return stage;

  return (
    <>
      {/* Keeps the column from collapsing while the run is overlaid. */}
      <div
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          display: 'grid',
          placeItems: 'center',
          fontFamily: FONT,
          fontSize: '1.25rem',
          opacity: 0.55,
        }}
      >
        PLAYING…
      </div>
      {createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.82)',
            display: 'grid',
            placeItems: 'center',
            padding: '2vmin',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 'min(1000px, 96vw)',
              height: 'min(620px, 84vh)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 0 0 4px #fff',
            }}
          >
            <button
              type="button"
              onClick={() => setPhase('idle')}
              aria-label="Close game"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 2,
                width: 44,
                height: 44,
                fontFamily: FONT,
                fontSize: '1.75rem',
                lineHeight: 1,
                color: '#fff',
                background: 'rgba(0,0,0,0.45)',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            {stage}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
