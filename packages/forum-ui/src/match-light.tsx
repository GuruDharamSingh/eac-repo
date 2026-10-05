"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The light switch as a match and a tealight, at the foot of the left rail.
 *
 * Rub the match (mouse, finger or pen) until it strikes: the board turns to
 * light mode, and the burning match drops into the tealight and becomes its
 * wick. Tap the candle to snuff it: dark mode, and a fresh match appears.
 * Enter/Space strike it from the keyboard.
 *
 * It writes the same `forum_mode` cookie as the reader controls' form, flips
 * data-forum-mode on .gf-root at once, then refreshes the route so the
 * server-rendered parts (masthead, the controls' own label) follow. Without
 * JavaScript it renders nothing and the form button still works.
 *
 * Adapted from arts-collective's landing match (components/active-art-match.tsx).
 */

type Mode = "light" | "dark" | "auto";
type Phase = "unlit" | "dropping" | "lit" | "snuffed";

const MIN_SPEED = 0.5; // px per ms
const IGNITION_HEAT = 30;
const KEY_HEAT = 12;
const DROP_MS = 1400;
const SNUFF_MS = 2400;

export function MatchLight({ mode }: { mode: Mode }) {
  const router = useRouter();
  const stageRef = useRef<HTMLButtonElement>(null);
  const matchRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(mode === "light" ? "lit" : "unlit");
  const [matchKey, setMatchKey] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const s = useRef({
    heat: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    lastStrike: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    audio: null as AudioContext | null,
  });

  // "auto" follows the reader's system setting until they strike or snuff.
  useEffect(() => {
    if (mode !== "auto") return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setPhase(dark ? "unlit" : "lit");
  }, [mode]);

  const audio = useCallback((): AudioContext | null => {
    const st = s.current;
    try {
      if (!st.audio || st.audio.state === "closed") {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        st.audio = new Ctx();
      }
      if (st.audio.state === "suspended") st.audio.resume().catch(() => {});
      return st.audio;
    } catch {
      return null;
    }
  }, []);

  /** A short burst of filtered noise: strikes, the ignition, the hiss. */
  const noise = useCallback((seconds: number, type: BiquadFilterType, freq: number, gain: number) => {
    const ctx = audio();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start();
  }, [audio]);

  const applyMode = useCallback((next: "light" | "dark") => {
    document.cookie = `forum_mode=${next}; Path=/; SameSite=Lax; Max-Age=31536000`;
    stageRef.current?.closest(".gf-root")?.setAttribute("data-forum-mode", next);
    router.refresh();
  }, [router]);

  const shake = useCallback((amount: number) => {
    const el = matchRef.current;
    if (!el) return;
    const j = (Math.random() - 0.5) * Math.min(amount, 10);
    el.style.transform = `translateX(${j}px) rotate(${j / 2}deg)`;
  }, []);

  const ignite = useCallback(() => {
    const st = s.current;
    st.heat = 0;
    if (matchRef.current) matchRef.current.style.transform = "";
    noise(0.35, "lowpass", 900, 0.25);
    applyMode("light");
    setPhase("dropping");
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => setPhase("lit"), DROP_MS);
  }, [applyMode, noise]);

  const snuff = useCallback(() => {
    const st = s.current;
    noise(0.3, "highpass", 2000, 0.2);
    applyMode("dark");
    setPhase("snuffed");
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => {
      setMatchKey((k) => k + 1);
      setPhase("unlit");
    }, SNUFF_MS);
  }, [applyMode, noise]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const st = s.current;

    function onMove(e: PointerEvent) {
      if (phaseRef.current !== "unlit") return;
      const now = performance.now();
      if (st.lastTime !== 0 && now - st.lastTime < 120) {
        const dt = now - st.lastTime;
        const speed = dt > 0 ? Math.hypot(e.clientX - st.lastX, e.clientY - st.lastY) / dt : 0;
        if (speed > MIN_SPEED) {
          st.heat += speed;
          if (now - st.lastStrike > 80) {
            noise(0.05, "bandpass", 800 + Math.min(speed, 5) * 400, 0.15);
            st.lastStrike = now;
          }
          shake(speed * 2);
          if (st.heat > IGNITION_HEAT) ignite();
        } else {
          st.heat = Math.max(0, st.heat - 2);
          if (st.heat === 0 && matchRef.current) matchRef.current.style.transform = "";
        }
      }
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      st.lastTime = now;
    }
    function onLeave() {
      st.lastTime = 0;
      if (matchRef.current) matchRef.current.style.transform = "";
    }

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("pointerup", onLeave);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointerup", onLeave);
    };
  }, [ignite, noise, shake]);

  useEffect(() => () => {
    const st = s.current;
    if (st.timer) clearTimeout(st.timer);
    if (st.audio && st.audio.state !== "closed") st.audio.close().catch(() => {});
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (phase !== "unlit" || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    const st = s.current;
    noise(0.05, "bandpass", 1600, 0.15);
    st.heat += KEY_HEAT;
    shake(8);
    setTimeout(() => { if (matchRef.current) matchRef.current.style.transform = ""; }, 120);
    if (st.heat > IGNITION_HEAT) ignite();
  };

  const onClick = () => {
    audio();
    if (phase === "lit" || phase === "dropping") snuff();
  };

  const burning = phase === "dropping" || phase === "lit";
  const label = burning
    ? "Snuff the candle (switch to dark mode)"
    : "Strike the match (switch to light mode): rub it quickly, or press Enter three times";

  return (
    <div className="gf-match-box">
      <button
        ref={stageRef}
        type="button"
        className="gf-match"
        data-phase={phase}
        aria-label={label}
        title={burning ? "Snuff the candle" : "Rub the match to light it"}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <span className="gf-match-glow" aria-hidden />
        <span className="gf-match-hint" aria-hidden>
          {burning ? "Tap the candle to snuff it" : phase === "snuffed" ? "" : "Rub the match to light it"}
        </span>
        <span className="gf-match-fall" aria-hidden>
          <span key={matchKey} className="gf-match-pos">
            <span ref={matchRef} className="gf-match-body">
              <span className="gf-match-smoke">
                <i /><i /><i />
              </span>
              <span className="gf-match-flame" />
              <span className="gf-match-head" />
              <span className="gf-match-stick" />
            </span>
          </span>
        </span>
        <span className="gf-match-candle" aria-hidden>
          <span className="gf-match-cup" />
          <span className="gf-match-rim" />
          <span className="gf-match-wax" />
        </span>
      </button>
    </div>
  );
}
