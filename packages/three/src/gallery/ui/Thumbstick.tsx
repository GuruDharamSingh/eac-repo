import React, { useCallback, useRef, useState } from 'react';
import { clearTouchMove, setTouchMove } from '../controls/touch-input';

const SIZE = 116;
const KNOB = 48;
const RADIUS = (SIZE - KNOB) / 2;

/**
 * Walking control for touch.
 *
 * A phone has no WASD and pointer-lock is not available to it, so without this
 * a visitor can look around and tap a piece but can never cross the room. It
 * is analogue — a small push strolls, a full push walks — because a
 * binary on-screen d-pad in a gallery makes every movement feel like a lurch.
 *
 * Pointer capture is what makes it usable: the thumb routinely slides outside
 * a 116px circle mid-drag, and without capture the stick would stick on.
 */
export function Thumbstick() {
  const ref = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);

    const distance = Math.hypot(dx, dy);
    const clamped = distance > RADIUS ? RADIUS / distance : 1;
    const x = dx * clamped;
    const y = dy * clamped;

    setKnob({ x, y });
    setTouchMove(x / RADIUS, y / RADIUS);
  }, []);

  const start = (event: React.PointerEvent<HTMLDivElement>) => {
    active.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    update(event);
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (active.current !== event.pointerId) return;
    update(event);
  };

  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    if (active.current !== event.pointerId) return;
    active.current = null;
    setKnob({ x: 0, y: 0 });
    clearTouchMove();
  };

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Walk around the gallery"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: 'absolute',
        left: 20,
        bottom: 20,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        background: 'rgba(24, 21, 18, 0.34)',
        border: '1px solid rgba(255, 255, 255, 0.35)',
        // Without this the browser claims the gesture as a page scroll and the
        // stick receives only the first event.
        touchAction: 'none',
        pointerEvents: 'auto',
        display: 'grid',
        placeItems: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          width: KNOB,
          height: KNOB,
          borderRadius: '50%',
          background: 'rgba(250, 247, 242, 0.92)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: active.current === null ? 'transform 140ms ease-out' : 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
