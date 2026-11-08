"use client";

import * as React from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { paintGradient } from "@elkdonis/gradients";
import type { Mark } from "./mark";
import { FRAMES, type WordArtDoc } from "./doc";

// ============================================================================
// Word art in 3D (three.js, no R3F): the mark's outlines extruded with a
// bevel, the fill gradient painted to a texture and mapped across the faces
// by position (so the sides carry it too when sides = "gradient"), the
// background gradient as the scene backdrop. Drag to orbit, wheel to zoom.
// Shaders show as their painted gradient here (a texture is a still).
// ============================================================================

export interface Preview3DHandle {
  exportPng(width: number, height: number): Promise<Blob>;
  resetView(): void;
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

export const Preview3D = React.forwardRef<Preview3DHandle, { doc: WordArtDoc; mark: Mark | null }>(function Preview3D({ doc, mark }, ref) {
  const host = React.useRef<HTMLDivElement>(null);
  const three = React.useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    pivot: THREE.Group; art: THREE.Group; size: () => void; markDims: [number, number];
  } | null>(null);
  const [glError, setGlError] = React.useState(false);
  const [W, H] = FRAMES[doc.frame];

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
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    let raf = 0;
    const loop = () => {
      controls.update();
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
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  // ── the mark, extruded ────────────────────────────────────────────────────
  React.useEffect(() => {
    const t = three.current;
    if (!t || !mark) return;
    let cancelled = false;
    disposeGroup(t.art);
    const [bx, by, bw, bh] = mark.box;
    const long = Math.max(bw, bh);
    const texW = 1024, texH = Math.max(2, Math.round((1024 * bh) / bw));
    const fillTex = textureOf(doc.fill, texW, texH);
    const cap = new THREE.MeshStandardMaterial({ map: fillTex, metalness: doc.metal / 100, roughness: doc.rough / 100 });
    const side =
      doc.sides === "gradient"
        ? new THREE.MeshStandardMaterial({ map: fillTex, color: 0xb0b0b0, metalness: doc.metal / 100, roughness: Math.min(1, doc.rough / 100 + 0.1) })
        : new THREE.MeshStandardMaterial({ color: doc.sides === "colour" ? doc.sideColor : "#1E1B17", metalness: doc.metal / 100, roughness: Math.min(1, doc.rough / 100 + 0.15) });

    (async () => {
      if (mark.image) {
        const alpha = await alphaTextureOf(mark.image.src, texW, texH);
        if (cancelled) return alpha.dispose();
        const m = new THREE.MeshStandardMaterial({ map: fillTex, alphaMap: alpha, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, metalness: doc.metal / 100, roughness: doc.rough / 100 });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), m);
        t.art.add(plane);
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
        t.art.add(new THREE.Mesh(geo, [cap, side]));
      }
      t.markDims = [bw, bh];
      fit(t, doc);
    })();
    return () => { cancelled = true; };
  }, [mark, doc.fill, doc.depth, doc.bevel, doc.sides, doc.sideColor, doc.metal, doc.rough]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── background, size, tilt, spin ──────────────────────────────────────────
  React.useEffect(() => {
    const t = three.current;
    if (!t) return;
    (t.scene.background as THREE.Texture | null)?.dispose?.();
    t.scene.background = doc.background ? textureOf(doc.background, 1024, Math.round((1024 * H) / W)) : null;
    t.renderer.setClearColor(0x000000, 0);
  }, [doc.background, W, H]);

  React.useEffect(() => {
    const t = three.current;
    if (!t) return;
    fit(t, doc);
    t.pivot.rotation.x = (doc.tilt * Math.PI) / 180;
    t.controls.autoRotate = doc.spin > 0;
    t.controls.autoRotateSpeed = (doc.spin / 100) * 8;
  }, [doc.size, doc.tilt, doc.spin, doc.frame]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useImperativeHandle(ref, () => ({
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
      const prevBg = t.scene.background;
      if (doc.background) t.scene.background = textureOf(doc.background, 1024, Math.round((1024 * height) / width));
      const ratio = t.renderer.getPixelRatio();
      t.renderer.setPixelRatio(1);
      t.renderer.setSize(width, height, false);
      t.camera.aspect = width / height;
      t.camera.updateProjectionMatrix();
      fit(t, doc);
      t.renderer.render(t.scene, t.camera);
      const blob = await new Promise<Blob>((ok, fail) => t.renderer.domElement.toBlob((b) => (b ? ok(b) : fail(new Error("PNG"))), "image/png"));
      if (doc.background) (t.scene.background as THREE.Texture | null)?.dispose?.();
      t.scene.background = prevBg;
      t.renderer.setPixelRatio(ratio);
      t.size();
      fit(t, doc);
      return blob;
    },
  }));

  return (
    <div className={`wa-stage wa-stage--3d${doc.background ? "" : " wa-checker"}`} style={{ aspectRatio: `${W} / ${H}` }}>
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
