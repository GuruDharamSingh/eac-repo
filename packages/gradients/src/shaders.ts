// ============================================================================
// WebGL backgrounds (GLSL ES 1.00, so every WebGL browser runs them).
//
// All four share one header: the spec's stops arrive as OKLab colours and
// positions, `ramp(t)` mixes them in OKLab exactly like the CSS does, and the
// result is converted to sRGB on the GPU. Each shader only decides which t a
// pixel gets.
//
//   mineral  domain-warped fBm: a pigment wash with mottling and faint
//            craquelure, like the tsakli paint; drifts slowly
//   aurora   curtains of the ramp rising over the base, folding in time
//   halo     the EAC rings: concentric bands, colour travelling round them
//   silk     a soft, slowly folding field of the ramp; the general background
//
// `shaderUniforms(spec)` is pure (tested); the React layer is ShaderCanvas.
// ============================================================================

import { hexToOklab } from "./color";
import { adjustedStops } from "./generate";
import { baseColor } from "./css";
import { OWN_SHADERS, type GradientSpec } from "./spec";

export const MAX_STOPS = 8;

const HEADER = /* glsl */ `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_lab[${MAX_STOPS}];
uniform float u_pos[${MAX_STOPS}];
uniform float u_n;
uniform vec3 u_base;      // OKLab
uniform vec2 u_center;    // 0..1, y down
uniform float u_angle;    // radians
uniform float u_scale;    // 0..1
uniform float u_soft;     // 0..1
uniform float u_count;
uniform float u_seed;
uniform float u_grain;    // 0..1

vec3 oklab2srgb(vec3 c) {
  float l = pow(c.x + 0.3963377774 * c.y + 0.2158037573 * c.z, 3.0);
  float m = pow(c.x - 0.1055613458 * c.y - 0.0638541728 * c.z, 3.0);
  float s = pow(c.x - 0.0894841775 * c.y - 1.2914855480 * c.z, 3.0);
  vec3 lin = vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  lin = clamp(lin, 0.0, 1.0);
  vec3 lo = lin * 12.92;
  vec3 hi = 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), lin));
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c = u_lab[0];
  for (int i = 1; i < ${MAX_STOPS}; i++) {
    if (float(i) >= u_n) break;
    float a = u_pos[i - 1], b = u_pos[i];
    float k = clamp((t - a) / max(b - a, 1e-4), 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    if (t >= a) c = mix(u_lab[i - 1], u_lab[i], k);
  }
  return c;
}

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21) + u_seed * 0.0137); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03; a *= 0.5; }
  return v;
}
vec2 uv() {
  vec2 p = gl_FragCoord.xy / u_res;
  p.y = 1.0 - p.y;
  return p;
}
vec2 aspectUv() {
  vec2 p = uv();
  p.x *= u_res.x / u_res.y;
  return p;
}
vec4 finish(vec3 lab) {
  vec3 c = oklab2srgb(lab);
  float g = (hash(gl_FragCoord.xy + fract(u_time) * 61.0) - 0.5) * u_grain * 0.14;
  return vec4(c + g, 1.0);
}
`;

const MINERAL = /* glsl */ `
void main() {
  vec2 p = aspectUv() * (1.6 + (1.0 - u_scale) * 3.0);
  float t = u_time * 0.02;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * 0.6), fbm(p + 3.5 * q + vec2(8.3, 2.8)));
  float f = fbm(p + 3.0 * r);
  float v = mix(0.5, f * 1.35 - 0.1, 0.4 + 0.6 * u_soft);
  vec3 lab = ramp(v);
  // mottling: lightness wanders like hand-ground pigment
  lab.x *= 0.92 + 0.16 * fbm(p * 3.1 + 7.0);
  // faint craquelure from cell edges of a stretched noise
  float cr = smoothstep(0.02, 0.0, abs(noise(p * 9.0 + r * 2.0) - 0.5) - 0.002);
  lab.x -= cr * 0.035;
  gl_FragColor = finish(mix(u_base, lab, 0.35 + 0.65 * smoothstep(0.05, 0.6, f + 0.2)));
}
`;

const AURORA = /* glsl */ `
void main() {
  vec2 p = uv();
  float t = u_time * 0.05;
  float x = p.x * (2.0 + u_scale * 3.0);
  float curtain = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float w = sin(x * (1.3 + fi * 0.7) + t * (1.0 + fi * 0.4) + fbm(vec2(x * 0.7, t + fi)) * 3.0);
    float y = 0.35 + 0.12 * fi + 0.08 * w;
    curtain += smoothstep(0.32 - 0.2 * u_soft, 0.0, abs(p.y - y)) * (0.75 - fi * 0.18);
  }
  float streak = fbm(vec2(x * 4.0, p.y * 0.6 - t * 2.0));
  float k = fract(p.x * 0.6 + streak * 0.5 + t * 0.2);
  vec3 lab = ramp(abs(k * 2.0 - 1.0));
  float a = clamp(curtain * (0.85 + 0.9 * streak) * 1.25, 0.0, 1.0);
  gl_FragColor = finish(mix(u_base, lab, a));
}
`;

const HALO = /* glsl */ `
void main() {
  vec2 p = aspectUv();
  vec2 c = u_center * vec2(u_res.x / u_res.y, 1.0);
  vec2 d = p - c;
  float r = length(d);
  float ang = atan(d.y, d.x) + u_angle + u_time * 0.08;
  float outer = 0.18 + u_scale * 0.32;
  float rings = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_count) break;
    float ri = outer - float(i) * (outer * 0.09 + 0.012);
    // noise sampled on the circle itself (cos, sin), so the wobble has no seam where the angle wraps
    float wob = fbm(vec2(cos(ang), sin(ang)) * 2.0 + vec2(float(i) * 3.1, u_time * 0.05)) * 0.01;
    float w = 0.0025 + u_soft * 0.006;
    rings += smoothstep(w * 2.0, 0.0, abs(r - ri - wob));
  }
  // colour travels round each ring, like the gradient rings of the EAC mark; mirrored so the
  // ramp's two ends never meet in a seam
  vec3 lab = ramp(abs(fract(ang / 6.2831853 + 0.5) * 2.0 - 1.0));
  float glow = smoothstep(outer, 0.0, r) * 0.12;
  gl_FragColor = finish(mix(u_base, lab, clamp(rings + glow, 0.0, 1.0)));
}
`;

const SILK = /* glsl */ `
void main() {
  vec2 p = uv();
  float t = u_time * 0.03;
  vec2 dir = vec2(cos(u_angle), sin(u_angle));
  float f = 1.0 + u_scale * 3.0;
  // the warp only displaces; the ramp still runs edge to edge along the angle
  vec2 w = 0.12 * vec2(sin(p.y * f * 3.0 + t * 2.0), cos(p.x * f * 2.5 - t * 1.6))
         + 0.10 * vec2(fbm(p * f * 1.5 + t) - 0.5, fbm(p * f * 1.5 - t) - 0.5);
  float v = dot(p + w - 0.5, dir) * (0.85 + 0.3 * u_soft) + 0.5;
  gl_FragColor = finish(ramp(v));
}
`;

const VERTEX = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export type OwnShader = (typeof OWN_SHADERS)[number];
export const isOwnShader = (s: string): s is OwnShader => (OWN_SHADERS as readonly string[]).includes(s);

export const SHADER_SOURCES: Record<OwnShader, string> = {
  mineral: HEADER + MINERAL,
  aurora: HEADER + AURORA,
  halo: HEADER + HALO,
  silk: HEADER + SILK,
};
export const VERTEX_SOURCE = VERTEX;

export interface ShaderUniforms {
  lab: Float32Array; // MAX_STOPS * 3
  pos: Float32Array; // MAX_STOPS
  n: number;
  base: [number, number, number];
  center: [number, number];
  angle: number;
  scale: number;
  soft: number;
  count: number;
  seed: number;
  grain: number;
  /** Seconds of animation per real second; 0 = still. */
  speed: number;
}

/** Uniform values for a (clean) spec. Pure. */
export function shaderUniforms(spec: GradientSpec): ShaderUniforms {
  const stops = adjustedStops(spec).slice(0, MAX_STOPS);
  const lab = new Float32Array(MAX_STOPS * 3);
  const pos = new Float32Array(MAX_STOPS);
  stops.forEach((s, i) => {
    lab.set(hexToOklab(s.color), i * 3);
    pos[i] = s.at / 100;
  });
  return {
    lab,
    pos,
    n: stops.length,
    base: hexToOklab(baseColor(spec)),
    center: [spec.cx / 100, spec.cy / 100],
    angle: (spec.angle * Math.PI) / 180,
    scale: spec.scale / 100,
    soft: spec.softness / 100,
    count: Math.max(1, Math.min(8, spec.count)),
    seed: spec.seed,
    grain: spec.grain / 100,
    speed: (spec.motion / 100) * 2,
  };
}
