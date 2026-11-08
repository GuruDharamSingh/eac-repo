"use client";

import { SEVENTHS, RHYTHMS } from "@/lib/sound/rhythm";
import { TEMPERAMENTS, TUNINGS, toneOf, type Point, type Temperament, type TuningKey } from "@/lib/sound/tuning";
import type { Melody, Rhythm } from "@/lib/sound/rhythm";
import type { FigureSoundState } from "./use-figure-sound";

// ============================================================================
// The figure's sound controls: the speaker toggle (all sound is opt-in), a
// volume slider, the three things to play, "Sing a tone" (with its own
// permission note and off switch), and the tuning and rhythm settings folded
// away. Nothing here makes a sound until the visitor presses the speaker.
// ============================================================================

function Speaker({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {on ? (
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

const PLAYS: ReadonlyArray<{ melody: Melody; label: string }> = [
  { melody: "hexad", label: "Play the line" },
  { melody: "walk", label: "Walk the octave" },
  { melody: "triangle", label: "Sound the triangle" },
];

const fmtCents = (c: number) => `${c > 0 ? "+" : c < 0 ? "−" : "±"}${Math.abs(c)}`;

export function SoundBar({ s, mic }: { s: FigureSoundState; mic: boolean }) {
  const tuningInfo = TUNINGS.find((t) => t.value === s.tuning)!;
  const heardName = s.heard ? toneOf(s.heard.point as Point, s.tuning, s.temperament).name : "";
  return (
    <div className="he-sound" data-on={s.on ? "" : undefined}>
      <div className="he-sound-row">
        <button type="button" className="he-chip he-sound-toggle" aria-pressed={s.on} onClick={s.toggle}>
          <Speaker on={s.on} />
          {s.on ? "Sound on" : "Turn sound on"}
        </button>
        {s.on ? (
          <>
            <label className="he-sound-vol">
              <span className="he-sr">Volume</span>
              <input type="range" min={0} max={100} value={Math.round(s.volume * 100)} onChange={(e) => s.setVolume(Number(e.target.value) / 100)} aria-label="Figure volume" />
            </label>
            {s.playing ? (
              <button type="button" className="he-chip" onClick={s.stop}>
                Stop
              </button>
            ) : (
              PLAYS.slice()
                .sort((a, b) => (a.melody === s.melody ? -1 : b.melody === s.melody ? 1 : 0))
                .map((p) => (
                  <button key={p.melody} type="button" className="he-chip" onClick={() => void s.play(p.melody)}>
                    {p.label}
                  </button>
                ))
            )}
            {mic && !s.micOn ? (
              <button type="button" className="he-chip" onClick={s.askMic} aria-expanded={s.micAsk}>
                Sing a tone
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {s.on && s.micAsk && !s.micOn ? (
        <div className="he-mic-ask" role="group" aria-label="Use the microphone">
          <p>
            Sing or hum a steady tone and see where it lands on the nine points. Your browser will ask to use the
            microphone. <b>The sound is heard only in this tab: nothing is recorded, kept or sent.</b> Stop it at any
            time.
          </p>
          <p className="he-sound-actions">
            <button type="button" className="he-seg-btn" onClick={() => void s.startMic()}>
              Allow the microphone
            </button>
            <button type="button" className="he-seg-btn" onClick={s.cancelMic}>
              Not now
            </button>
          </p>
        </div>
      ) : null}

      {s.micOn ? (
        <div className="he-mic-live" role="status">
          <span className="he-mic-dot" aria-hidden="true" /> Microphone on, heard only here.{" "}
          <span aria-live="off">
            {s.heard
              ? `You sing ${s.heard.note}: it lands on ${s.heard.point} (${heardName}), ${fmtCents(s.heard.cents)} cents.`
              : "Sing or hum a steady tone…"}
          </span>
          <span className="he-sound-actions">
            {s.heard ? (
              <button type="button" className="he-seg-btn" onClick={s.takeMyDo}>
                Make this my do
              </button>
            ) : null}
            {s.myDo ? (
              <button type="button" className="he-seg-btn" onClick={s.clearMyDo}>
                Back to the site&rsquo;s do
              </button>
            ) : null}
            <button type="button" className="he-seg-btn he-mic-stop" onClick={s.stopMic}>
              Stop the microphone
            </button>
          </span>
        </div>
      ) : null}

      {s.error ? (
        <p className="he-sound-error" role="alert">
          {s.error}
        </p>
      ) : null}

      {s.on ? (
        <details className="he-sound-more">
          <summary>Tuning and rhythm</summary>
          <div className="he-sound-grid">
            <label>
              Tuning
              <select value={s.tuning} onChange={(e) => s.setTuning(e.target.value as TuningKey)}>
                {TUNINGS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {s.tuning !== "harmonic" ? (
              <label>
                The seven notes in
                <select value={s.temperament} onChange={(e) => s.setTemperament(e.target.value as Temperament)}>
                  {TEMPERAMENTS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Rhythm of the line
              <select value={s.rhythm} onChange={(e) => s.setRhythm(e.target.value as Rhythm)}>
                {RHYTHMS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Read the line from
              <select value={String(s.rotation)} onChange={(e) => s.setRotation(Number(e.target.value))}>
                {SEVENTHS.map((d, i) => (
                  <option key={d} value={String(i + 1)}>
                    {i + 1}/7 = 0.{d}…
                  </option>
                ))}
              </select>
            </label>
            <label className="he-sound-check">
              <input type="checkbox" checked={s.drone} onChange={(e) => s.setDrone(e.target.checked)} />A drone on do
            </label>
          </div>
          <p className="he-sound-note">
            {tuningInfo.note} do is {s.doHz.toFixed(1)} Hz
            {s.myDo ? " (your voice)" : s.following ? ` (following the key of Ario's track, ${s.trackTonic})` : ""}.
          </p>
          <p className="he-sound-note">
            The octave on the figure follows Ouspensky, <i>In Search of the Miraculous</i>, ch. 14. The other tunings,
            and the sounds given to the centres and lenses, are an artistic interpretation, not a therapy.
          </p>
        </details>
      ) : null}
    </div>
  );
}
