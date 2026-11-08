"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { playsOn, type PublicAudio } from "@/lib/audio-config-schema";
import { onDuck, setDefaults, setTrackTonic } from "@/lib/sound/store";

// ============================================================================
// Ario's music: one client island in the root layout, so it keeps playing
// through client navigation (App Router layouts do not remount).
//
// Rules (docs/audio-research.md 5 and 6.6):
//   - It NEVER starts by itself. A visible "Play Ario's music" invitation
//     starts it from a tap. A visitor who chose it before sees "Resume", and
//     still taps: the choice is remembered (localStorage `he.music.v1`), not
//     acted on without them.
//   - Pause, volume and close are always on screen while it plays
//     (WCAG 2.2 SC 1.4.2), real buttons with names, keyboard reachable.
//   - Media Session metadata (lock screen, headset buttons).
//   - It ducks (about -12 dB) while the figure sounds (store.onDuck).
//   - Absent in the studio, the back office and any iframe (Puck's canvas,
//     the "Edit look" popup), and on pages Ario has not chosen.
//   - A second tab starting the music pauses this one (BroadcastChannel).
//   - <audio preload="none">: nothing is fetched until the visitor starts it.
// It also hands the site's figure-sound defaults to the sound store.
// ============================================================================

const KEY = "he.music.v1";
const DUCK = 0.25;

interface Saved {
  consent: "on" | "off" | null;
  volume: number;
  track: number;
  pos: number;
}

function readSaved(fallbackVolume: number): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Saved> | null;
    if (raw && typeof raw === "object") {
      return {
        consent: raw.consent === "on" || raw.consent === "off" ? raw.consent : null,
        volume: typeof raw.volume === "number" ? Math.min(1, Math.max(0, raw.volume)) : fallbackVolume,
        track: typeof raw.track === "number" ? raw.track : 0,
        pos: typeof raw.pos === "number" ? raw.pos : 0,
      };
    }
  } catch {
    /* ignore */
  }
  return { consent: null, volume: fallbackVolume, track: 0, pos: 0 };
}

function Note() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M9 17.5a2.5 2.5 0 1 1-2-2.45V5l11-2v11.5a2.5 2.5 0 1 1-2-2.45V7.1L9 8.4z" fill="currentColor" />
    </svg>
  );
}

export function SiteAudio({ config }: { config: PublicAudio }) {
  const pathname = usePathname() ?? "/";
  const music = config.music;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [framed, setFramed] = useState(false);
  const [saved, setSaved] = useState<Saved>({ consent: null, volume: music.volume, track: 0, pos: 0 });
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ducked, setDucked] = useState(false);
  const [announce, setAnnounce] = useState("");
  const fade = useRef<number | null>(null);

  // The figure's site defaults, for every figure on the site.
  useEffect(() => setDefaults(config.figure), [config.figure]);

  useEffect(() => {
    setMounted(true);
    try {
      setFramed(window.self !== window.top);
    } catch {
      setFramed(true);
    }
    setSaved(readSaved(music.volume));
  }, [music.volume]);

  const save = useCallback((patch: Partial<Saved>) => {
    setSaved((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const tracks = music.tracks;
  const index = tracks.length ? ((saved.track % tracks.length) + tracks.length) % tracks.length : 0;
  const track = tracks[index];
  const allowed = playsOn(music, pathname) && !framed;

  // Volume, with the duck, faded rather than cut. (iOS ignores element volume:
  // there the device buttons set it and the duck does nothing.)
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const target = saved.volume * (ducked ? DUCK : 1);
    if (fade.current) cancelAnimationFrame(fade.current);
    const from = el.volume;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 350);
      el.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k < 1) fade.current = requestAnimationFrame(step);
    };
    fade.current = requestAnimationFrame(step);
  }, [saved.volume, ducked]);

  useEffect(() => onDuck(setDucked), []);

  // The figure follows the key of the track, when the site says so.
  useEffect(() => {
    setTrackTonic(playing && track?.key ? track.key : null);
  }, [playing, track?.key]);

  // Leaving for a page without music pauses it.
  useEffect(() => {
    if (!allowed && audio.current && !audio.current.paused) audio.current.pause();
  }, [allowed]);

  // One tab at a time.
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("he-audio");
    ch.onmessage = (e) => {
      if (e.data === "playing") audio.current?.pause();
    };
    channel.current = ch;
    return () => ch.close();
  }, []);

  // Remember where it was.
  useEffect(() => {
    const keep = () => audio.current && save({ pos: audio.current.currentTime, track: index });
    window.addEventListener("pagehide", keep);
    const t = setInterval(() => playing && keep(), 5000);
    return () => {
      window.removeEventListener("pagehide", keep);
      clearInterval(t);
    };
  }, [playing, index, save]);

  const mediaSession = useCallback(
    (t: typeof track) => {
      if (!t || !("mediaSession" in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || "Ario", album: "The Hidden Enneagram" });
      } catch {
        /* ignore */
      }
    },
    [],
  );

  /** Start or resume. Runs inside the click: play() is called synchronously. */
  const start = useCallback(
    (at = index) => {
      const el = audio.current;
      const t = tracks[at];
      if (!el || !t) return;
      const fresh = el.dataset.src !== t.url;
      if (fresh) {
        el.src = t.url;
        el.dataset.src = t.url;
        el.currentTime = at === saved.track && saved.pos > 0 && !started ? saved.pos : 0;
      }
      el.loop = music.mode === "loop";
      el.volume = saved.volume * (ducked ? DUCK : 1);
      const p = el.play();
      setStarted(true);
      save({ consent: "on", track: at });
      setAnnounce(`Playing ${t.title}${t.artist ? ` by ${t.artist}` : ""}.`);
      mediaSession(t);
      channel.current?.postMessage("playing");
      p?.catch(() => setPlaying(false));
    },
    [index, tracks, saved, started, music.mode, ducked, save, mediaSession],
  );

  const pause = useCallback(() => {
    audio.current?.pause();
    setAnnounce("Paused.");
  }, []);

  const next = useCallback(() => {
    if (tracks.length < 2) return;
    start((index + 1) % tracks.length);
  }, [tracks.length, index, start]);

  const close = useCallback(() => {
    audio.current?.pause();
    save({ consent: "off", pos: audio.current?.currentTime ?? 0 });
    setStarted(false);
    setAnnounce("Music off.");
  }, [save]);

  // Media Session buttons.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", () => start());
      ms.setActionHandler("pause", () => pause());
      ms.setActionHandler("nexttrack", tracks.length > 1 ? () => next() : null);
    } catch {
      /* ignore */
    }
  }, [start, pause, next, tracks.length]);

  if (!mounted || !music.enabled || !track) return null;

  return (
    <div className="he-music" data-hidden={allowed ? undefined : ""} data-state={playing ? "playing" : started ? "paused" : "invite"}>
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          if (music.mode === "playlist") start((index + 1) % tracks.length);
        }}
      />
      {!allowed ? null : !started ? (
        saved.consent === "off" ? (
          <button type="button" className="he-music-mini" onClick={() => start()} aria-label="Play Ario's music">
            <Note />
          </button>
        ) : (
          <div className="he-music-invite">
            <button type="button" className="he-music-pill" onClick={() => start()}>
              <Note />
              {saved.consent === "on" ? "Resume Ario's music" : "Play Ario's music"}
            </button>
            <button type="button" className="he-music-x" onClick={() => save({ consent: "off" })} aria-label="No music, thank you">
              ×
            </button>
          </div>
        )
      ) : (
        <div className="he-music-bar" role="group" aria-label="Ario's music">
          <button type="button" className="he-music-btn" onClick={playing ? pause : () => start()} aria-label={playing ? "Pause Ario's music" : "Play Ario's music"}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
            )}
          </button>
          <span className="he-music-now">
            <b>{track.title}</b>
            {track.artist ? <span> · {track.artist}</span> : null}
          </span>
          {tracks.length > 1 ? (
            <button type="button" className="he-music-btn" onClick={next} aria-label="Next track">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 5l9 7-9 7zM16 5h3v14h-3z" fill="currentColor" /></svg>
            </button>
          ) : null}
          <label className="he-music-vol">
            <span className="he-sr">Music volume</span>
            <input type="range" min={0} max={100} value={Math.round(saved.volume * 100)} onChange={(e) => save({ volume: Number(e.target.value) / 100 })} />
          </label>
          <button type="button" className="he-music-btn" onClick={close} aria-label="Stop the music and close">
            ×
          </button>
        </div>
      )}
      <span className="he-sr" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
