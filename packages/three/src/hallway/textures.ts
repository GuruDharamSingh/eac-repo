import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * The hallway's surfaces, painted on canvases at mount: nothing to download,
 * and seeded so the hall looks the same every visit.
 */

/** Metres one repeat of each texture covers. */
export const CARPET_TILE = 1;
export const SLATE_TILE = { width: 1.2, height: 0.95 } as const;
export const PLASTER_TILE = 2;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Deep green wool: a fine speckled pile, nothing that reads as pattern. */
function carpet(): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = surface(size, size);
  const rand = seeded(5);
  ctx.fillStyle = '#1f3a2a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 7000; i++) {
    const l = rand();
    ctx.fillStyle = l > 0.5 ? `rgba(70, 110, 84, ${0.12 + rand() * 0.12})` : `rgba(6, 18, 10, ${0.15 + rand() * 0.15})`;
    ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
  }
  return toTexture(canvas);
}

/**
 * Riven slate in coursed slabs: blue-grey, each slab a slightly different
 * tone with faint cleavage lines, dark joints between.
 */
function slate(): CanvasTexture {
  const w = 512;
  const h = 406;
  const { canvas, ctx } = surface(w, h);
  const rand = seeded(17);
  const courses = [0, 0.3, 0.62, 1];
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, w, h);

  for (let c = 0; c < courses.length - 1; c++) {
    const y0 = Math.round(courses[c]! * h);
    const y1 = Math.round(courses[c + 1]! * h);
    let x = c % 2 ? -w / 4 : 0;
    while (x < w) {
      const slab = w / 2;
      const tone = 26 + rand() * 12;
      ctx.fillStyle = `hsl(${205 + rand() * 12}, ${10 + rand() * 8}%, ${tone}%)`;
      ctx.fillRect(x + 2, y0 + 2, slab - 4, y1 - y0 - 4);
      for (let k = 0; k < 18; k++) {
        ctx.strokeStyle = `rgba(${rand() > 0.5 ? '200,210,220' : '0,0,0'}, ${0.05 + rand() * 0.07})`;
        ctx.lineWidth = 0.5 + rand() * 1.5;
        const yy = y0 + 4 + rand() * (y1 - y0 - 8);
        ctx.beginPath();
        ctx.moveTo(x + 4, yy);
        ctx.lineTo(x + slab - 4, yy + rand() * 6 - 3);
        ctx.stroke();
      }
      x += slab;
    }
  }
  return toTexture(canvas);
}

/** Warm limewash: soft mottling, so a long wall is not a flat sheet. */
function plaster(): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = surface(size, size);
  const rand = seeded(41);
  ctx.fillStyle = '#d9cfbd';
  ctx.fillRect(0, 0, size, size);
  ctx.filter = 'blur(10px)';
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 248, 232, 0.18)' : 'rgba(150, 130, 100, 0.08)';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 14 + rand() * 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';
  return toTexture(canvas);
}

/** A soft pool of daylight laid on the carpet under each skylight. */
function lightPool(): CanvasTexture {
  const size = 128;
  const { canvas, ctx } = surface(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 250, 235, 0.45)');
  g.addColorStop(0.6, 'rgba(255, 250, 235, 0.14)');
  g.addColorStop(1, 'rgba(255, 250, 235, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface HallwayTextures {
  carpet: CanvasTexture;
  slate: CanvasTexture;
  plaster: CanvasTexture;
  pool: CanvasTexture;
}

export function createHallwayTextures(): HallwayTextures {
  return { carpet: carpet(), slate: slate(), plaster: plaster(), pool: lightPool() };
}

export function disposeHallwayTextures(t: HallwayTextures) {
  for (const texture of Object.values(t)) texture.dispose();
}
