"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParticleData {
  velocity: THREE.Vector3;
  originalPosition: THREE.Vector3;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 420;
const PARTICLE_SPREAD = 18;
const GOLD_PALETTE = [0xc9a962, 0xe8d5a3, 0x8a6a20, 0xd4b96a, 0xf0e0b0];
const AUTO_DISMISS_MS = 4200;
const FADE_DURATION_MS = 1600;

export function StatementThreshold({ onDismiss }: { onDismiss: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const dismissedRef = useRef(false);
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  // ─── Dismiss handler ────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setPhase("fading");
    setTimeout(() => {
      setPhase("gone");
      onDismiss();
    }, FADE_DURATION_MS);
  }, [onDismiss]);

  // ─── Three.js scene ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x03020a, 1);
    rendererRef.current = renderer;

    // Scene + Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03020a, 0.035);

    const camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );
    camera.position.set(0, 0, 10);

    // ── Particle field ──────────────────────────────────────────────────────
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const particleData: ParticleData[] = [];

    const tmpColor = new THREE.Color();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * PARTICLE_SPREAD;
      const y = (Math.random() - 0.5) * PARTICLE_SPREAD;
      const z = (Math.random() - 0.5) * PARTICLE_SPREAD * 0.6;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      tmpColor.setHex(GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)]);
      // Dim most particles
      const brightness = 0.15 + Math.random() * 0.55;
      colors[i * 3] = tmpColor.r * brightness;
      colors[i * 3 + 1] = tmpColor.g * brightness;
      colors[i * 3 + 2] = tmpColor.b * brightness;

      sizes[i] = 1.2 + Math.random() * 2.8;

      particleData.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.003,
          (Math.random() - 0.5) * 0.003,
          (Math.random() - 0.5) * 0.001
        ),
        originalPosition: new THREE.Vector3(x, y, z),
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(geometry, particleMaterial);
    scene.add(particleSystem);

    // ── Sacred geometry ─────────────────────────────────────────────────────
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x7a5520,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });

    const icosaGeo = new THREE.IcosahedronGeometry(3.8, 1);
    const icosa = new THREE.Mesh(icosaGeo, wireMat.clone());
    icosa.rotation.x = 0.4;
    scene.add(icosa);

    const octaGeo = new THREE.OctahedronGeometry(2.2, 0);
    const octa = new THREE.Mesh(octaGeo, wireMat.clone());
    octa.rotation.z = 0.3;
    scene.add(octa);

    // Inner bright ring — thin torus at center
    const torusGeo = new THREE.TorusGeometry(1.1, 0.012, 8, 80);
    const torusMat = new THREE.MeshBasicMaterial({
      color: 0xc9a962,
      transparent: true,
      opacity: 0.35,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    scene.add(torus);

    // ── Animation loop ──────────────────────────────────────────────────────
    let t = 0;
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.0008;

      // Drift particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const pd = particleData[i];
        let px = posAttr.getX(i) + pd.velocity.x;
        let py = posAttr.getY(i) + pd.velocity.y;
        const half = PARTICLE_SPREAD / 2;
        if (px > half || px < -half) pd.velocity.x *= -1;
        if (py > half || py < -half) pd.velocity.y *= -1;
        posAttr.setXY(i, px, py);
      }
      posAttr.needsUpdate = true;

      // Rotate geometry
      icosa.rotation.y = t * 0.18;
      icosa.rotation.x = 0.4 + Math.sin(t * 0.3) * 0.1;
      octa.rotation.y = -t * 0.24;
      octa.rotation.x = 0.3 + Math.cos(t * 0.25) * 0.1;
      torus.rotation.z = t * 0.6;
      torus.rotation.x = Math.sin(t * 0.4) * 0.3;

      // Subtle camera sway
      camera.position.x = Math.sin(t * 0.15) * 0.4;
      camera.position.y = Math.cos(t * 0.12) * 0.25;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    // ── Resize ──────────────────────────────────────────────────────────────
    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    // ── Auto-dismiss ────────────────────────────────────────────────────────
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geometry.dispose();
      icosaGeo.dispose();
      octaGeo.dispose();
      torusGeo.dispose();
    };
  }, [dismiss]);

  // ── Key / click dismiss ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  if (phase === "gone") return null;

  return (
    <div
      ref={overlayRef}
      onClick={dismiss}
      aria-label="Statement threshold. Press any key or click to enter."
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") dismiss();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        cursor: "pointer",
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {/* Three.js canvas — fills the whole area */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden="true"
      />

      {/* Text overlay */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
          padding: "2rem",
          pointerEvents: "none",
        }}
      >
        {/* Main statement */}
        <h1
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 300,
            fontSize: "clamp(2.8rem, 8vw, 7rem)",
            letterSpacing: "0.06em",
            lineHeight: 1.1,
            textAlign: "center",
            margin: 0,
            color: "transparent",
            backgroundImage:
              "linear-gradient(135deg, #e8d5a3 0%, #c9a962 30%, #f5e8c0 55%, #a07830 75%, #c9a962 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 40px rgba(201,169,98,0.45)) drop-shadow(0 0 12px rgba(201,169,98,0.2))",
            animation: "threshold-emerge 2.2s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          What Is Art For?
        </h1>

        {/* Thin gold rule */}
        <div
          style={{
            width: "clamp(80px, 18vw, 200px)",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, #c9a962 20%, #f5e8c0 50%, #c9a962 80%, transparent)",
            animation: "threshold-emerge 2.8s cubic-bezier(0.16, 1, 0.3, 1) both",
            opacity: 0.7,
          }}
          aria-hidden="true"
        />

        {/* Prompt */}
        <p
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: "clamp(0.85rem, 2vw, 1rem)",
            color: "rgba(201,169,98,0.45)",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            margin: 0,
            animation: "threshold-emerge 3.4s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          click or press any key to enter
        </p>
      </div>

      <style>{`
        @keyframes threshold-emerge {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
}
