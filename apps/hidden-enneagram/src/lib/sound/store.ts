import { isTemperament, isTuning, type Temperament, type TuningKey } from "./tuning";

// ============================================================================
// The sound engine's small shared state (browser only, React-free; react.ts
// wraps it in hooks). Three things live here:
//
//   prefs     the visitor's own choice: sound on or off, volume, the drone.
//             Off until they turn it on. Kept in localStorage `he.sound.v1`.
//   defaults  the site's figure-sound defaults (tuning, temperament, do's
//             note), set once by the layout from site_config `he-audio`; a
//             block's own choice wins. `trackTonic` is the key of the track
//             the music player is playing, when the site follows it.
//   duck      while the figure sounds, the background player lowers itself:
//             the engine calls duckFor(), the player listens with onDuck().
// ============================================================================

export interface SoundPrefs {
  on: boolean;
  volume: number;
  drone: boolean;
}

export interface SoundDefaults {
  tuning: TuningKey;
  temperament: Temperament;
  /** do's note, e.g. "C4". */
  tonic: string;
  /** Tune the figure to the key of Ario's track while it plays. */
  follow: boolean;
}

const PREFS_KEY = "he.sound.v1";
const DEFAULT_PREFS: SoundPrefs = { on: false, volume: 0.7, drone: false };
export const CODE_DEFAULTS: SoundDefaults = { tuning: "ouspensky", temperament: "just", tonic: "C4", follow: false };

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let prefs: SoundPrefs = DEFAULT_PREFS;
let prefsRead = false;
let defaults: SoundDefaults = CODE_DEFAULTS;
let trackTonic: string | null = null;
/** A snapshot object that changes identity on every change (for useSyncExternalStore). */
let snapshot = { prefs, defaults, trackTonic };

function refresh() {
  snapshot = { prefs, defaults, trackTonic };
  emit();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSnapshot() {
  if (!prefsRead && typeof window !== "undefined") {
    prefsRead = true;
    try {
      const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "null") as Partial<SoundPrefs> | null;
      if (raw && typeof raw === "object") {
        prefs = {
          // Sound starts off on every visit (a new gesture turns it on);
          // only the volume and the drone choice are remembered.
          on: false,
          volume: typeof raw.volume === "number" ? Math.min(1, Math.max(0, raw.volume)) : DEFAULT_PREFS.volume,
          drone: Boolean(raw.drone),
        };
        snapshot = { prefs, defaults, trackTonic };
      }
    } catch {
      /* private mode or bad JSON: keep the defaults */
    }
  }
  return snapshot;
}

const SERVER_SNAPSHOT = { prefs: DEFAULT_PREFS, defaults: CODE_DEFAULTS, trackTonic: null as string | null };
export const getServerSnapshot = () => SERVER_SNAPSHOT;

export function setPrefs(patch: Partial<SoundPrefs>) {
  prefs = { ...prefs, ...patch };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ volume: prefs.volume, drone: prefs.drone }));
  } catch {
    /* ignore */
  }
  refresh();
}

export function setDefaults(raw: Partial<SoundDefaults> | null | undefined) {
  const next: SoundDefaults = {
    tuning: isTuning(raw?.tuning) ? raw.tuning : CODE_DEFAULTS.tuning,
    temperament: isTemperament(raw?.temperament) ? raw.temperament : CODE_DEFAULTS.temperament,
    tonic: typeof raw?.tonic === "string" && /^[A-G][#b]?[1-6]?$/.test(raw.tonic) ? raw.tonic : CODE_DEFAULTS.tonic,
    follow: Boolean(raw?.follow),
  };
  if (JSON.stringify(next) === JSON.stringify(defaults)) return;
  defaults = next;
  refresh();
}

export function setTrackTonic(key: string | null) {
  if (key === trackTonic) return;
  trackTonic = key;
  refresh();
}

// ---- ducking --------------------------------------------------------------

type DuckListener = (ducked: boolean) => void;
const duckers = new Set<DuckListener>();
let duckTimer: ReturnType<typeof setTimeout> | null = null;
let ducked = false;
let holds = 0;

export function onDuck(l: DuckListener): () => void {
  duckers.add(l);
  return () => duckers.delete(l);
}

function setDucked(v: boolean) {
  if (v === ducked) return;
  ducked = v;
  duckers.forEach((l) => l(v));
}

/** The figure is sounding for about `seconds`: duck the music until then. */
export function duckFor(seconds: number) {
  setDucked(true);
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    duckTimer = null;
    if (!holds) setDucked(false);
  }, Math.max(0.2, seconds) * 1000);
}

/** Something sustained (a drone, a looping melody, the mic) holds the duck until released. */
export function holdDuck(): () => void {
  holds++;
  setDucked(true);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    holds = Math.max(0, holds - 1);
    if (!holds && !duckTimer) setDucked(false);
  };
}
