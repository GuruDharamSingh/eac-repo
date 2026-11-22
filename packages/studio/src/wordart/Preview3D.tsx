"use client";

import * as React from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { paintGradient } from "@elkdonis/gradients";
import { GradientBackground } from "@elkdonis/gradients/react";
import type { Mark } from "./mark";
import { FRAMES, stageStyle, type WordArtDoc } from "./doc";
import { isRunning, STILL_PLAYBACK, usePlayback, type Playback } from "./playback";
import { applyOverrides, docAt, shaderClock } from "./timeline";
import { layerReady, layerSource, type LayerCache } from "./capture";

const LAYER: React.CSSProperties = { position: "absolute", inset: 0 };

// ============================================================================
// Word art in 3D (three.js, no R3F): the mark's outlines extruded with a
// bevel, the fill gradient painted to a texture and mapped across the faces
// by position (so the sides carry it too when sides = "gradient"). The
// background is the same live layer as 2D (shaders move), behind the
// transparent canvas; PNG export paints it as a still. Drag to orbit, wheel to
// zoom. The letters' faces carry the fill's painted gradient (a texture).
// Record mode (2026-11-18): the design at the playhead, rendered at W×H; depth,
// metal and roughness change in place (no geometry rebuild per frame).
// ============================================================================

export interface Preview3DHandle {
  exportPng(width: number, height: number): Promise<Blob>;
  resetView(): void;
  /** Record mode: the live background, then the 3D frame just rendered at W×H, into a W×H context. */
  drawFrame(ctx: CanvasRenderingContext2D): boolean;
  /** The background's shader layers have drawn (Paper loads lazily). */
  ready(): boolean;
}

const FOV = 35;
const DIST = 10;

function textureOf(spec: unknown, w: number, h: number): THREE.CanvasTexture | null {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  if (!paintGradient(c.getContext("2d")!, spec, c.width, c.height)) return null;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function alphaTextureOf(src: string, w: number, h: number): Promise<THREE.CanvasTexture> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h);
      // alphaMap reads green: copy alpha into rgb
      for (let i = 0; i < d.data.length; i += 4) {
        const a = d.data[i + 3];
        d.data[i] = d.data[i + 1] = d.data[i + 2] = a;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      ok(new THREE.CanvasTexture(c));
    };
    img.onerror = () => fail(new Error("image"));
    img.src = src;
  });
}

function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      (mat as THREE.MeshStandardMaterial).map?.dispose();
      (mat as THREE.MeshStandardMaterial).alphaMap?.dispose();
      mat.dispose();
    }
  });
  g.clear();
}

type Preview3DProps = { doc: WordArtDoc; mark: Mark | null; mode?: "png" | "video"; playback?: Playback; overrides?: Record<string, unknown> | null };

export const Preview3D = React.forwardRef<Preview3DHandle, Preview3DProps>(function Preview3D({ doc: raw, mark, mode = "png", playback = STILL_PLAYBACK, overrides }, ref) {
  const video = mode === "video";
  const ms = usePlayback(playback, (s) => s.ms);
  const running = usePlayback(playback, isRunning);
  const rendering = usePlayback(playback, (s) => s.take === "rendering");
  // read by the preview loop: while rendering, OrbitControls must not move the camera (its damping would
  // keep turning it for a while after auto-rotate stops), so the camera is exactly where the moment puts it
  const renderingRef = React.useRef(false);
  renderingRef.current = rendering;
  const doc = video || raw.timeline ? applyOverrides(docAt(raw, ms), overrides) : raw;
  const bgClock = video && running ? shaderClock(raw, "background", ms) : undefined;
  const docRef = React.useRef(doc);
  docRef.current = doc;
  // the frame size the renderer draws at in record mode (read by size())
  const videoSize = React.useRef<[number, number] | null>(null);
  const fillTex = React.useRef<{ tex: THREE.CanvasTexture; canvas: HTMLCanvasElement; key: string } | null>(null);
  const mats = React.useRef<{ cap: THREE.MeshStandardMaterial[]; side: THREE.MeshStandardMaterial[] }>({ cap: [], side: [] });
  const built = React.useRef<{ mesh: THREE.Mesh | null; depth: number }>({ mesh: null, depth: 1 });
  const stageEl = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const bgCache = React.useRef<LayerCache>({});
  const host = React.useRef<HTMLDivElement>(null);
  const three = React.useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    pivot: THREE.Group; art: THREE.Group; size: () => void; markDims: [number, number];
  } | null>(null);
  const [glError, setGlError] = React.useState(false);
  const [W, H] = FRAMES[doc.frame];

  React.useEffect(() => {
    const el = stageEl.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  // ── renderer, scene, loop (once) ──────────────────────────────────────────
  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      setGlError(true);
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, DIST);
    // lit so the faces read close to the gradient's own colours: soft ambient, a front fill,
    // a warm key from upper left (bevels catch it) and a cool rim behind
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a34, 1.5));
    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(0, 0, 10);
    scene.add(fill);
    const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
    key.position.set(-4, 6, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 1.1);
    rim.position.set(5, -2, -6);
    scene.add(rim);
    const pivot = new THREE.Group();
    const art = new THREE.Group();
    pivot.add(art);
    scene.add(pivot);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 24;

    const size = () => {
      const vs = videoSize.current;
      if (vs) renderer.setPixelRatio(1);
      else renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const w = vs ? vs[0] : el.clientWidth || 1, h = vs ? vs[1] : el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    let raf = 0;
    const loop = () => {
      if (!renderingRef.current) controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    three.current = { renderer, scene, camera, controls, pivot, art, size, markDims: [1, 1] };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      disposeGroup(art);
      (scene.background as THREE.Texture | null)?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss(); // free the context now; each 2D/3D toggle makes a new renderer
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  // ── the mark, extruded ────────────────────────────────────────────────────
  React.useEffect(() => {
    const t = three.current;
    if (!t || !mark) return;
    let cancelled = false;
    const doc = docRef.current;
    disposeGroup(t.art);
    const w = window as unknown as { __waTest?: boolean; __waStats?: { builds: number } };
    if (w.__waTest) (w.__waStats ??= { builds: 0 }).builds++;
    const [bx, by, bw, bh] = mark.box;
    const long = Math.max(bw, bh);
    const texW = 1024, texH = Math.max(2, Math.round((1024 * bh) / bw));
    const fillTexture = textureOf(doc.fill, texW, texH);
    fillTex.current = fillTexture ? { tex: fillTexture, canvas: fillTexture.image as HTMLCanvasElement, key: JSON.stringify(doc.fill) } : null;
    const cap = new THREE.MeshStandardMaterial({ map: fillTexture, metalness: doc.metal / 100, roughness: doc.rough / 100 });
    const side =
      doc.sides === "gradient"
        ? new THREE.MeshStandardMaterial({ map: fillTexture, color: 0xb0b0b0, metalness: doc.metal / 100, roughness: Math.min(1, doc.rough / 100 + 0.1) })
        : new THREE.MeshStandardMaterial({ color: doc.sides === "colour" ? doc.sideColor : "#1E1B17", metalness: doc.metal / 100, roughness: Math.min(1, doc.rough / 100 + 0.15) });
    built.current = { mesh: null, depth: 1 };

    (async () => {
      if (mark.image) {
        const alpha = await alphaTextureOf(mark.image.src, texW, texH);
        if (cancelled) return alpha.dispose();
        const m = new THREE.MeshStandardMaterial({ map: fillTexture, alphaMap: alpha, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, metalness: doc.metal / 100, roughness: doc.rough / 100 });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), m);
        t.art.add(plane);
        mats.current = { cap: [m], side: [] };
        cap.dispose();
        side.dispose();
      } else {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg">${mark.paths.map((p) => `<path d="${p.d}" fill="#000" fill-rule="${p.rule}"/>`).join("")}</svg>`;
        const shapes = new SVGLoader().parse(svg).paths.flatMap((p) => SVGLoader.createShapes(p));
        const depth = (doc.depth / 100) * long * 0.22;
        const bevel = (doc.bevel / 100) * long * 0.012;
        const geo = new THREE.ExtrudeGeometry(shapes, {
          depth: Math.max(0.01, depth),
          bevelEnabled: bevel > 0,
          bevelThickness: bevel,
          bevelSize: bevel * 0.8,
          bevelSegments: 4,
          curveSegments: 14,
        });
        // planar UVs from the mark's box: the gradient lies across the logo the way it does in 2D
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = (pos.getX(i) - bx) / bw;
          uv[i * 2 + 1] = 1 - (pos.getY(i) - by) / bh;
        }
        geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        geo.translate(-(bx + bw / 2), -(by + bh / 2), -depth / 2);
        geo.rotateX(Math.PI); // SVG y runs down
        const mesh = new THREE.Mesh(geo, [cap, side]);
        t.art.add(mesh);
        mats.current = { cap: [cap], side: [side] };
        built.current = { mesh, depth: Math.max(0.01, doc.depth) };
      }
      t.markDims = [bw, bh];
      fit(t, doc);
    })();
    return () => { cancelled = true; };
    // record mode scales depth instead of rebuilding (see the effect below); the still editor rebuilds
  }, [mark, doc.bevel, doc.sides, video ? 0 : doc.depth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── per-frame changes, in place ───────────────────────────────────────────
  React.useEffect(() => {
    const b = built.current;
    if (b.mesh) b.mesh.scale.z = Math.max(0.01, doc.depth) / b.depth;
  }, [doc.depth, mark, doc.bevel, doc.sides]);
  React.useEffect(() => {
    for (const m of mats.current.cap) { m.metalness = doc.metal / 100; m.roughness = doc.rough / 100; }
    for (const m of mats.current.side) {
      m.metalness = doc.metal / 100;
      m.roughness = Math.min(1, doc.rough / 100 + (doc.sides === "gradient" ? 0.1 : 0.15));
      if (doc.sides === "colour") m.color.set(doc.sideColor);
    }
  }, [doc.metal, doc.rough, doc.sideColor, doc.sides, mark, doc.bevel]);
  const fillKey = JSON.stringify(doc.fill);
  React.useEffect(() => {
    const f = fillTex.current;
    if (!f || f.key === fillKey) return;
    f.key = fillKey;
    paintGradient(f.canvas.getContext("2d")!, docRef.current.fill, f.canvas.width, f.canvas.height);
    f.tex.needsUpdate = true;
  }, [fillKey]);

  // ── background, size, tilt, spin ──────────────────────────────────────────
  React.useEffect(() => {
    const t = three.current;
    if (!t) return;
    (t.scene.background as THREE.Texture | null)?.dispose?.();
    t.scene.background = null; // the live background layer sits behind the transparent canvas
    t.renderer.setClearColor(0x000000, 0);
  }, []);

  // record mode draws at the frame size; the still editor at the element's size
  React.useEffect(() => {
    videoSize.current = video ? [W, H] : null;
    three.current?.size();
    if (three.current) fit(three.current, docRef.current);
  }, [video, W, H]);

  React.useEffect(() => {
    const t = three.current;
    if (!t) return;
    fit(t, doc);
    t.pivot.rotation.x = (doc.tilt * Math.PI) / 180;
    t.controls.autoRotate = doc.spin > 0 && !rendering;
    t.controls.autoRotateSpeed = (doc.spin / 100) * 8;
  }, [doc.size, doc.tilt, doc.spin, doc.frame, rendering]); // eslint-disable-line react-hooks/exhaustive-deps

  // a render places the camera from the moment, not the clock: the start view turned round the target at
  // OrbitControls' autoRotate rate (autoRotateSpeed 2 = one turn per 30 s)
  const renderStart = React.useRef<THREE.Vector3 | null>(null);
  React.useEffect(() => {
    const t = three.current;
    if (!t) return;
    if (!rendering) {
      if (renderStart.current) { t.camera.position.copy(renderStart.current); renderStart.current = null; t.controls.update(); }
      return;
    }
    renderStart.current ??= t.camera.position.clone();
    const rate = (((docRef.current.spin / 100) * 8) * 2 * Math.PI) / 60; // rad per second
    const off = renderStart.current.clone().sub(t.controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -rate * (ms / 1000));
    t.camera.position.copy(t.controls.target).add(off);
    t.camera.lookAt(t.controls.target);
  }, [rendering, ms]);

  React.useImperativeHandle(ref, () => ({
    drawFrame(ctx) {
      const t = three.current, d = docRef.current;
      if (!t || !video) return false;
      // the preview loop has just rendered this frame (preserveDrawingBuffer keeps it): read it, no second render
      const w = window as unknown as { __waTest?: boolean; __waStats?: { builds: number; cam?: Array<[number, number]> } };
      if (w.__waTest && w.__waStats) {
        const o = t.camera.position.clone().sub(t.controls.target);
        (w.__waStats.cam ??= []).push([playback.get().ms, Math.atan2(o.x, o.z)]);
      }
      ctx.clearRect(0, 0, W, H);
      if (d.background) ctx.drawImage(layerSource(stageEl.current?.querySelector(".wa-bg3d") ?? null, d.background, W, H, bgCache.current), 0, 0, W, H);
      ctx.drawImage(t.renderer.domElement, 0, 0, W, H);
      return true;
    },
    ready() {
      return !!three.current && layerReady(stageEl.current?.querySelector(".wa-bg3d") ?? null, docRef.current.background);
    },
    resetView() {
      const t = three.current;
      if (!t) return;
      t.camera.position.set(0, 0, DIST);
      t.controls.target.set(0, 0, 0);
      t.controls.update();
    },
    async exportPng(width, height) {
      const t = three.current;
      if (!t) throw new Error("3D view is not ready.");
      // the scene renders transparent; the background is the live layer as it looks now (a shader at this
      // moment), or its painted gradient where a shader hasn't drawn yet (layerSource falls back to it)
      const ratio = t.renderer.getPixelRatio();
      t.renderer.setPixelRatio(1);
      t.renderer.setSize(width, height, false);
      t.camera.aspect = width / height;
      t.camera.updateProjectionMatrix();
      fit(t, doc);
      t.renderer.render(t.scene, t.camera);
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const x = out.getContext("2d")!;
      if (doc.background) x.drawImage(layerSource(stageEl.current?.querySelector(".wa-bg3d") ?? null, doc.background, width, height, {}), 0, 0, width, height);
      x.drawImage(t.renderer.domElement, 0, 0, width, height);
      t.renderer.setPixelRatio(ratio);
      t.size(); // back to the element's size, or the frame size in record mode
      fit(t, doc);
      return new Promise<Blob>((ok, fail) => out.toBlob((b) => (b ? ok(b) : fail(new Error("PNG"))), "image/png"));
    },
  }));

  return (
    <div ref={stageEl} className={`wa-stage wa-stage--3d${doc.background ? "" : " wa-checker"}`} style={stageStyle(W, H)} data-ms={video ? Math.round(ms) : undefined}>
      {/* the background layer is laid out at the frame size (scaled to fit) with readable canvases, so a PNG or a take copies it at full size */}
      {doc.background && (
        <div className="wa-frame" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <GradientBackground value={doc.background} className="wa-layer wa-bg3d" style={LAYER} clock={bgClock} capture />
        </div>
      )}
      <div ref={host} className="wa-gl" />
      {glError && <p className="studio-hint wa-glerror">This browser couldn't start WebGL, so 3D isn't available here. 2D works as usual.</p>}
    </div>
  );
});

/** Scale the art so its longer side is `size`% of the visible frame's shorter side. */
function fit(t: { camera: THREE.PerspectiveCamera; art: THREE.Group; markDims: [number, number] }, doc: Pick<WordArtDoc, "size">) {
  const visH = 2 * DIST * Math.tan(((FOV / 2) * Math.PI) / 180);
  const visW = visH * t.camera.aspect;
  const [bw, bh] = t.markDims;
  // `size`% of the visible frame, fitted in both directions (same rule as the 2D layout)
  t.art.scale.setScalar((doc.size / 100) * Math.min(visW / Math.max(bw, 1), visH / Math.max(bh, 1)));
}
