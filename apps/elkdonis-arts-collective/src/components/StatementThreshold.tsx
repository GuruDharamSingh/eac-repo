"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ─── Palette: night-sky blues | copper-oxide greens | earthy golds ────────────
const PALETTE = [
  0x1a3080, 0x224499, 0x104b8c, 0x1e4a90, // blues
  0x4a8b78, 0x5fa88a, 0x3a7a68, 0x6cb5a0, // oxide greens
  0xc9a962, 0xe8d5a3, 0x8a6a20, 0xd4b470, // earthy golds
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
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef     = useRef<number>(0);
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

  // ─── Three.js scene ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mobile = "ontouchstart" in window || window.matchMedia("(pointer: coarse)").matches;
    const COUNT  = mobile ? 180 : 400;
    const SPREAD = 18;

    // alpha: true → transparent, so the CSS BACKDROP shows through
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 0, 10);

    // Particles
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const vel: THREE.Vector3[] = [];
    const tmp = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * SPREAD;
      const y = (Math.random() - 0.5) * SPREAD;
      const z = (Math.random() - 0.5) * SPREAD * 0.6;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      tmp.setHex(PALETTE[i % PALETTE.length]);
      const b = 0.28 + Math.random() * 0.68;
      col[i * 3] = tmp.r * b; col[i * 3 + 1] = tmp.g * b; col[i * 3 + 2] = tmp.b * b;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.003, (Math.random() - 0.5) * 0.003, 0));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.065, vertexColors: true, transparent: true, opacity: 0.9,
      sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    })));

    const mkWire = (hex: number, op: number) =>
      new THREE.MeshBasicMaterial({ color: hex, wireframe: true, transparent: true, opacity: op, fog: false });

    const ig = new THREE.IcosahedronGeometry(3.8, 1);
    const icosa = new THREE.Mesh(ig, mkWire(0x3a7a68, 0.18)); // copper oxide
    icosa.rotation.x = 0.4;
    scene.add(icosa);

    const og = new THREE.OctahedronGeometry(2.2, 0);
    const octa = new THREE.Mesh(og, mkWire(0x8a6a20, 0.14)); // earthy gold
    octa.rotation.z = 0.3;
    scene.add(octa);

    const tg    = new THREE.TorusGeometry(1.1, 0.012, 8, 80);
    const torus = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({
      color: 0xc9a962, transparent: true, opacity: 0.42, fog: false,
    }));
    scene.add(torus);

    let t = 0;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.0008;
      for (let i = 0; i < COUNT; i++) {
        const v = vel[i];
        const px = posAttr.getX(i) + v.x;
        const py = posAttr.getY(i) + v.y;
        if (px > SPREAD / 2 || px < -SPREAD / 2) v.x *= -1;
        if (py > SPREAD / 2 || py < -SPREAD / 2) v.y *= -1;
        posAttr.setXY(i, px, py);
      }
      posAttr.needsUpdate = true;
      icosa.rotation.y  = t * 0.18;
      icosa.rotation.x  = 0.4 + Math.sin(t * 0.3) * 0.1;
      octa.rotation.y   = -t * 0.24;
      octa.rotation.x   = 0.3 + Math.cos(t * 0.25) * 0.1;
      torus.rotation.z  = t * 0.6;
      torus.rotation.x  = Math.sin(t * 0.4) * 0.3;
      camera.position.x = Math.sin(t * 0.15) * 0.4;
      camera.position.y = Math.cos(t * 0.12) * 0.25;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);
    const autoTimer = setTimeout(dismiss, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(autoTimer);
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geo.dispose(); ig.dispose(); og.dispose(); tg.dispose();
    };
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
