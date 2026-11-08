"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModeKey } from "./content";
import { centerOf } from "./geometry";
import { useSoundState } from "@/lib/sound/react";
import { setPrefs } from "@/lib/sound/store";
import { landOf, nearestNote, tonicHz, type Point, type Temperament, type TuningKey } from "@/lib/sound/tuning";
import { stepsFor, type Melody, type Rhythm } from "@/lib/sound/rhythm";
// Static on purpose: unlock() must run synchronously inside the click, and the
// engine module is small. Tone itself loads in engine.ready(), pitchy in startMic().
import * as E from "@/lib/sound/engine";
import type { Playback, Voicing } from "@/lib/sound/engine";
import { startMic as openMic, type MicSession } from "@/lib/sound/pitch";
import { DEFAULT_TIMBRES, LENS_FEEL, type FigureSound } from "./sound-config";

// ============================================================================
// The figure's sound, as one hook. Config and the interpretive tables
// (timbre per centre, feel per lens): ./sound-config.ts.
// ============================================================================

export type { FigureSound, WebOverlay } from "./sound-config";

export interface Heard {
  hz: number;
  note: string;
  point: Point;
  cents: number;
}

export function useFigureSound(cfg: FigureSound | null | undefined, mode: ModeKey) {
  const { prefs, defaults, trackTonic } = useSoundState();
  const [tuning, setTuning] = useState<TuningKey>(cfg?.tuning && cfg.tuning !== "site" ? cfg.tuning : defaults.tuning);
  const [temperament, setTemperament] = useState<Temperament>(defaults.temperament);
  const [melody, setMelody] = useState<Melody>(cfg?.melody ?? "hexad");
  const [rhythm, setRhythm] = useState<Rhythm>(cfg?.rhythm ?? "steady");
  const [rotation, setRotation] = useState<number>(cfg?.rotation ?? 1);
  const [sounding, setSounding] = useState<Point[]>([]);
  const [playing, setPlaying] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micAsk, setMicAsk] = useState(false);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [myDo, setMyDo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playback = useRef<Playback | null>(null);
  const mic = useRef<MicSession | null>(null);
  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the editor and the site defaults when they change.
  useEffect(() => {
    if (cfg?.tuning && cfg.tuning !== "site") setTuning(cfg.tuning);
    else setTuning(defaults.tuning);
  }, [cfg?.tuning, defaults.tuning]);
  useEffect(() => setTemperament(defaults.temperament), [defaults.temperament]);
  useEffect(() => cfg?.melody && setMelody(cfg.melody), [cfg?.melody]);
  useEffect(() => cfg?.rhythm && setRhythm(cfg.rhythm), [cfg?.rhythm]);
  useEffect(() => cfg?.rotation && setRotation(cfg.rotation), [cfg?.rotation]);

  const doHz = useMemo(() => {
    if (myDo) return myDo;
    if (defaults.follow && trackTonic) {
      const hz = tonicHz(`${trackTonic}4`);
      return hz > 400 ? hz / 2 : hz;
    }
    return tonicHz(defaults.tonic);
  }, [myDo, defaults.follow, defaults.tonic, trackTonic]);

  const timbres = cfg?.timbres ?? DEFAULT_TIMBRES;
  const voicing: Voicing = useMemo(
    () => ({ tuning, temperament, doHz, timbreOf: (p: Point) => timbres[centerOf(p)] ?? "sine" }),
    [tuning, temperament, doHz, timbres],
  );

  const landRef = useRef({ doHz, tuning, temperament });
  landRef.current = { doHz, tuning, temperament };

  const on = Boolean(cfg) && prefs.on;

  // The lens sets the feel (ramped by the engine), and volume follows the slider.
  useEffect(() => {
    if (!on) return;
    E.setFeel(LENS_FEEL[mode]);
  }, [on, mode]);
  useEffect(() => {
    if (!on) return;
    E.setVolume(prefs.volume);
  }, [on, prefs.volume]);
  useEffect(() => {
    if (!on) return;
    void E.setDrone(prefs.drone, doHz);
  }, [on, prefs.drone, doHz]);

  const stopAll = useCallback(() => {
    playback.current?.stop();
    playback.current = null;
    mic.current?.stop();
    mic.current = null;
    setPlaying(false);
    setMicOn(false);
    setMicAsk(false);
    setHeard(null);
  }, []);

  // Leaving the page (or the block unmounting) stops what this figure started.
  useEffect(() => stopAll, [stopAll]);

  /** The speaker toggle. MUST run inside the click: unlock() is synchronous. */
  const toggle = useCallback(() => {
    if (prefs.on) {
      stopAll();
      setPrefs({ on: false });
      E.hush();
      return;
    }
    if (!E.unlock()) {
      setError("This browser cannot play sound here.");
      return;
    }
    setError(null);
    setPrefs({ on: true });
    E.setVolume(prefs.volume);
    void E.ready().then(() => {
      E.setFeel(LENS_FEEL[mode]);
      void E.playPoints([9], voicing, 1.2);
      flashPoints([9], 1200);
    });
  }, [prefs.on, prefs.volume, stopAll, mode, voicing]);

  function flashPoints(points: Point[], ms: number) {
    setSounding(points);
    if (flash.current) clearTimeout(flash.current);
    flash.current = setTimeout(() => setSounding([]), ms);
  }

  /** A point was tapped: sound it (when sound is on). */
  const tap = useCallback(
    (p: Point) => {
      if (!on) return;
      E.unlock();
      void E.playPoints([p], voicing, 1.1);
      flashPoints([p], 900);
    },
    [on, voicing],
  );

  const play = useCallback(
    async (which?: Melody) => {
      if (!on) return;
      playback.current?.stop();
      const m = which ?? melody;
      E.unlock();
      if (m === "triangle") {
        void E.playPoints([3, 6, 9], voicing, 2.4);
        flashPoints([3, 6, 9], 2200);
        return;
      }
      setPlaying(true);
      playback.current = await E.playSteps(
        stepsFor(m, rhythm, rotation),
        voicing,
        LENS_FEEL[mode],
        (_i, points) => {
          if (points === null && _i === null) {
            setPlaying(false);
            setSounding([]);
          } else setSounding(points ?? []);
        },
        { octaveTop: m === "walk" },
      );
    },
    [on, melody, rhythm, rotation, voicing, mode],
  );

  const stop = useCallback(() => {
    playback.current?.stop();
    playback.current = null;
    setPlaying(false);
    setSounding([]);
  }, []);

  /** Start the mic (after the visitor has read the note and pressed Allow). */
  const startMic = useCallback(async () => {
    setError(null);
    try {
      mic.current = await openMic((h) => {
        if (!h) return setHeard(null);
        // Read through the ref: do and the tuning may change while it listens.
        const { doHz: d, tuning: tu, temperament: te } = landRef.current;
        const land = landOf(h.hz, d, tu, te);
        setHeard({ hz: h.hz, note: nearestNote(h.hz).name, point: land.point, cents: land.cents });
      });
      setMicOn(true);
      setMicAsk(false);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setError(name === "NotAllowedError" ? "The microphone was not allowed. Nothing was heard." : "The microphone could not start here.");
      setMicAsk(false);
    }
  }, []);

  const stopMic = useCallback(() => {
    mic.current?.stop();
    mic.current = null;
    setMicOn(false);
    setHeard(null);
  }, []);

  return {
    enabled: Boolean(cfg),
    on,
    volume: prefs.volume,
    drone: prefs.drone,
    tuning,
    temperament,
    melody,
    rhythm,
    rotation,
    doHz,
    myDo,
    voicing,
    sounding,
    playing,
    micOn,
    micAsk,
    heard,
    error,
    following: Boolean(defaults.follow && trackTonic && !myDo),
    trackTonic,
    toggle,
    tap,
    play,
    stop,
    setTuning,
    setTemperament,
    setMelody,
    setRhythm,
    setRotation,
    setVolume: (v: number) => setPrefs({ volume: v }),
    setDrone: (v: boolean) => setPrefs({ drone: v }),
    askMic: () => setMicAsk(true),
    cancelMic: () => setMicAsk(false),
    startMic,
    stopMic,
    takeMyDo: () => heard && setMyDo(heard.hz),
    clearMyDo: () => setMyDo(null),
  };
}

export type FigureSoundState = ReturnType<typeof useFigureSound>;
