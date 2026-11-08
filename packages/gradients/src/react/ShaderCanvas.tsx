"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// useLayoutEffect warns during server rendering; the canvas only draws in the browser anyway
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
import { SHADER_SOURCES, VERTEX_SOURCE, shaderUniforms, MAX_STOPS, isOwnShader } from "../shaders";
import type { GradientSpec } from "../spec";

/**
 * A WebGL layer drawing one of the package shaders for a (clean) spec.
 * Absolutely fills its parent; the parent's CSS gradient stays underneath as
 * the fallback, so a failed context simply shows nothing extra.
 *
 * Costs are kept small on purpose: pixel ratio capped at 1.5 (mineral renders
 * at 0.6 of that), the loop stops when the canvas is off screen or the tab is
 * hidden, and reduced-motion viewers (or motion 0) get one still frame.
 */
export function ShaderCanvas({ spec, className, style, frame }: {
  spec: GradientSpec;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Milliseconds of animation to draw, for frame-by-frame renders (Remotion):
   * when given, the canvas draws that moment and never runs its own clock.
   */
  frame?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const redrawRef = useRef<(() => void) | null>(null);
  const kind = spec.shader;
  useIsoLayoutEffect(() => { redrawRef.current?.(); }, [spec, frame]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !isOwnShader(kind)) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl || gl.isContextLost()) { canvas.style.display = "none"; return; }
    // browsers cap live contexts (~16); a lost one hides itself so the CSS fallback shows
    const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); raf = -1; canvas.style.display = "none"; };
    canvas.addEventListener("webglcontextlost", onLost);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (!gl.isContextLost()) console.warn(`[gradients] ${kind} shader did not compile:`, gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fs = compile(gl.FRAGMENT_SHADER, SHADER_SOURCES[kind as keyof typeof SHADER_SOURCES]);
    if (!vs || !fs) { canvas.style.display = "none"; return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = "none"; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = {
      res: U("u_res"), time: U("u_time"), lab: U("u_lab"), pos: U("u_pos"), n: U("u_n"), base: U("u_base"),
      center: U("u_center"), angle: U("u_angle"), scale: U("u_scale"), soft: U("u_soft"), count: U("u_count"),
      seed: U("u_seed"), grain: U("u_grain"),
    };

    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const quality = kind === "mineral" ? 0.6 : 1;
    let raf = 0, visible = true, t = 0, last = performance.now();

    const size = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1) * quality;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    };
    const draw = () => {
      const s = shaderUniforms(specRef.current);
      size();
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform3fv(u.lab, s.lab);
      gl.uniform1fv(u.pos, s.pos);
      gl.uniform1f(u.n, Math.min(MAX_STOPS, s.n));
      gl.uniform3f(u.base, ...s.base);
      gl.uniform2f(u.center, ...s.center);
      gl.uniform1f(u.angle, s.angle);
      gl.uniform1f(u.scale, s.scale);
      gl.uniform1f(u.soft, s.soft);
      gl.uniform1f(u.count, s.count);
      gl.uniform1f(u.seed, s.seed);
      gl.uniform1f(u.grain, s.grain);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const loop = (now: number) => {
      const speed = shaderUniforms(specRef.current).speed;
      const fixed = frameRef.current;
      if (fixed !== undefined) t = (fixed / 1000) * speed; // deterministic: the render's clock, not ours
      else t += ((now - last) / 1000) * speed;
      last = now;
      draw();
      if (fixed === undefined && visible && speed > 0 && !reduced) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const kick = () => { if (raf === 0) { last = performance.now(); raf = requestAnimationFrame(loop); } };

    const io = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting && document.visibilityState === "visible"; if (visible) kick(); })
      : null;
    io?.observe(canvas);
    const onVis = () => { visible = document.visibilityState === "visible"; if (visible) kick(); };
    document.addEventListener("visibilitychange", onVis);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => kick()) : null;
    ro?.observe(canvas);
    // editors change the spec without remounting: a still canvas redraws when the spec changes
    // frame mode draws synchronously, so a frame-by-frame renderer captures the finished frame
    redrawRef.current = () => {
      const fixed = frameRef.current;
      if (fixed === undefined) return kick();
      t = (fixed / 1000) * shaderUniforms(specRef.current).speed;
      draw();
    };
    kick();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      redrawRef.current = null;
      io?.disconnect(); ro?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [kind]);

  if (!isOwnShader(kind)) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none", ...style }}
    />
  );
}
