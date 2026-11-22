'use client';

// Shot director: an overlay on the phone's viewfinder (.pc-view) that coaches a
// filmer through a preset's shots in ONE continuous recording. Guides are drawn
// on a canvas above the <video>, so none of them end up in the footage. Taking
// a shot is: Take N -> count-in (on the beat if the shot has one) -> timer ->
// Keep / Again. MARK saves {name, t} in seconds since the recording started.
// The recorder's t0 comes in as `now()`; the takes go out through `onTakes`.

import * as React from 'react';
import type { Aid, CapturePreset, Shot, TakeRecord } from './types';

export interface ShotDirectorProps {
  preset: CapturePreset;
  /** The recorder is running (after Record). Before that the guides show shot 1 and nothing is timed. */
  recording: boolean;
  /** Seconds since the recording started (the recorder's t0). */
  now: () => number;
  /** Every take so far (kept or not), each time the list changes. */
  onTakes: (takes: TakeRecord[]) => void;
  /** Cut: stop the recording. The unfinished take, if any, has been closed first. */
  onCut: () => void;
}

type Phase = 'ready' | 'count' | 'take' | 'keep';
const RING = 245;
const PAD_IN = 0.25; // seconds of handle kept either side of a take
const buzz = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not on every phone */
  }
};
const filmable = (p: CapturePreset) => p.shots.filter((s) => s.by !== 'machine');

export function ShotDirector({ preset, recording, now, onTakes, onCut }: ShotDirectorProps) {
  const shots = React.useMemo(() => filmable(preset), [preset]);
  const [i, setI] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>('ready');
  const [count, setCount] = React.useState<number | null>(null);
  const [takes, setTakes] = React.useState<TakeRecord[]>([]);
  const [hit, setHit] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const wrap = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const ring = React.useRef<SVGCircleElement>(null);
  // Mutable state the canvas loop and timers read without re-rendering.
  const live = React.useRef({
    shot: shots[0] as Shot | undefined,
    phase: 'ready' as Phase,
    takeAt: 0,
    marks: [] as TakeRecord['marks'],
    tilt: null as number | null,
    takes: [] as TakeRecord[],
  });
  live.current.shot = shots[i];
  live.current.phase = phase;
  const timers = React.useRef<number[]>([]);
  const toastT = React.useRef(0);

  const say = (m: string, ms = 1600) => {
    setToast(m);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(null), ms);
  };
  const commit = (next: TakeRecord[]) => {
    live.current.takes = next;
    setTakes(next);
    onTakes(next);
  };
  React.useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(toastT.current);
    },
    []
  );

  // A new roll starts from shot 1.
  React.useEffect(() => {
    if (!recording) return;
    setI(0);
    setPhase('ready');
    commit([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // ----------------------------------------------------------------- the takes
  const shot = shots[i];
  const beat = shot?.aid?.find((a): a is Extract<Aid, { kind: 'beat' }> => a.kind === 'beat');

  async function begin() {
    if (!shot || !recording) return;
    try {
      // iOS asks for motion access on a tap; the level tick is optional.
      const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof DOE.requestPermission === 'function') void DOE.requestPermission().catch(() => {});
    } catch {
      /* ignore */
    }
    live.current.phase = 'count';
    setPhase('count');
    const per = beat ? 60 / beat.bpm : 0.8;
    const n = beat ? beat.count : 3;
    for (let k = n; k >= 1; k--) {
      setCount(k);
      buzz(30);
      await new Promise<void>((r) => timers.current.push(window.setTimeout(r, per * 1000)));
    }
    setCount(null);
    live.current.takeAt = now();
    live.current.marks = [];
    live.current.phase = 'take';
    setPhase('take');
    buzz(60);
  }

  function endTake() {
    const L = live.current;
    if (L.phase !== 'take' || !L.shot) return;
    const rec: TakeRecord = {
      shot: L.shot.id,
      say: L.shot.say,
      from: Math.max(0, L.takeAt - PAD_IN),
      to: now() + PAD_IN,
      marks: L.marks.slice(),
      kept: false,
    };
    L.phase = 'keep';
    setPhase('keep');
    commit([...L.takes, rec]);
    buzz(20);
    if (L.shot.mark && !rec.marks.length) say(`No ${L.shot.mark} tap in that take`);
  }
  function keep() {
    const L = live.current;
    const last = L.takes[L.takes.length - 1];
    if (!last || last.kept) return;
    commit([...L.takes.slice(0, -1), { ...last, kept: true }]);
    L.phase = 'ready';
    setI((x) => x + 1);
    setPhase('ready');
    say('Kept', 900);
  }
  function again() {
    live.current.phase = 'ready';
    setPhase('ready');
    say('Again. The last take stays in the roll, unused');
  }
  function tapMark() {
    const L = live.current;
    if (L.phase !== 'take' || !L.shot?.mark) return;
    L.marks.push({ name: L.shot.mark, t: Math.round(now() * 100) / 100 });
    setHit(true);
    buzz(80);
    window.setTimeout(() => setHit(false), 220);
  }
  function cut() {
    const L = live.current;
    if (L.phase === 'take') endTake();
    // A finished take that was never Kept counts as kept: Cut means "that's it".
    const last = L.takes[L.takes.length - 1];
    if (L.phase === 'keep' && last && !last.kept) commit([...L.takes.slice(0, -1), { ...last, kept: true }]);
    onCut();
  }
  const endTakeRef = React.useRef(endTake);
  endTakeRef.current = endTake;

  // ----------------------------------------------------------------- the viewfinder
  React.useEffect(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let W = 0;
    let H = 0;
    const size = () => {
      const d = window.devicePixelRatio || 1;
      W = box.clientWidth;
      H = box.clientHeight;
      cv.width = W * d;
      cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(box);
    const onTilt = (e: DeviceOrientationEvent) => {
      live.current.tilt = e.gamma;
    };
    window.addEventListener('deviceorientation', onTilt);
    const acc = getComputedStyle(box).getPropertyValue('--pc-accent').trim() || '#d6c38e';
    const soft = 'rgba(242,237,228,.55)';
    const hard = 'rgba(242,237,228,.92)';

    const bracket = (x: number, y: number, w: number, h: number, len: number) => {
      ctx.strokeStyle = hard;
      ctx.lineWidth = 2;
      ctx.beginPath();
      (
        [
          [x, y, 1, 1],
          [x + w, y, -1, 1],
          [x, y + h, 1, -1],
          [x + w, y + h, -1, -1],
        ] as const
      ).forEach(([cx, cy, sx, sy]) => {
        ctx.moveTo(cx, cy + sy * len);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * len, cy);
      });
      ctx.stroke();
    };
    const label = (t: string, x: number, y: number) => {
      ctx.fillStyle = hard;
      ctx.font = '600 10.5px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText(t, x, y);
    };

    let raf = 0;
    const draw = () => {
      const L = live.current;
      ctx.clearRect(0, 0, W, H);
      const s = L.shot;
      if (s) {
        // Safe area for titles, always faint.
        ctx.strokeStyle = 'rgba(242,237,228,.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(W * 0.06, H * 0.16, W * 0.88, H * 0.58);
        for (const a of s.aid ?? []) {
          if (a.kind === 'frame') {
            const sh = a.shape;
            if (sh === 'centre-box') {
              const w = W * 0.62;
              const h = Math.min(H * 0.42, w * 1.15);
              bracket((W - w) / 2, (H - h) / 2 - H * 0.04, w, h, 26);
            } else if (sh === 'close-up') {
              const w = W * 0.84;
              const h = Math.min(H * 0.5, w * 0.8);
              bracket((W - w) / 2, (H - h) / 2 - H * 0.04, w, h, 20);
              label('CLOSE', (W - w) / 2, (H - h) / 2 - H * 0.04 - 8);
            } else if (sh === 'thirds') {
              ctx.strokeStyle = soft;
              ctx.lineWidth = 1;
              ctx.beginPath();
              [1, 2].forEach((k) => {
                ctx.moveTo((W * k) / 3, H * 0.16);
                ctx.lineTo((W * k) / 3, H * 0.74);
                ctx.moveTo(W * 0.06, H * 0.16 + (H * 0.58 * k) / 3);
                ctx.lineTo(W * 0.94, H * 0.16 + (H * 0.58 * k) / 3);
              });
              ctx.stroke();
              ctx.fillStyle = hard;
              [1, 2].forEach((ii) =>
                [1, 2].forEach((jj) => {
                  ctx.beginPath();
                  ctx.arc((W * ii) / 3, H * 0.16 + (H * 0.58 * jj) / 3, 3, 0, 7);
                  ctx.fill();
                })
              );
            } else if (sh === 'hands-line') {
              ctx.setLineDash([6, 6]);
              ctx.strokeStyle = hard;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(W * 0.08, H * 0.56);
              ctx.lineTo(W * 0.92, H * 0.56);
              ctx.stroke();
              ctx.setLineDash([]);
              label('HANDS ON THIS LINE', W * 0.08, H * 0.56 - 8);
            } else if (sh === 'horizon') {
              ctx.strokeStyle = hard;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(W * 0.06, H * 0.5);
              ctx.lineTo(W * 0.94, H * 0.5);
              ctx.stroke();
              label('HORIZON', W * 0.06, H * 0.5 - 8);
            } else if (sh === 'face-line') {
              ctx.strokeStyle = hard;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.ellipse(W / 2, H * 0.4, W * 0.2, W * 0.26, 0, 0, 7);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(W * 0.3, H * 0.36);
              ctx.lineTo(W * 0.7, H * 0.36);
              ctx.stroke();
            } else if (sh.startsWith('corner-')) {
              const w = W * 0.42;
              const h = H * 0.26;
              const right = sh.endsWith('r');
              const top = sh[7] === 't';
              bracket(right ? W * 0.94 - w : W * 0.06, top ? H * 0.2 : H * 0.72 - h, w, h, 22);
            }
          }
          if (a.kind === 'beat' && L.phase === 'take') {
            const per = 60 / a.bpm;
            const ph = (now() - L.takeAt) / per;
            const pulse = Math.max(0, 1 - (ph % 1) * 3);
            ctx.fillStyle = acc;
            ctx.globalAlpha = 0.35 + 0.65 * pulse;
            ctx.beginPath();
            ctx.arc(W / 2, H * 0.2, 7 + 9 * pulse, 0, 7);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      // Level tick: accent when the phone is square to the subject.
      if (L.tilt != null) {
        const lv = Math.abs(L.tilt) < 2;
        ctx.save();
        ctx.translate(W / 2, H * 0.8);
        ctx.rotate((-L.tilt * Math.PI) / 180);
        ctx.strokeStyle = lv ? acc : soft;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(-10, 0);
        ctx.moveTo(10, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();
        ctx.restore();
      }
      // Take timer ring on the button; the take ends itself when the time is up.
      if (ring.current) {
        let p = 0;
        if (L.phase === 'take' && s?.seconds) {
          p = Math.min(1, (now() - L.takeAt) / s.seconds);
          if (p >= 1) endTakeRef.current();
        }
        ring.current.style.strokeDashoffset = String(RING * (1 - p));
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('deviceorientation', onTilt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------- the card
  const prompt = shot?.aid?.find((a): a is Extract<Aid, { kind: 'prompt' }> => a.kind === 'prompt');
  const cam = shot?.camera;
  const camNotes = cam ? [cam.lens && `${cam.lens} lens`, cam.height && `${cam.height} height`, cam.move, cam.light].filter(Boolean) : [];
  const done = i >= shots.length;
  const goLabel = done ? 'Cut' : phase === 'ready' ? `Take ${i + 1}` : phase === 'count' ? '…' : phase === 'take' ? (shot?.seconds ? 'Stop' : 'Done') : 'Keep';
  const onGo = () => {
    if (done) return cut();
    if (phase === 'ready') return void begin();
    if (phase === 'take') return endTake();
    if (phase === 'keep') return keep();
  };

  return (
    <div className="sd" ref={wrap} aria-label="Shot director">
      <canvas ref={canvas} className="sd-guide" aria-hidden />
      <div className="sd-top">
        <div className="sd-chips">
          <span className="sd-chip">
            <i className="sd-dot" data-effect={preset.effect} />
            {preset.id} {preset.name}
          </span>
          <span className="sd-chip">{done ? 'done' : shot?.by}</span>
        </div>
        <div className="sd-strip" role="list">
          {preset.shots.map((s) => {
            const idx = shots.indexOf(s);
            const kept = takes.some((t) => t.shot === s.id && t.kept);
            return (
              <div
                key={s.id}
                role="listitem"
                className={`sd-seg${s.by === 'machine' ? ' is-machine' : ''}${kept ? ' is-kept' : ''}${idx === i && !done ? ' is-cur' : ''}`}
                style={{ flex: s.seconds || 1.5 }}
                title={s.say}
              >
                {s.by === 'machine' ? 'auto · ' : ''}
                {s.say}
              </div>
            );
          })}
        </div>
      </div>

      {prompt && !done && <div className="sd-prompt">{prompt.text}</div>}
      {count != null && (
        <div className="sd-count" aria-live="assertive">
          {count}
        </div>
      )}
      {toast && (
        <div className="sd-toast" role="status">
          {toast}
        </div>
      )}
      {phase === 'take' && shot?.mark && (
        <button type="button" className={`sd-mark${hit ? ' is-hit' : ''}`} onPointerDown={tapMark}>
          {shot.mark.toUpperCase()}
        </button>
      )}

      <div className="sd-bottom">
        <div className="sd-card">
          <div className="sd-eyebrow">{done ? 'All shots kept' : `Shot ${i + 1} of ${shots.length}${shot?.seconds ? ` · ${shot.seconds}s` : ''}`}</div>
          <div className="sd-say">{done ? 'Cut the roll' : shot?.say}</div>
          {!recording && <div className="sd-hint">Press Record to start the roll, then Take 1.</div>}
          {camNotes.length > 0 && !done && (
            <div className="sd-cam">
              {camNotes.map((n) => (
                <span key={String(n)}>{n}</span>
              ))}
            </div>
          )}
        </div>
        {recording && (
          <div className="sd-controls">
            <div className="sd-side">
              {phase === 'keep' && (
                <button type="button" className="sd-btn" onClick={again}>
                  Again
                </button>
              )}
            </div>
            <button type="button" className={`sd-go${phase === 'take' || phase === 'count' ? ' is-take' : ''}`} onClick={onGo} disabled={phase === 'count'} aria-label={goLabel}>
              <svg viewBox="0 0 84 84" aria-hidden>
                <circle cx="42" cy="42" r="39" fill="none" stroke="rgba(242,237,228,.25)" strokeWidth="3" />
                <circle
                  ref={ring}
                  cx="42"
                  cy="42"
                  r="39"
                  fill="none"
                  stroke="var(--pc-accent)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={RING}
                  strokeDashoffset={RING}
                  transform="rotate(-90 42 42)"
                />
              </svg>
              <span className="sd-face">{goLabel}</span>
            </button>
            <div className="sd-side is-r">
              {phase !== 'take' && phase !== 'count' && (
                <button type="button" className="sd-btn" onClick={cut}>
                  Cut
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
