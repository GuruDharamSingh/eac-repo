import type * as ToneNS from "tone";
import { duckFor, holdDuck } from "./store";
import { freqOf, type Point, type Temperament, type TuningKey } from "./tuning";
import type { Step } from "./rhythm";

// ============================================================================
// The figure's sound engine (browser only). Web Audio underneath, Tone.js for
// voices and effects, and Tone is NOT in the page bundle: it is imported the
// first time a visitor turns sound on.
//
// Why two steps (unlock, then ready):
//   Browsers start audio only from a user gesture, and Safari wants the
//   AudioContext created and resumed SYNCHRONOUSLY inside the click handler,
//   not after an `await`. So unlock() makes our own AudioContext in the click,
//   resumes it, plays one silent sample (the iOS unlock) and asks iOS to treat
//   it as playback (navigator.audioSession.type = "playback", iOS 17+, so the
//   silent switch does not mute the figure). ready() then loads Tone and hands
//   it that same context (Tone.setContext), so there is only ever one.
//
// Voices: one per timbre, each a PolySynth so the triangle can sound as a
// chord. The two shocks (3 and 6) are not notes: a filtered "breath" of noise
// and a struck metal "bowl". Everything runs through one lowpass (a lens's
// brightness), one reverb (its space) and one master gain (the visitor's
// volume). While anything sounds the background music ducks (store.duckFor).
// ============================================================================

export type Timbre = "felt" | "voice" | "bell" | "glass" | "sine" | "reed";

export const TIMBRES: ReadonlyArray<{ value: Timbre; label: string }> = [
  { value: "felt", label: "Felt drum (low, soft attack)" },
  { value: "voice", label: "Voice (a sung 'ah')" },
  { value: "bell", label: "Bell" },
  { value: "glass", label: "Glass" },
  { value: "sine", label: "Pure tone" },
  { value: "reed", label: "Reed" },
];

export const isTimbre = (v: unknown): v is Timbre => TIMBRES.some((t) => t.value === v);

/** A lens's feel (interpretive): tempo, brightness (lowpass), space (reverb). */
export interface Feel {
  bpm: number;
  bright: number;
  space: number;
}

export interface Voicing {
  tuning: TuningKey;
  temperament: Temperament;
  doHz: number;
  /** The timbre for each point (decided by its centre, by the caller). */
  timbreOf: (p: Point) => Timbre;
}

type Tone = typeof ToneNS;

interface Graph {
  T: Tone;
  master: ToneNS.Gain;
  filter: ToneNS.Filter;
  reverb: ToneNS.Reverb;
  voices: Partial<Record<Timbre, ToneNS.PolySynth>>;
  breath: ToneNS.NoiseSynth;
  bowl: ToneNS.MetalSynth;
  drone: ToneNS.Oscillator[] | null;
  droneGain: ToneNS.Gain;
}

let ctx: AudioContext | null = null;
let graph: Graph | null = null;
let loading: Promise<Graph> | null = null;
let volume = 0.7;
let releaseDroneDuck: (() => void) | null = null;

/** Has a context been made yet (i.e. has the visitor ever turned sound on)? */
export const hasContext = () => ctx !== null;
export const rawContext = () => ctx;

/**
 * Call SYNCHRONOUSLY from a click/keydown handler, before any await.
 * Returns false where Web Audio is missing.
 */
export function unlock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC({ latencyHint: "interactive" });
    }
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    if (ctx.state !== "running") void ctx.resume();
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

/** Load Tone (once) and build the voices on the unlocked context. */
export function ready(): Promise<Graph> {
  if (graph) return Promise.resolve(graph);
  if (!ctx) return Promise.reject(new Error("unlock() first, inside a gesture"));
  loading ??= import("tone").then((T) => {
    // disposeOld: Tone made a default context of its own on import; close it,
    // so ours (made in the gesture) is the only one.
    T.setContext(ctx!, true);
    const master = new T.Gain(volume).toDestination();
    const reverb = new T.Reverb({ decay: 3.2, wet: 0.25 }).connect(master);
    const filter = new T.Filter({ type: "lowpass", frequency: 4200, Q: 0.3 }).connect(reverb);
    const breathFilter = new T.Filter({ type: "bandpass", frequency: 900, Q: 1.4 }).connect(filter);
    const breath = new T.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.06, decay: 0.7, sustain: 0, release: 0.4 }, volume: -10 }).connect(breathFilter);
    const bowl = new T.MetalSynth({
      harmonicity: 3.1,
      modulationIndex: 9,
      resonance: 900,
      octaves: 0.6,
      envelope: { attack: 0.002, decay: 1.6, release: 0.6 },
      volume: -26,
    }).connect(filter);
    const droneGain = new T.Gain(0).connect(filter);
    graph = { T, master, filter, reverb, voices: {}, breath, bowl, drone: null, droneGain };
    return graph;
  });
  return loading;
}

function voiceFor(g: Graph, timbre: Timbre): ToneNS.PolySynth {
  const have = g.voices[timbre];
  if (have) return have;
  const { T } = g;
  let v: ToneNS.PolySynth;
  switch (timbre) {
    case "felt":
      v = new T.PolySynth(T.MembraneSynth, { pitchDecay: 0.03, octaves: 0.7, envelope: { attack: 0.004, decay: 0.5, sustain: 0.12, release: 1.3 }, volume: -6 } as never);
      v.connect(g.filter);
      break;
    case "voice": {
      // A sawtooth through two "ah" formants, with a slow vibrato.
      const out = new T.Gain(1.6).connect(g.filter);
      const f1 = new T.Filter({ type: "bandpass", frequency: 800, Q: 4 }).connect(out);
      const f2 = new T.Filter({ type: "bandpass", frequency: 1150, Q: 5 }).connect(out);
      const vib = new T.Vibrato({ frequency: 5, depth: 0.08 });
      vib.fan(f1, f2);
      v = new T.PolySynth(T.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.09, decay: 0.3, sustain: 0.6, release: 1.2 }, volume: -10 } as never);
      v.connect(vib);
      break;
    }
    case "bell":
      v = new T.PolySynth(T.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 11,
        envelope: { attack: 0.002, decay: 1.8, sustain: 0, release: 1.8 },
        modulationEnvelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 },
        volume: -14,
      } as never);
      v.connect(g.filter);
      break;
    case "glass":
      v = new T.PolySynth(T.AMSynth, { harmonicity: 2, oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 1.4, sustain: 0.08, release: 1.6 }, volume: -10 } as never);
      v.connect(g.filter);
      break;
    case "reed": {
      const lp = new T.Filter({ type: "lowpass", frequency: 1500, Q: 0.7 }).connect(g.filter);
      v = new T.PolySynth(T.Synth, { oscillator: { type: "square" }, envelope: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 0.9 }, volume: -16 } as never);
      v.connect(lp);
      break;
    }
    default:
      v = new T.PolySynth(T.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 1.4 }, volume: -6 } as never);
      v.connect(g.filter);
  }
  g.voices[timbre] = v;
  return v;
}

/** Sound points together at `time` (Tone seconds; default now). */
function strike(g: Graph, points: Point[], voicing: Voicing, dur: number, time?: number, velocity = 0.8) {
  const at = time ?? g.T.now() + 0.01;
  const byTimbre = new Map<Timbre, number[]>();
  for (const p of points) {
    const f = freqOf(p, voicing.doHz, voicing.tuning, voicing.temperament);
    if (f === null) {
      // A shock: 3 breathes, 6 rings. Not notes; events from outside the octave.
      if (p === 3) g.breath.triggerAttackRelease(Math.max(0.3, dur), at, velocity);
      else g.bowl.triggerAttackRelease(voicing.doHz * 1.5, Math.max(0.3, dur), at, velocity * 0.7);
      continue;
    }
    const t = voicing.timbreOf(p);
    const list = byTimbre.get(t) ?? [];
    list.push(f);
    byTimbre.set(t, list);
  }
  for (const [t, freqs] of byTimbre) voiceFor(g, t).triggerAttackRelease(freqs, dur, at, velocity);
  duckFor(dur + 1.6 + (at - g.T.now()));
}

export async function playPoints(points: Point[], voicing: Voicing, dur = 0.9) {
  const g = await ready();
  strike(g, points, voicing, dur);
}

/** Sound plain frequencies together (the web of music's pitch classes and triads). */
export async function playFreqs(freqs: number[], timbre: Timbre = "bell", dur = 1, delay = 0) {
  const g = await ready();
  const at = g.T.now() + 0.01 + delay;
  voiceFor(g, timbre).triggerAttackRelease(freqs, dur, at, 0.75);
  duckFor(dur + 1.6 + delay);
}

export interface Playback {
  stop: () => void;
}

/**
 * Play steps one beat apart; onStep(i, points) fires as each sounds (null at
 * the end). Scheduled one step ahead on the audio clock, so stop() is prompt.
 */
export async function playSteps(
  steps: Step[],
  voicing: Voicing,
  feel: Feel,
  onStep: (i: number | null, points: Point[] | null) => void,
  opts: { loop?: boolean; octaveTop?: boolean } = {},
): Promise<Playback> {
  const g = await ready();
  const beat = 60 / Math.max(30, Math.min(160, feel.bpm));
  let i = 0;
  let next = g.T.now() + 0.08;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const release = holdDuck();
  const finish = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    release();
    onStep(null, null);
  };
  const tick = () => {
    if (stopped) return;
    if (i >= steps.length) {
      if (!opts.loop) {
        timer = setTimeout(finish, beat * 1000);
        return;
      }
      i = 0;
    }
    const step = steps[i]!;
    const n = i;
    if (step) {
      // The walk ends on the higher do: sound the last 9 an octave up.
      const top = opts.octaveTop && n === steps.length - 1 && step.length === 1 && step[0] === 9;
      const v = top ? { ...voicing, doHz: voicing.doHz * 2 } : voicing;
      strike(g, step, v, beat * 0.9, next);
    }
    const delay = Math.max(0, (next - g.T.now()) * 1000);
    setTimeout(() => !stopped && onStep(n, step), delay);
    i++;
    next += beat;
    timer = setTimeout(tick, Math.max(10, (next - g.T.now() - 0.1) * 1000));
  };
  tick();
  return {
    stop: () => {
      if (stopped) return;
      for (const v of Object.values(g.voices)) v?.releaseAll();
      finish();
    },
  };
}

/** The lens's feel, ramped over a second and a half rather than cut. */
export function setFeel(feel: Feel) {
  if (!graph) return;
  graph.filter.frequency.rampTo(1400 + 3600 * Math.max(0.2, Math.min(1.5, feel.bright)), 1.5);
  graph.reverb.wet.rampTo(Math.max(0, Math.min(0.8, feel.space)), 1.5);
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  graph?.master.gain.rampTo(volume, 0.08);
}

/** A soft drone on do (an octave and two below), while sound is on and the visitor wants it. */
export async function setDrone(on: boolean, doHz: number) {
  const g = await ready();
  if (on) {
    if (!g.drone) {
      g.drone = [new g.T.Oscillator(doHz / 2, "sine"), new g.T.Oscillator(doHz / 4, "triangle")];
      g.drone[1]!.volume.value = -8;
      for (const o of g.drone) o.connect(g.droneGain).start();
    } else {
      g.drone[0]!.frequency.rampTo(doHz / 2, 0.6);
      g.drone[1]!.frequency.rampTo(doHz / 4, 0.6);
    }
    g.droneGain.gain.rampTo(0.09, 2);
    releaseDroneDuck ??= holdDuck();
  } else if (g.drone) {
    const old = g.drone;
    g.drone = null;
    g.droneGain.gain.rampTo(0, 1);
    setTimeout(() => old.forEach((o) => o.stop().dispose()), 1200);
    releaseDroneDuck?.();
    releaseDroneDuck = null;
  }
}

/** Silence everything (sound turned off): release voices, drop the drone. */
export function hush() {
  if (!graph) return;
  for (const v of Object.values(graph.voices)) v?.releaseAll();
  void setDrone(false, 0);
}
