"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HEXAGRAM, NUMS, TRIANGLE } from "@/components/aeon/geometry";
import { centerOf } from "@/components/aeon/geometry";
import { DEFAULT_TIMBRES } from "@/components/aeon/sound-config";
import * as E from "@/lib/sound/engine";
import { startMic, type MicSession } from "@/lib/sound/pitch";
import { setPrefs } from "@/lib/sound/store";
import { useSoundState } from "@/lib/sound/react";
import { chromaOf, landOf, nearestNote, tonicHz, toneOf, TUNINGS, type Point, type TuningKey } from "@/lib/sound/tuning";

// ============================================================================
// The web of music (he-music-web; /music). Two views of the twelve-note world
// beside the enneagram's nine (docs/audio-research.md 3 and 6.5):
//
//   Ring     a 36-tick ring: every 3rd tick a pitch class in circle-of-fifths
//            order from do, every 4th an enneagram point. They meet only at
//            0, 120 and 240 degrees (9, 3, 6): the honest picture of 12 and 9
//            side by side (layout E). Inside it the enneagram with each
//            point's note, and an interval-cycle explorer: step k round 9 or
//            round 12 (on 9, steps 3 and 6 give only the triangle).
//   Tonnetz  Euler's lattice: fifths across, major thirds up; every small
//            triangle is a triad (pointing up major, down minor).
//
// Everything sounds when touched, once sound is on, and is silent before.
// The microphone (same rules as the figure: asked first, heard only here,
// nothing recorded, a visible off switch) lights the pitch class it hears.
// ============================================================================

const SIZE = 640;
const C = SIZE / 2;
const OUT = 278;
const MID = 168;
const PC = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const DIATONIC = [0, 2, 4, 5, 7, 9, 11];
const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: r2(C + r * Math.cos(a)), y: r2(C + r * Math.sin(a)) };
};
const ptDeg = (p: number) => (p % 9) * 40;

export type WebView = "ring" | "tonnetz";

export function WebOfMusic({ view: initialView = "ring", tuning: initialTuning = "ouspensky", drawn = false }: { view?: WebView; tuning?: TuningKey; drawn?: boolean }) {
  const { prefs, defaults } = useSoundState();
  const [view, setView] = useState<WebView>(initialView);
  const [tuning, setTuning] = useState<TuningKey>(initialTuning);
  const [mod, setMod] = useState<9 | 12>(9);
  const [step, setStep] = useState(3);
  const [lit, setLit] = useState<number[]>([]);
  const [litPts, setLitPts] = useState<number[]>([]);
  const [heard, setHeard] = useState<{ chroma: number; note: string; point: number; cents: number } | null>(null);
  const [micAsk, setMicAsk] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mic = useRef<MicSession | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => setTuning(initialTuning), [initialTuning]);
  useEffect(
    () => () => {
      mic.current?.stop();
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const doHz = tonicHz(defaults.tonic);
  const doChroma = nearestNote(doHz).chroma;
  const temperament = defaults.temperament;
  const on = prefs.on;
  const pcHz = (pc: number) => doHz * 2 ** (((pc - doChroma + 12) % 12) / 12);

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const flash = (pcs: number[], pts: number[], ms = 900) => {
    setLit(pcs);
    setLitPts(pts);
    later(() => {
      setLit([]);
      setLitPts([]);
    }, ms);
  };

  const toggle = () => {
    if (on) {
      setPrefs({ on: false });
      E.hush();
      stopMic();
      return;
    }
    if (!E.unlock()) return setError("This browser cannot play sound here.");
    setError(null);
    setPrefs({ on: true });
    E.setVolume(prefs.volume);
  };

  const soundPcs = (pcs: number[], dur = 1.1) => {
    if (!on) return;
    E.unlock();
    void E.playFreqs(pcs.map(pcHz), "bell", dur);
    flash(pcs, [], dur * 900);
  };

  const soundPoint = (p: Point) => {
    if (!on) return;
    E.unlock();
    void E.playPoints([p], { tuning, temperament, doHz, timbreOf: (q) => DEFAULT_TIMBRES[centerOf(q)] }, 1);
    const c = chromaOf(p, doChroma, tuning, temperament);
    flash(c === null ? [] : [c], [p]);
  };

  const cycle = (): number[] => {
    const out: number[] = [];
    for (let n = 0; n < mod; n++) {
      const v = (n * step) % mod;
      if (n > 0 && v === 0) break;
      out.push(v);
    }
    return out;
  };

  const playCycle = () => {
    if (!on) return;
    E.unlock();
    const seq = cycle();
    seq.forEach((v, n) => {
      later(() => {
        if (mod === 12) {
          const pc = (doChroma + v) % 12;
          void E.playFreqs([pcHz(pc)], "bell", 0.7);
          setLit([pc]);
          setLitPts([]);
        } else {
          const p = (v === 0 ? 9 : v) as Point;
          void E.playPoints([p], { tuning, temperament, doHz, timbreOf: (q) => DEFAULT_TIMBRES[centerOf(q)] }, 0.7);
          setLitPts([p]);
          setLit([]);
        }
      }, n * 520);
    });
    later(() => {
      setLit([]);
      setLitPts([]);
    }, seq.length * 520 + 600);
  };

  const beginMic = useCallback(async () => {
    setError(null);
    try {
      mic.current = await startMic((h) => {
        if (!h) return setHeard(null);
        const nn = nearestNote(h.hz);
        const land = landOf(h.hz, doHz, tuning, temperament);
        setHeard({ chroma: nn.chroma, note: nn.name, point: land.point, cents: land.cents });
      });
      setMicOn(true);
      setMicAsk(false);
    } catch (err) {
      setError((err as { name?: string })?.name === "NotAllowedError" ? "The microphone was not allowed. Nothing was heard." : "The microphone could not start here.");
      setMicAsk(false);
    }
  }, [doHz, tuning, temperament]);

  function stopMic() {
    mic.current?.stop();
    mic.current = null;
    setMicOn(false);
    setHeard(null);
  }

  const isLit = (pc: number) => lit.includes(pc) || heard?.chroma === pc;
  const seq = cycle();

  // ---- the ring ----------------------------------------------------------
  const ring = (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="he-mw-svg" role="group" aria-label="The web of music: twelve pitch classes round the outside, the enneagram inside.">
      <circle cx={C} cy={C} r={OUT} className="he-web-circle" />
      {Array.from({ length: 36 }, (_, i) => {
        const deg = i * 10;
        const nine = i % 4 === 0;
        const twelve = i % 3 === 0;
        const len = nine && twelve ? 16 : nine || twelve ? 10 : 5;
        const a = at(deg, OUT);
        const b = at(deg, OUT - len);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`he-mw-tick${nine && twelve ? " he-web-meet" : ""}`} />;
      })}
      {NUMS.map((p) => {
        const q = at(ptDeg(p), OUT + 16);
        return (
          <text key={`n${p}`} x={q.x} y={q.y} className="he-mw-ptnum">
            {p}
          </text>
        );
      })}
      {/* The interval cycle. */}
      {seq.length > 1 ? (
        <polygon
          className="he-mw-cycle"
          points={seq
            .map((v) => {
              const q = mod === 12 ? at(((7 * v) % 12) * 30, OUT - 44) : at(ptDeg(v === 0 ? 9 : v), MID);
              return `${q.x},${q.y}`;
            })
            .join(" ")}
        />
      ) : null}
      {Array.from({ length: 12 }, (_, j) => {
        const pc = (doChroma + 7 * j) % 12;
        const q = at(j * 30, OUT - 30);
        return (
          <g key={`pc${j}`} className={`he-mw-pc${isLit(pc) ? " he-on" : ""}${DIATONIC.includes((pc - doChroma + 12) % 12) ? " he-mw-dia" : ""}`}>
            <circle
              cx={q.x}
              cy={q.y}
              r={17}
              tabIndex={0}
              role="button"
              aria-label={`${PC[pc]}${on ? ", sound it" : ""}`}
              onClick={() => soundPcs([pc])}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), soundPcs([pc]))}
            />
            <text x={q.x} y={q.y}>
              {PC[pc]}
            </text>
          </g>
        );
      })}
      {/* The enneagram, with each point's note. */}
      <circle cx={C} cy={C} r={MID} className="he-ring" />
      {TRIANGLE.map(([a, b]) => {
        const p = at(ptDeg(a), MID);
        const q = at(ptDeg(b), MID);
        return <line key={`t${a}${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="he-figure-line he-triangle" />;
      })}
      {HEXAGRAM.map(([a, b]) => {
        const p = at(ptDeg(a), MID);
        const q = at(ptDeg(b), MID);
        return <line key={`h${a}${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="he-figure-line" />;
      })}
      {NUMS.map((p) => {
        const q = at(ptDeg(p), MID);
        const lab = at(ptDeg(p), MID - 34);
        const tone = toneOf(p as Point, tuning, temperament);
        const c = chromaOf(p as Point, doChroma, tuning, temperament);
        const here = litPts.includes(p) || heard?.point === p;
        return (
          <g key={`e${p}`} className={`he-mw-pt${here ? " he-on" : ""}`}>
            <circle
              cx={q.x}
              cy={q.y}
              r={16}
              tabIndex={0}
              role="button"
              aria-label={`Point ${p}, ${tone.name}${on ? ", sound it" : ""}`}
              onClick={() => soundPoint(p as Point)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), soundPoint(p as Point))}
            />
            <text x={q.x} y={q.y}>
              {p}
            </text>
            <text x={lab.x} y={lab.y} className={`he-mw-note${tone.kind === "shock" ? " he-web-shock" : ""}`}>
              {tone.kind === "shock" ? "shock" : tuning === "harmonic" ? tone.ratio : `${tone.name} ${c === null ? "" : PC[c]}`}
            </text>
          </g>
        );
      })}
    </svg>
  );

  // ---- the Tonnetz ---------------------------------------------------------
  const W = 74;
  const H = 66;
  const pos = (x: number, y: number) => ({ x: r2(C + (x + y / 2) * W), y: r2(C - y * H) });
  const pcAt = (x: number, y: number) => (((doChroma + 7 * x + 4 * y) % 12) + 12) % 12;
  const xs = [-3, -2, -1, 0, 1, 2, 3];
  const ys = [-2, -1, 0, 1, 2];
  const tonnetz = (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="he-mw-svg" role="group" aria-label="A Tonnetz: fifths run across, major thirds up; each small triangle is a triad.">
      {ys.slice(0, -1).flatMap((y) =>
        xs.slice(0, -1).flatMap((x) => {
          const a = pos(x, y);
          const b = pos(x + 1, y);
          const c = pos(x, y + 1);
          const d = pos(x + 1, y + 1);
          const major = [pcAt(x, y), pcAt(x + 1, y), pcAt(x, y + 1)];
          const minor = [pcAt(x + 1, y), pcAt(x, y + 1), pcAt(x + 1, y + 1)];
          const lit3 = (t: number[]) => t.every((pc) => lit.includes(pc));
          return [
            <polygon key={`u${x}${y}`} points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`} className={`he-mw-tri he-mw-major${lit3(major) ? " he-on" : ""}`} onClick={() => soundPcs(major, 1.6)}>
              <title>{`${PC[major[0]!]} major`}</title>
            </polygon>,
            <polygon key={`d${x}${y}`} points={`${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`} className={`he-mw-tri he-mw-minor${lit3(minor) ? " he-on" : ""}`} onClick={() => soundPcs(minor, 1.6)}>
              <title>{`${PC[minor[1]!]} minor`}</title>
            </polygon>,
          ];
        }),
      )}
      {ys.flatMap((y) =>
        xs.map((x) => {
          const q = pos(x, y);
          const pc = pcAt(x, y);
          return (
            <g key={`n${x}${y}`} className={`he-mw-pc${isLit(pc) ? " he-on" : ""}${DIATONIC.includes((pc - doChroma + 12) % 12) ? " he-mw-dia" : ""}`}>
              <circle
                cx={q.x}
                cy={q.y}
                r={18}
                tabIndex={0}
                role="button"
                aria-label={`${PC[pc]}${on ? ", sound it" : ""}`}
                onClick={() => soundPcs([pc])}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), soundPcs([pc]))}
              />
              <text x={q.x} y={q.y}>
                {PC[pc]}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );

  return (
    <div className="he-mw" data-view={view}>
      <div className="he-sound-row">
        <button type="button" className="he-chip he-sound-toggle" aria-pressed={on} onClick={toggle} disabled={drawn}>
          {on ? "Sound on" : "Turn sound on"}
        </button>
        {on ? (
          <label className="he-sound-vol">
            <span className="he-sr">Volume</span>
            <input type="range" min={0} max={100} value={Math.round(prefs.volume * 100)} onChange={(e) => setPrefs({ volume: Number(e.target.value) / 100 })} aria-label="Volume" />
          </label>
        ) : null}
        <span className="he-mw-sep" aria-hidden="true" />
        <button type="button" className="he-chip" aria-pressed={view === "ring"} onClick={() => setView("ring")}>
          Ring of 9 and 12
        </button>
        <button type="button" className="he-chip" aria-pressed={view === "tonnetz"} onClick={() => setView("tonnetz")}>
          Tonnetz
        </button>
        {on && !micOn ? (
          <button type="button" className="he-chip" onClick={() => setMicAsk(true)} aria-expanded={micAsk}>
            Sing a tone
          </button>
        ) : null}
      </div>

      {micAsk && !micOn ? (
        <div className="he-mic-ask" role="group" aria-label="Use the microphone">
          <p>
            Sing, hum or play a note and the web lights where it is. Your browser will ask to use the microphone.{" "}
            <b>The sound is heard only in this tab: nothing is recorded, kept or sent.</b>
          </p>
          <p className="he-sound-actions">
            <button type="button" className="he-seg-btn" onClick={() => void beginMic()}>
              Allow the microphone
            </button>
            <button type="button" className="he-seg-btn" onClick={() => setMicAsk(false)}>
              Not now
            </button>
          </p>
        </div>
      ) : null}
      {micOn ? (
        <div className="he-mic-live" role="status">
          <span className="he-mic-dot" aria-hidden="true" /> Microphone on, heard only here.{" "}
          <span>{heard ? `${heard.note}: on the figure it lands on ${heard.point}, ${heard.cents > 0 ? "+" : ""}${heard.cents} cents.` : "Sing or hum a steady tone…"}</span>
          <button type="button" className="he-seg-btn he-mic-stop" onClick={stopMic}>
            Stop the microphone
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="he-sound-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="he-mw-stage">{view === "ring" ? ring : tonnetz}</div>

      {view === "ring" ? (
        <div className="he-sound-grid he-mw-controls">
          <label>
            The nine as notes
            <select value={tuning} onChange={(e) => setTuning(e.target.value as TuningKey)}>
              {TUNINGS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Step round
            <select
              value={String(mod)}
              onChange={(e) => {
                const m = Number(e.target.value) as 9 | 12;
                setMod(m);
                setStep((s) => Math.min(s, m - 1));
              }}
            >
              <option value="9">the nine points</option>
              <option value="12">the twelve notes</option>
            </select>
          </label>
          <label>
            By
            <select value={String(step)} onChange={(e) => setStep(Number(e.target.value))}>
              {Array.from({ length: mod - 1 }, (_, n) => (
                <option key={n + 1} value={String(n + 1)}>
                  {n + 1} {mod === 12 ? (n + 1 === 1 ? "semitone" : "semitones") : n + 1 === 1 ? "point" : "points"}
                </option>
              ))}
            </select>
          </label>
          <p className="he-sound-actions">
            <button type="button" className="he-seg-btn" onClick={playCycle} disabled={!on}>
              Play the cycle
            </button>
          </p>
          <p className="he-sound-note">
            {mod === 9
              ? step % 3 === 0
                ? "Steps of 3 or 6 round the nine visit only 9, 3 and 6: the triangle."
                : "This step visits all nine points before it returns."
              : step === 4 || step === 8
                ? "Steps of 4 give the augmented triad: like the triangle on the nine, three equal divisions."
                : step === 3 || step === 9
                  ? "Steps of 3 give the diminished seventh: four equal divisions."
                  : step === 5 || step === 7 || step === 1 || step === 11
                    ? "This step visits all twelve notes (7 is the circle of fifths)."
                    : "This step visits only some of the twelve."}
          </p>
        </div>
      ) : (
        <p className="he-sound-note">Fifths run across, major thirds up. Touch a note, or a triangle for its triad (pointing up: major; down: minor). The brighter notes are do&rsquo;s seven.</p>
      )}
    </div>
  );
}
