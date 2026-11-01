import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * The parlour's surfaces, painted on canvases at mount rather than shipped as
 * image files. A room of photographic textures would weigh more than the
 * painting it exists to show; these cost nothing to download and are seeded,
 * so the room looks the same on every visit.
 */

/** Size, in metres, that one repeat of each tiling texture covers. */
export const FLOOR_TILE = 2;
export const PAPER_TILE = 0.55;
export const PANEL_TILE = { width: 1, height: 0.9 } as const;

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

function toTexture(canvas: HTMLCanvasElement, tiling = true): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  if (tiling) texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Dark oak boards, running toward the art wall. */
function floorboards(): CanvasTexture {
  const size = 1024;
  const plank = 64;
  const { canvas, ctx } = surface(size, size);
  const rand = seeded(11);

  for (let x = 0; x < size; x += plank) {
    let y = -Math.floor(rand() * 500);
    while (y < size) {
      const length = 320 + rand() * 420;
      const l = 15 + rand() * 7;
      ctx.fillStyle = `hsl(${22 + rand() * 6}, ${38 + rand() * 10}%, ${l}%)`;
      ctx.fillRect(x, y, plank, length);

      // Grain: long, slightly wandering streaks.
      for (let g = 0; g < 14; g++) {
        const gx = x + 4 + rand() * (plank - 8);
        ctx.strokeStyle = `rgba(20, 10, 4, ${0.08 + rand() * 0.12})`;
        ctx.lineWidth = 0.6 + rand() * 1.4;
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.bezierCurveTo(gx + rand() * 6 - 3, y + length / 3, gx + rand() * 6 - 3, y + (2 * length) / 3, gx, y + length);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(8, 4, 2, 0.85)';
      ctx.fillRect(x, y + length - 2, plank, 2);
      y += length;
    }
    ctx.fillStyle = 'rgba(8, 4, 2, 0.9)';
    ctx.fillRect(x, 0, 2, size);
  }
  return toTexture(canvas);
}

/** Deep green paper: a faint stripe under a small damask sprig. */
function wallpaper(): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = surface(size, size);

  ctx.fillStyle = '#22352a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 8; i++) {
    if (i % 2) continue;
    ctx.fillStyle = 'rgba(46, 70, 54, 0.55)';
    ctx.fillRect((i * size) / 8, 0, size / 8, size);
  }

  const sprig = (cx: number, cy: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(64, 92, 66, 0.75)';
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, -22, 9, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(176, 150, 92, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(0, 48);
    ctx.moveTo(-48, 0);
    ctx.lineTo(48, 0);
    ctx.stroke();
    ctx.restore();
  };

  // Centre and the four corners, so the motif tiles into a half-drop.
  sprig(size / 2, size / 2);
  for (const [cx, cy] of [[0, 0], [size, 0], [0, size], [size, size]] as const) sprig(cx, cy);
  return toTexture(canvas);
}

/** Mahogany dado panelling: one raised panel per repeat. */
function panelling(): CanvasTexture {
  const w = 512;
  const h = 460;
  const { canvas, ctx } = surface(w, h);
  const rand = seeded(29);
  const toPx = (metres: number) => ((PANEL_TILE.height - metres) / PANEL_TILE.height) * h;

  ctx.fillStyle = '#35190f';
  ctx.fillRect(0, 0, w, h);
  for (let g = 0; g < 70; g++) {
    ctx.strokeStyle = `rgba(14, 6, 2, ${0.1 + rand() * 0.15})`;
    ctx.lineWidth = 0.8 + rand();
    const gx = rand() * w;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx + rand() * 8 - 4, h);
    ctx.stroke();
  }

  const x0 = 42;
  const x1 = w - 42;
  const y0 = toPx(0.8);
  const y1 = toPx(0.28);
  ctx.fillStyle = 'rgba(78, 42, 26, 0.55)';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Bevel: lit from above-left, which is roughly where the sconces are.
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(120, 76, 48, 0.75)';
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(10, 4, 2, 0.85)';
  ctx.beginPath();
  ctx.moveTo(x1, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x0, y1);
  ctx.stroke();
  return toTexture(canvas);
}

/** A Persian-style rug: crimson field, navy border, a central medallion. */
function rug(): CanvasTexture {
  const w = 1024;
  const h = 768;
  const { canvas, ctx } = surface(w, h);
  const rand = seeded(53);

  ctx.fillStyle = '#5a1515';
  ctx.fillRect(0, 0, w, h);

  const band = (inset: number, width: number, colour: string) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.strokeRect(inset + width / 2, inset + width / 2, w - 2 * inset - width, h - 2 * inset - width);
  };
  band(0, 86, '#1a2240');
  band(18, 6, '#b8893f');
  band(62, 4, '#b8893f');
  band(86, 14, '#8a2b1e');
  band(100, 3, '#d8c7a0');

  // Border repeat: small lozenges along the navy band.
  ctx.fillStyle = '#9c3b26';
  for (let x = 60; x < w - 40; x += 46) {
    for (const y of [43, h - 43]) diamond(ctx, x, y, 12, 9);
  }
  for (let y = 60; y < h - 40; y += 46) {
    for (const x of [43, w - 43]) diamond(ctx, x, y, 9, 12);
  }

  // Field: a lattice of tiny sprigs.
  ctx.fillStyle = 'rgba(196, 150, 80, 0.45)';
  for (let y = 140; y < h - 120; y += 44) {
    for (let x = 140 + ((y / 44) % 2) * 22; x < w - 120; x += 44) diamond(ctx, x, y, 5, 5);
  }

  // Medallion.
  const cx = w / 2;
  const cy = h / 2;
  const layers: Array<[number, number, string]> = [
    [250, 190, '#1a2240'],
    [228, 170, '#b8893f'],
    [214, 158, '#7a1d1a'],
    [150, 112, '#d8c7a0'],
    [132, 98, '#1a2240'],
    [70, 52, '#b8893f'],
    [44, 32, '#5a1515'],
  ];
  for (const [rx, ry, colour] of layers) {
    ctx.fillStyle = colour;
    diamond(ctx, cx, cy, rx, ry);
  }

  // Wear and pile.
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,230,200,0.05)';
    ctx.fillRect(rand() * w, rand() * h, 2, 2);
  }
  return toTexture(canvas, false);
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - ry);
  ctx.lineTo(x + rx, y);
  ctx.lineTo(x, y + ry);
  ctx.lineTo(x - rx, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * What lies past the French doors: a garden at dusk, kept soft on purpose. It
 * is there to make the room feel like part of a house, not to compete with the
 * painting, so it is never more than shapes against a fading sky.
 */
function dusk(): CanvasTexture {
  const w = 1024;
  const h = 512;
  const { canvas, ctx } = surface(w, h);
  const rand = seeded(71);
  const horizon = h * 0.64;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#1e2c4e');
  sky.addColorStop(0.5, '#465c8c');
  sky.addColorStop(0.86, '#b5876c');
  sky.addColorStop(1, '#e0a46e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = '#10140f';
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.filter = 'blur(6px)';
  ctx.fillStyle = '#0c100b';
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    const r = 40 + rand() * 90;
    const top = horizon - r * (0.8 + rand() * 1.4);
    ctx.beginPath();
    ctx.ellipse(x, top + r, r * 0.8, r * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#080b07';
  ctx.fillRect(0, horizon + 10, w, h);

  // A few lit windows far off across the garden.
  ctx.filter = 'blur(2px)';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(255, 186, 112, 0.85)';
    ctx.fillRect(120 + rand() * (w - 240), horizon - 18 - rand() * 30, 5, 7);
  }
  ctx.filter = 'none';
  return toTexture(canvas, false);
}

/** A soft dark pool, laid under furniture in place of real shadows. */
function contactShadow(): CanvasTexture {
  const size = 128;
  const { canvas, ctx } = surface(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.7)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.38)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas, false);
}

export interface ParlourTextures {
  floor: CanvasTexture;
  paper: CanvasTexture;
  panel: CanvasTexture;
  rug: CanvasTexture;
  dusk: CanvasTexture;
  shadow: CanvasTexture;
}

export function createParlourTextures(): ParlourTextures {
  return {
    floor: floorboards(),
    paper: wallpaper(),
    panel: panelling(),
    rug: rug(),
    dusk: dusk(),
    shadow: contactShadow(),
  };
}

export function disposeParlourTextures(textures: ParlourTextures) {
  for (const texture of Object.values(textures)) texture.dispose();
}
