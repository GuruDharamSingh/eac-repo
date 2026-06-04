"use client";

import { useEffect, useRef, useState, useCallback } from "react";
const PALETTE = [
  "#1a3080", "#224499", "#104b8c", "#1e4a90",
  "#4a8b78", "#5fa88a", "#3a7a68", "#6cb5a0",
  "#c9a962", "#e8d5a3", "#8a6a20", "#d4b470",
];

// Three atmospheric colour pools over a midnight-navy base.
// Canvas is transparent (alpha: true) so this CSS gradient IS the backdrop.
const BACKDROP = [
  "radial-gradient(ellipse 75% 60% at 22% 68%, rgba(42,90,72,0.45) 0%, transparent 70%)",
  "radial-gradient(ellipse 60% 75% at 80% 16%, rgba(16,48,112,0.60) 0%, transparent 65%)",
  "radial-gradient(ellipse 40% 50% at 88% 84%, rgba(90,55,10,0.32) 0%, transparent 60%)",
  "linear-gradient(180deg, #010c1e 0%, #020a14 100%)",
].join(",");

const AUTO_DISMISS_MS  = 4500;
const FADE_DURATION_MS = 1400;

export function StatementThreshold({ onDismiss }: { onDismiss: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const dismissedRef = useRef(false);
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  // ─── Single dismiss path ─────────────────────────────────────────────────────
  // dismissedRef guards against any source (touch, click, key, timer) double-firing.
  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setPhase("fading");
    setTimeout(() => { setPhase("gone"); onDismiss(); }, FADE_DURATION_MS);
  }, [onDismiss]);

  // Native canvas effect to avoid runtime dependency on three.js.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coarse =
      "ontouchstart" in window || window.matchMedia("(pointer: coarse)").matches;
    const COUNT = coarse ? 120 : 220;
    const DPR = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);

    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00035,
      vy: (Math.random() - 0.5) * 0.00035,
      r: 0.6 + Math.random() * 2.2,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alpha: 0.2 + Math.random() * 0.55,
    }));

    const setSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    setSize();

    let t = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.008;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx + Math.sin(t + p.y * 10) * 0.00006;
        p.y += p.vy + Math.cos(t + p.x * 10) * 0.00006;
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        if (p.y < -0.02) p.y = 1.02;
        if (p.y > 1.02) p.y = -0.02;

        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // subtle linking lines to mimic depth
      ctx.globalAlpha = 0.11;
      for (let i = 0; i < particles.length; i += 3) {
        const a = particles[i];
        const b = particles[(i + 17) % particles.length];
        ctx.strokeStyle = "#4a8b78";
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    animate();

    window.addEventListener("resize", onResize);
    const autoTimer = setTimeout(dismiss, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(autoTimer);
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
    };

    function onResize() {
      setSize();
    }
  }, [dismiss]);

  // ─── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (["Enter", " ", "Escape"].includes(e.key)) dismiss();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [dismiss]);

  // ─── Native touch listener ───────────────────────────────────────────────────
  // React's synthetic onClick on a div is unreliable on some mobile browsers
  // (iOS Safari ignores clicks on non-interactive elements unless cursor:pointer
  // is set, and some Android browsers skip the event if a scroll-detection race
  // fires first). A native touchend on the overlay element is the safest fallback.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onTouch = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) dismiss(); // single-finger tap only
    };
    el.addEventListener("touchend", onTouch);
    return () => el.removeEventListener("touchend", onTouch);
  }, [dismiss]);

  if (phase === "gone") return null;

  return (
    <div
      ref={overlayRef}
      onClick={dismiss}
      role="button"
      tabIndex={0}
      aria-label="Tap or click to enter"
      onKeyDown={(e) => { if (["Enter", " "].includes(e.key)) dismiss(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        cursor: "pointer",
        background: BACKDROP,
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        // ── Kills the blue tap-highlight flash on mobile ──
        WebkitTapHighlightColor: "transparent",
        // ── Eliminates 300ms tap delay ──
        touchAction: "manipulation",
      }}
    >
      {/* Canvas: pointer-events none is critical — without it the WebGL canvas
          absorbs touchstart on iOS before it reaches the overlay or button.     */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />

      {/* ── Text ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.75rem",
          padding: "2rem",
          pointerEvents: "none", // text doesn't need to receive events
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
            fontSize: "clamp(2.8rem, 8vw, 7rem)",
            letterSpacing: "0.06em",
            lineHeight: 1.1,
            textAlign: "center",
            margin: 0,
            color: "transparent",
            backgroundImage:
              "linear-gradient(135deg, #7ab5a0 0%, #c9a962 30%, #e8d5a3 55%, #4a8b78 75%, #c9a962 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter:
              "drop-shadow(0 0 40px rgba(201,169,98,0.4)) drop-shadow(0 0 20px rgba(74,139,120,0.25))",
            animation: "threshold-emerge 2.2s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          What Is Art For?
        </h1>

        <div
          aria-hidden="true"
          style={{
            width: "clamp(80px, 18vw, 200px)",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, #4a8b78 20%, #c9a962 50%, #4a8b78 80%, transparent)",
            opacity: 0.75,
            animation: "threshold-emerge 2.8s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        />

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: "clamp(0.75rem, 2vw, 0.9rem)",
            color: "rgba(122,181,160,0.55)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            margin: 0,
            animation: "threshold-emerge 3.4s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          tap or click to enter
        </p>
      </div>

      {/* ── Enter button ────────────────────────────────────────────────────────
           Sized for finger touch on all viewports.
           onClick + stopPropagation: prevents the outer div onClick double-firing.
           The native touchend on the overlay already covers the "tap anywhere" path. */}
      <div
        style={{
          position: "absolute",
          bottom: "clamp(2.5rem, 8vh, 4.5rem)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
          animation: "threshold-emerge 3.8s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.6rem",
            padding: "0 2rem",
            height: "54px",
            minWidth: "180px",
            border: "1px solid rgba(74,139,120,0.55)",
            borderRadius: "4px",
            background: "rgba(2,20,60,0.45)",
            backdropFilter: "blur(12px)",
            color: "#7ab5a0",
            fontFamily: "var(--font-sans)",
            fontSize: "0.85rem",
            fontWeight: 400,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
            outline: "none",
          }}
        >
          Enter
          <span aria-hidden="true" style={{ opacity: 0.55 }}>›</span>
        </button>
      </div>

      <style>{`
        @keyframes threshold-emerge {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
