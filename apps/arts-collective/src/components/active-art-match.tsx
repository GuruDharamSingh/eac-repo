"use client";

import { useEffect, useRef, useCallback } from "react";

const STYLES = `
.aa-wrap{position:relative;width:100%;aspect-ratio:3/5;background:#0d0d0f;overflow:hidden;cursor:crosshair;touch-action:none;display:flex;flex-direction:column;justify-content:center;align-items:center;border-radius:2px}
.aa-wrap::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#4a2511 0%,#0d0d0f 60%);opacity:0;transition:opacity .5s ease;pointer-events:none}
.aa-wrap.lit::before{opacity:1}
.aa-inst{position:absolute;top:10%;font-size:9px;font-weight:300;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);user-select:none;pointer-events:none;transition:opacity .5s ease;text-align:center;padding:0 6px}
.aa-wrap.lit .aa-inst{opacity:0}
.aa-match{position:relative;display:flex;flex-direction:column;align-items:center;z-index:10}
.aa-head{width:16px;height:24px;background:linear-gradient(135deg,#a31515,#5e0b0b);border-radius:40% 40% 30% 30%;margin-bottom:-5px;z-index:2;box-shadow:inset -2px -2px 4px rgba(0,0,0,.4),inset 2px 2px 4px rgba(255,255,255,.1);transition:background .3s ease}
.aa-wrap.lit .aa-head,.aa-wrap.ext .aa-head{background:linear-gradient(135deg,#111,#000);box-shadow:inset -2px -2px 4px rgba(0,0,0,.8)}
.aa-stick{width:9px;height:120px;background:linear-gradient(90deg,#d2a679,#e6c299 30%,#b88654 80%,#8c6239);border-radius:1px 1px 4px 4px;z-index:1;box-shadow:inset -1px 0 3px rgba(0,0,0,.2);position:relative;overflow:hidden}
.aa-stick::after{content:'';position:absolute;top:0;left:0;width:100%;height:0%;background:linear-gradient(to bottom,#111 0%,#333 70%,transparent 100%);transition:height 0s}
.aa-wrap.lit .aa-stick::after{height:60%;transition:height 12s linear}
.aa-wrap.ext .aa-stick::after{height:60%;transition:none}
.aa-flame-c{position:absolute;top:5px;left:50%;transform:translateX(-50%);width:50px;height:75px;opacity:0;pointer-events:none;z-index:3;transition:opacity .2s ease,transform 0s;display:flex;justify-content:center;align-items:flex-end}
.aa-wrap.lit .aa-flame-c{opacity:1;transform:translateX(-50%) translateY(70px);transition:opacity .2s ease,transform 12s linear}
.aa-flame{width:30px;height:60px;background:radial-gradient(ellipse at bottom,#fff 5%,#ffeb99 20%,#ff9900 50%,#ff3300 80%,transparent 100%);border-radius:50% 50% 20% 20%;box-shadow:0 -5px 20px #ff3300,0 0 40px #ff9900;animation:aaFlicker .1s infinite alternate,aaSway 3s ease-in-out infinite alternate;transform-origin:bottom center;filter:blur(1px)}
@keyframes aaFlicker{0%{transform:scaleX(.98) scaleY(1.02);opacity:.9}100%{transform:scaleX(1.02) scaleY(.98);opacity:1}}
@keyframes aaSway{0%{transform:rotate(-5deg)}100%{transform:rotate(5deg)}}
.aa-sparks{position:absolute;bottom:10px;width:5px;height:5px;border-radius:50%}
.aa-wrap.lit .aa-sparks{animation:aaExplode .5s ease-out forwards}
@keyframes aaExplode{0%{box-shadow:0 0 0 #fff,0 0 0 #ff9900,0 0 0 #ff3300}50%{box-shadow:-10px -15px 5px #ff9900,15px -20px 8px #ff3300,-5px -30px 3px #fff}100%{box-shadow:-20px -30px 10px transparent,25px -40px 15px transparent,-10px -50px 5px transparent}}
.aa-smoke-c{position:absolute;top:30px;left:50%;transform:translateX(-50%);width:25px;height:25px;pointer-events:none;z-index:5;display:flex;justify-content:center;align-items:center}
.aa-smoke{position:absolute;width:15px;height:15px;background:radial-gradient(circle,rgba(180,180,180,.4) 0%,transparent 70%);border-radius:50%;filter:blur(3px);opacity:0}
.aa-wrap.ext .aa-smoke-1{animation:aaSmoke 2.5s ease-out forwards}
.aa-wrap.ext .aa-smoke-2{animation:aaSmoke 3s ease-out .3s forwards}
.aa-wrap.ext .aa-smoke-3{animation:aaSmoke 3.5s ease-out .6s forwards}
@keyframes aaSmoke{0%{transform:translateY(0) scale(1) translateX(0);opacity:.8}50%{transform:translateY(-50px) scale(2) translateX(-10px);opacity:.5}100%{transform:translateY(-120px) scale(3) translateX(10px);opacity:0}}
@media(prefers-reduced-motion:reduce){.aa-flame,.aa-sparks,.aa-smoke{animation:none!important}}
`;

const MIN_SPEED = 0.5;
const IGNITION_HEAT = 30;

export function ActiveArtMatch() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<HTMLParagraphElement>(null);
  const matchRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    lastTime: 0,
    lastX: 0,
    lastY: 0,
    isLit: false,
    heat: 0,
    lastStrikeSoundTime: 0,
    resetTimeout: null as ReturnType<typeof setTimeout> | null,
    audioCtx: null as AudioContext | null,
    fireSource: null as AudioBufferSourceNode | null,
    fireGain: null as GainNode | null,
  });

  const initAudio = useCallback(() => {
    const s = stateRef.current;
    try {
      if (!s.audioCtx || s.audioCtx.state === "closed") {
        s.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (s.audioCtx.state === "suspended") {
        s.audioCtx.resume().catch(() => {});
      }
    } catch {
      s.audioCtx = null;
    }
  }, []);

  const playStrike = useCallback((intensity: number) => {
    initAudio();
    const ctx = stateRef.current.audioCtx;
    if (!ctx) return;
    const len = ctx.sampleRate * 0.05;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 800 + Math.min(intensity, 5) * 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }, [initAudio]);

  const playIgnite = useCallback(() => {
    initAudio();
    const ctx = stateRef.current.audioCtx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.5);
    const oscG = ctx.createGain();
    oscG.gain.setValueAtTime(1, ctx.currentTime);
    oscG.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(oscG);
    oscG.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 10);
    gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 14);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    stateRef.current.fireSource = src;
    stateRef.current.fireGain = gain;
  }, [initAudio]);

  const playHiss = useCallback(() => {
    initAudio();
    const ctx = stateRef.current.audioCtx;
    if (!ctx) return;
    const len = ctx.sampleRate * 0.3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 2000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }, [initAudio]);

  const stopFire = useCallback(() => {
    const s = stateRef.current;
    if (s.fireSource && s.fireGain && s.audioCtx) {
      s.fireGain.gain.linearRampToValueAtTime(0, s.audioCtx.currentTime + 0.3);
      const src = s.fireSource;
      setTimeout(() => { try { src.stop(); } catch {} }, 300);
      s.fireSource = null;
    }
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inst = instRef.current;
    const matchEl = matchRef.current;
    if (!wrap || !inst || !matchEl) return;
    const s = stateRef.current;

    function ignite() {
      s.isLit = true;
      wrap!.classList.remove("ext");
      wrap!.classList.add("lit");
      matchEl!.style.transform = "";
      inst!.textContent = "Click to extinguish";
      playIgnite();
      setTimeout(() => { inst!.style.opacity = "0.5"; }, 2000);
    }

    function handleMove(e: MouseEvent | TouchEvent) {
      if (s.isLit) return;
      if (e.type === "touchmove") e.preventDefault();
      if (wrap!.classList.contains("ext")) {
        wrap!.classList.remove("ext");
        if (s.resetTimeout) clearTimeout(s.resetTimeout);
      }
      const pos = "touches" in e && e.touches.length > 0
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
      const now = Date.now();
      if (s.lastTime !== 0) {
        const dt = now - s.lastTime;
        if (dt > 0) {
          const dx = pos.x - s.lastX;
          const dy = pos.y - s.lastY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = dist / dt;
          const rect = wrap!.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const over = Math.abs(pos.x - cx) < rect.width / 2 && Math.abs(pos.y - cy) < rect.height / 2;
          if (over && speed > MIN_SPEED) {
            s.heat += speed;
            if (now - s.lastStrikeSoundTime > 80) {
              playStrike(speed);
              s.lastStrikeSoundTime = now;
            }
            const shake = (Math.random() - 0.5) * Math.min(speed * 2, 10);
            matchEl!.style.transform = `translateX(${shake}px) rotate(${shake / 2}deg)`;
            if (s.heat > IGNITION_HEAT) ignite();
          } else {
            s.heat = Math.max(0, s.heat - 2);
            if (s.heat === 0) matchEl!.style.transform = "";
          }
        }
      }
      s.lastX = pos.x;
      s.lastY = pos.y;
      s.lastTime = now;
    }

    function handleClick() {
      initAudio();
      if (s.isLit) {
        s.isLit = false;
        s.heat = 0;
        wrap!.classList.remove("lit");
        wrap!.classList.add("ext");
        inst!.style.opacity = "1";
        inst!.textContent = "Swipe fast to strike";
        stopFire();
        playHiss();
        if (s.resetTimeout) clearTimeout(s.resetTimeout);
        s.resetTimeout = setTimeout(() => {
          if (wrap!.classList.contains("ext")) wrap!.classList.remove("ext");
        }, 4000);
      }
    }

    wrap.addEventListener("mousemove", handleMove);
    wrap.addEventListener("touchmove", handleMove, { passive: false });
    wrap.addEventListener("click", handleClick);
    return () => {
      wrap.removeEventListener("mousemove", handleMove);
      wrap.removeEventListener("touchmove", handleMove);
      wrap.removeEventListener("click", handleClick);
      if (s.resetTimeout) clearTimeout(s.resetTimeout);
      stopFire();
      if (s.audioCtx && s.audioCtx.state !== "closed") {
        s.audioCtx.close().catch(() => {});
        s.audioCtx = null;
      }
    };
  }, [initAudio, playStrike, playIgnite, playHiss, stopFire]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div ref={wrapRef} className="aa-wrap">
        <p ref={instRef} className="aa-inst">Swipe fast to strike</p>
        <div ref={matchRef} className="aa-match">
          <div className="aa-smoke-c">
            <div className="aa-smoke aa-smoke-1" />
            <div className="aa-smoke aa-smoke-2" />
            <div className="aa-smoke aa-smoke-3" />
          </div>
          <div className="aa-flame-c">
            <div className="aa-flame" />
            <div className="aa-sparks" />
          </div>
          <div className="aa-head" />
          <div className="aa-stick" />
        </div>
      </div>
    </>
  );
}
