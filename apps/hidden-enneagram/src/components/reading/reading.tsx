"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Wheel, wingPoints, type WheelSpec } from "@/components/aeon/wheel";
import { centerOf } from "@/components/aeon/geometry";
import { DEFAULT_TIMBRES, LENS_FEEL } from "@/components/aeon/sound-config";
import { STRESS, TYPES } from "@/components/aeon/content";
import { GROWTH } from "@/components/aeon/geometry";
import * as E from "@/lib/sound/engine";
import { setPrefs } from "@/lib/sound/store";
import { useSoundState } from "@/lib/sound/react";
import { stepsFor } from "@/lib/sound/rhythm";
import { tonicHz, type Point } from "@/lib/sound/tuning";
import type { Cue } from "./parse";

// ============================================================================
// A reading, stepped through (he-reading's client island).
//
//   - Back / Next, the step dots, and the arrow keys (PageUp/PageDown, Home,
//     End) while the reading has focus; `#step-3` in the address opens on
//     step 3 and the address follows the visitor.
//   - "Written out" shows every step as text with a small still figure; it is
//     always in the page (so it prints, and reads without script), and the
//     print stylesheet prints it instead of the stepper.
//   - A step's sound cue plays when the visitor presses "Hear this", and on
//     arrival at each later step once they have turned the reading's sound on.
//   - In the editor the reading is inert and shows the step chosen in its
//     settings ("Step shown in the editor").
// ============================================================================

export interface ReadingStep {
  title: string;
  body: ReactNode;
  spec: WheelSpec;
  cue: Cue;
}

function describe(spec: WheelSpec): string {
  const parts: string[] = [];
  if (spec.core) parts.push(`type ${spec.core}, ${TYPES[spec.core].name}`);
  if (spec.core && spec.wings !== "none") parts.push(`wing ${wingPoints(spec.core, spec.wings).join(" and ")}`);
  if (spec.core && (spec.arrows === "stress" || spec.arrows === "both")) parts.push(`stress line to ${STRESS[spec.core]}`);
  if (spec.core && (spec.arrows === "growth" || spec.arrows === "both")) parts.push(`growth line to ${GROWTH[spec.core]}`);
  if (spec.lit.length) parts.push(`also ${spec.lit.join(", ")}`);
  if (spec.marks.length) parts.push(`lines ${spec.marks.map((m) => `${m.from}${m.arrow ? " to " : "-"}${m.to}`).join(", ")}`);
  return parts.length ? `The figure shows ${parts.join("; ")}.` : "The figure.";
}

export function Reading({
  steps,
  editorStep,
  drawn,
  idBase,
  startView,
  sound,
}: {
  steps: ReadingStep[];
  editorStep: number;
  drawn: boolean;
  idBase: string;
  startView: "stepper" | "written";
  sound: boolean;
}) {
  const count = steps.length;
  const clamp = useCallback((n: number) => Math.min(Math.max(0, n), Math.max(0, count - 1)), [count]);
  // Visitors start at step 1 (or #step-N); the editor shows its chosen step.
  const [i, setI] = useState(() => (drawn ? clamp(editorStep - 1) : 0));
  const [view, setView] = useState(startView);
  const [sounding, setSounding] = useState<number[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const { defaults } = useSoundState();
  const root = useRef<HTMLDivElement | null>(null);
  const playback = useRef<E.Playback | null>(null);
  const id = idBase.replace(/[^A-Za-z0-9_-]/g, "-");

  // The editor picks the step to preview.
  useEffect(() => {
    if (drawn) setI(clamp(editorStep - 1));
  }, [drawn, editorStep, clamp]);
  useEffect(() => setView(startView), [startView]);

  // #step-N in, and out.
  useEffect(() => {
    if (drawn) return;
    const read = () => {
      const m = /^#step-(\d+)$/.exec(window.location.hash);
      if (m) setI(clamp(Number(m[1]) - 1));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [drawn, clamp]);

  const cue = useCallback(
    (step: ReadingStep | undefined) => {
      if (!step || step.cue === "none" || !sound) return;
      playback.current?.stop();
      const spec = step.spec;
      const voicing: E.Voicing = {
        tuning: defaults.tuning,
        temperament: defaults.temperament,
        doHz: tonicHz(defaults.tonic),
        timbreOf: (p: Point) => DEFAULT_TIMBRES[centerOf(p)],
      };
      const flash = (pts: number[], ms: number) => {
        setSounding(pts);
        setTimeout(() => setSounding([]), ms);
      };
      if (step.cue === "core" && spec.core) {
        void E.playPoints([spec.core], voicing, 1.4);
        flash([spec.core], 1300);
      } else if (step.cue === "lit") {
        const pts = [...new Set([...(spec.core ? [spec.core] : []), ...wingPoints(spec.core ?? 9, spec.core ? spec.wings : "none"), ...spec.lit])] as Point[];
        if (pts.length) {
          void E.playPoints(pts, voicing, 2);
          flash(pts, 1800);
        }
      } else if (step.cue === "triangle") {
        void E.playPoints([3, 6, 9], voicing, 2.2);
        flash([3, 6, 9], 2000);
      } else {
        void E.playSteps(stepsFor(step.cue === "walk" ? "walk" : "hexad", "steady"), voicing, LENS_FEEL[spec.lens], (_n, pts) => setSounding(pts ?? []), {
          octaveTop: step.cue === "walk",
        }).then((p) => (playback.current = p));
      }
    },
    [sound, defaults],
  );

  const go = useCallback(
    (n: number) => {
      const next = clamp(n);
      setI(next);
      if (!drawn) {
        try {
          history.replaceState(null, "", `#step-${next + 1}`);
        } catch {
          /* ignore */
        }
        if (soundOn) cue(steps[next]);
      }
    },
    [clamp, drawn, soundOn, cue, steps],
  );

  useEffect(() => () => playback.current?.stop(), []);

  /** "Hear this": the gesture that turns the reading's sound on. */
  const hear = () => {
    if (!E.unlock()) return;
    setPrefs({ on: true });
    setSoundOn(true);
    cue(steps[i]);
  };

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || view !== "stepper") return;
    const map: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, PageDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, PageUp: i - 1, Home: 0, End: count - 1 };
    if (e.key in map) {
      e.preventDefault();
      go(map[e.key]!);
    }
  }

  if (!count) return <p className="he-r-empty">This reading has no steps yet.</p>;
  const step = steps[i]!;
  const anyCue = sound && steps.some((s) => s.cue !== "none");

  return (
    <div className="he-reading" data-view={view} ref={root} onKeyDown={onKey}>
      <div className="he-r-tools" role="group" aria-label="How to read">
        <button type="button" className="he-chip" aria-pressed={view === "stepper"} onClick={() => setView("stepper")}>
          Step by step
        </button>
        <button type="button" className="he-chip" aria-pressed={view === "written"} onClick={() => setView("written")}>
          Written out
        </button>
        <button type="button" className="he-chip" onClick={() => window.print()}>
          Print
        </button>
        {anyCue && soundOn ? (
          <button
            type="button"
            className="he-chip"
            aria-pressed={true}
            onClick={() => {
              playback.current?.stop();
              E.hush();
              setSoundOn(false);
            }}
          >
            Sound on
          </button>
        ) : null}
      </div>

      <section className="he-r-stage" aria-roledescription="reading" aria-label={`Step ${i + 1} of ${count}`}>
        <div className="he-r-figure">
          <Wheel spec={step.spec} sounding={sounding} idBase={`${id}-s`} label={describe(step.spec)} />
        </div>
        <div className="he-r-text" tabIndex={-1}>
          <p className="he-r-count">
            Step {i + 1} of {count}
          </p>
          <div key={i} className="he-r-body">
            {step.title ? <h3>{step.title}</h3> : null}
            {step.body}
            {step.spec.pins.length ? (
              <ul className="he-r-pins">
                {step.spec.pins.map((p, n) => (
                  <li key={n}>
                    <b>{p.point}</b> {p.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {sound && step.cue !== "none" ? (
            <p>
              <button type="button" className="he-seg-btn he-r-hear" onClick={hear}>
                Hear this
              </button>
            </p>
          ) : null}
          <nav className="he-r-pager" aria-label="Reading steps">
            <button type="button" className="he-seg-btn" disabled={i === 0} onClick={() => go(i - 1)}>
              ← Back
            </button>
            <span className="he-r-dots">
              {steps.map((s, n) => (
                <button
                  key={n}
                  type="button"
                  className="he-r-dot"
                  aria-current={n === i ? "step" : undefined}
                  aria-label={`Step ${n + 1}${s.title ? `: ${s.title}` : ""}`}
                  onClick={() => go(n)}
                />
              ))}
            </span>
            <button type="button" className="he-seg-btn" disabled={i === count - 1} onClick={() => go(i + 1)}>
              Next →
            </button>
          </nav>
          <p className="he-r-hint">Arrow keys move between steps.</p>
        </div>
      </section>

      <ol className="he-r-written" aria-label="The reading, written out">
        {steps.map((s, n) => (
          <li key={n} id={`${id}-step-${n + 1}`}>
            <div className="he-r-figure-sm">
              <Wheel spec={s.spec} size="small" idBase={`${id}-w${n}`} label={describe(s.spec)} />
            </div>
            <div className="he-r-body">
              <p className="he-r-count">Step {n + 1}</p>
              {s.title ? <h3>{s.title}</h3> : null}
              {s.body}
              <p className="he-r-shows">{describe(s.spec)}</p>
              {s.spec.pins.length ? (
                <ul className="he-r-pins">
                  {s.spec.pins.map((p, k) => (
                    <li key={k}>
                      <b>{p.point}</b> {p.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
