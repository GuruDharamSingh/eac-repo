import { isTemperament, isTuning, type Temperament, type TuningKey } from "@/lib/sound/tuning";

// ============================================================================
// Ario's sound settings: one site_config row, key `he-audio` (this org only).
// Pure (no database), so the Manage form, the server and the layout share it.
//
//   music   the background music a visitor may choose to play: tracks
//           (uploaded through /api/upload, served by /api/media), on/off,
//           start volume, loop one track or play the list, which pages.
//           It never starts by itself: the player offers "Play Ario's music".
//   figure  the site's defaults for the figure's sound: tuning, temperament,
//           do's note, and whether the figure follows the key of the track
//           that is playing. A block's own choice wins over these.
// ============================================================================

export const AUDIO_KEY = "he-audio";

export interface MusicTrack {
  id: string;
  /** `/api/media/EAC_Network/<org>/Media/Audio/…` (an upload) or an https URL. */
  url: string;
  title: string;
  artist: string;
  /** The track's key or tonic as a note letter ("D", "F#", "Bb"), or "". */
  key: string;
}

export type MusicMode = "loop" | "playlist";
export type MusicPages = "all" | "chosen";

export interface AudioConfig {
  v: 1;
  music: {
    enabled: boolean;
    tracks: MusicTrack[];
    /** Start volume, 0 to 1. Kept low by default: a bed, not a concert. */
    volume: number;
    mode: MusicMode;
    pages: MusicPages;
    /** With pages "chosen": the paths it plays on ("/", "/enneagram", "/music"). */
    paths: string[];
  };
  figure: {
    tuning: TuningKey;
    temperament: Temperament;
    tonic: string;
    follow: boolean;
  };
}

export const DEFAULT_AUDIO: AudioConfig = {
  v: 1,
  music: { enabled: false, tracks: [], volume: 0.4, mode: "playlist", pages: "all", paths: [] },
  figure: { tuning: "ouspensky", temperament: "just", tonic: "C4", follow: false },
};

const NOTE_LETTER = /^[A-G][#b]?$/;
const TONIC = /^[A-G][#b]?[1-6]$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A track URL this site will play: its own media route, or https. */
export function isTrackUrl(u: string): boolean {
  if (u.startsWith("/api/media/") && !u.includes("..")) return true;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

/** A path as Ario types it: "/", "/enneagram", "music" -> "/music". */
export function normalisePath(p: string): string | null {
  const t = p.trim().split(/[?#]/)[0]!.replace(/\/+$/, "");
  const withSlash = t.startsWith("/") ? t : `/${t}`;
  return /^\/[a-z0-9\-/]*$/i.test(withSlash) ? withSlash.toLowerCase() || "/" : null;
}

export function cleanAudioConfig(raw: unknown): AudioConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const m = (r.music && typeof r.music === "object" ? r.music : {}) as Record<string, unknown>;
  const f = (r.figure && typeof r.figure === "object" ? r.figure : {}) as Record<string, unknown>;
  const tracks: MusicTrack[] = [];
  for (const t of Array.isArray(m.tracks) ? m.tracks.slice(0, 50) : []) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const url = str(o.url, 600);
    if (!isTrackUrl(url)) continue;
    const key = str(o.key, 3);
    tracks.push({
      id: str(o.id, 40) || `t${tracks.length + 1}`,
      url,
      title: str(o.title, 160) || "Untitled",
      artist: str(o.artist, 160),
      key: NOTE_LETTER.test(key) ? key : "",
    });
  }
  const vol = typeof m.volume === "number" && Number.isFinite(m.volume) ? Math.min(1, Math.max(0, m.volume)) : DEFAULT_AUDIO.music.volume;
  const paths = (Array.isArray(m.paths) ? m.paths : [])
    .map((p) => (typeof p === "string" ? normalisePath(p) : null))
    .filter((p): p is string => Boolean(p))
    .slice(0, 60);
  const tonic = str(f.tonic, 4);
  return {
    v: 1,
    music: {
      enabled: Boolean(m.enabled) && tracks.length > 0,
      tracks,
      volume: Math.round(vol * 100) / 100,
      mode: m.mode === "loop" ? "loop" : "playlist",
      pages: m.pages === "chosen" ? "chosen" : "all",
      paths: [...new Set(paths)],
    },
    figure: {
      tuning: isTuning(f.tuning) ? f.tuning : DEFAULT_AUDIO.figure.tuning,
      temperament: isTemperament(f.temperament) ? f.temperament : DEFAULT_AUDIO.figure.temperament,
      tonic: TONIC.test(tonic) ? tonic : DEFAULT_AUDIO.figure.tonic,
      follow: Boolean(f.follow),
    },
  };
}

/** Does the music play on this path? (Never in the studio or back office.) */
export function playsOn(cfg: AudioConfig["music"], pathname: string): boolean {
  if (!cfg.enabled || !cfg.tracks.length) return false;
  if (/^\/(studio|manage|edit|admin|login|signup|account)(\/|$)/.test(pathname)) return false;
  if (cfg.pages === "all") return true;
  const p = normalisePath(pathname) ?? pathname;
  return cfg.paths.includes(p);
}

/** What the browser gets: the config minus nothing secret (there is nothing secret), music off when unusable. */
export type PublicAudio = AudioConfig;
