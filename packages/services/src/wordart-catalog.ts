/**
 * Generated word art: what a request may ask for, and how the rest is picked
 * (migration 301). Pure data and checks, safe to import in a client component.
 *
 * A request is the text plus optional pins (font, look, frame); everything not
 * pinned is random. The resolved design is stored with the job, so the renderer
 * needs no copy of these lists.
 */

export type WordArtFrame = '16:9' | '1:1' | '9:16' | '4:5';
export const WORDART_FRAME_SIZES: Record<WordArtFrame, [number, number]> = {
  '16:9': [1920, 1080],
  '1:1': [1080, 1080],
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
};

/**
 * Fonts allowed in generated pictures: the OFL families only. Brothers and
 * Religath carry personal-use and demo terms (StudioApp.tsx). Files live in
 * apps/arts-collective/public/fonts/wordart/.
 */
export const WORDART_GENERATED_FONTS = [
  { id: 'basteleur-bold', label: 'Basteleur Bold', file: 'Basteleur-Bold.woff' },
  { id: 'basteleur-moonlight', label: 'Basteleur Moonlight', file: 'Basteleur-Moonlight.woff' },
  { id: 'alfa-slab', label: 'Alfa Slab One', file: 'AlfaSlabOne-Regular.ttf' },
  { id: 'cinzel', label: 'Cinzel', file: 'Cinzel.ttf' },
] as const;

/** A paint: a preset of @elkdonis/gradients by id, or a straight run of colours. Painted only, no shaders. */
export type WordArtPaint = { preset: string } | { colors: string[]; angle: number };

/** Fill and background are chosen as a pair, which keeps the words readable. */
export interface WordArtLook {
  id: string;
  label: string;
  fill: WordArtPaint;
  background: WordArtPaint;
}

export const WORDART_LOOKS: readonly WordArtLook[] = [
  { id: 'ember-night', label: 'Ember on night', fill: { preset: 'ember' }, background: { colors: ['#100C14', '#2A1C24'], angle: 160 } },
  { id: 'gold-dusk', label: 'Gold on dusk', fill: { colors: ['#E2D7C8', '#D9BC8C', '#BA8A43'], angle: 160 }, background: { preset: 'mesh-dusk' } },
  { id: 'spectrum-ink', label: 'Spectrum on ink', fill: { preset: 'spectrum' }, background: { colors: ['#14121A', '#2A2533'], angle: 150 } },
  { id: 'cream-lapis', label: 'Cream on lapis', fill: { colors: ['#F1E9DC', '#D9BC8C'], angle: 180 }, background: { preset: 'tsakli' } },
  { id: 'ink-parchment', label: 'Ink on parchment', fill: { colors: ['#1E1B17', '#5A2A22'], angle: 160 }, background: { colors: ['#EFE7D8', '#D9BC8C'], angle: 135 } },
  { id: 'bone-moss', label: 'Bone on moss', fill: { colors: ['#E2D7C8', '#C1AF6E'], angle: 180 }, background: { preset: 'moss' } },
];

export const WORDART_MAX_CHARS = 120;
export const WORDART_MAX_WORDS = 20;
export const WORDART_MAX_LINES = 4;

export interface WordArtPins {
  font?: string;
  look?: string;
  frame?: WordArtFrame;
}

export interface WordArtRequest {
  orgId: string;
  /** Line breaks typed by the person are kept; otherwise the renderer chooses them. */
  text: string;
  pins: WordArtPins;
}

/** The full design the renderer draws (wordart_jobs.input). */
export interface WordArtDesign {
  text: string;
  frame: WordArtFrame;
  width: number;
  height: number;
  /** Tried in order: the first that has every character of the text is used. One entry when the font is pinned. */
  fonts: Array<{ id: string; label: string; file: string }>;
  look: WordArtLook;
}

export type WordArtCheck = { ok: true; request: WordArtRequest } | { ok: false; error: string };

const ORG_ID = /^[a-z0-9][a-z0-9_-]{0,49}$/i;

// control characters, zero-width and direction marks, line separators, byte-order mark
const UNPRINTABLE = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e\\ufeff]', 'g');

/** Whitespace tidied per line, empty lines and control characters dropped. */
function tidyText(raw: string): string {
  return raw
    .normalize('NFC')
    .split(/\r?\n/)
    .map((line) => line.replace(UNPRINTABLE, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** A request body, checked. An unknown pin is refused rather than quietly replaced by a random pick. */
export function cleanWordArtRequest(raw: unknown): WordArtCheck {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (typeof r.orgId !== 'string' || !ORG_ID.test(r.orgId)) return { ok: false, error: 'Say who the picture is for' };
  if (typeof r.text !== 'string') return { ok: false, error: 'Type the words first' };
  const text = tidyText(r.text.slice(0, WORDART_MAX_CHARS * 4));
  if (!text) return { ok: false, error: 'Type the words first' };
  if ([...text].length > WORDART_MAX_CHARS) return { ok: false, error: `At most ${WORDART_MAX_CHARS} characters` };
  if (text.split(/\s+/).length > WORDART_MAX_WORDS) return { ok: false, error: `At most ${WORDART_MAX_WORDS} words` };
  if (text.split('\n').length > WORDART_MAX_LINES) return { ok: false, error: `At most ${WORDART_MAX_LINES} lines` };

  const p = (r.pins && typeof r.pins === 'object' ? r.pins : {}) as Record<string, unknown>;
  const pins: WordArtPins = {};
  if (p.font !== undefined && p.font !== '') {
    if (!WORDART_GENERATED_FONTS.some((f) => f.id === p.font)) return { ok: false, error: 'That font is not available' };
    pins.font = p.font as string;
  }
  if (p.look !== undefined && p.look !== '') {
    if (!WORDART_LOOKS.some((l) => l.id === p.look)) return { ok: false, error: 'That colour pair is not available' };
    pins.look = p.look as string;
  }
  if (p.frame !== undefined && p.frame !== '') {
    if (typeof p.frame !== 'string' || !Object.prototype.hasOwnProperty.call(WORDART_FRAME_SIZES, p.frame)) {
      return { ok: false, error: 'That frame is not available' };
    }
    pins.frame = p.frame as WordArtFrame;
  }
  return { ok: true, request: { orgId: r.orgId, text, pins } };
}

function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Everything the request did not pin, picked at random. 16:9 unless another frame is pinned. */
export function resolveWordArtDesign(request: WordArtRequest, random: () => number = Math.random): WordArtDesign {
  const { pins } = request;
  const frame = pins.frame ?? '16:9';
  const [width, height] = WORDART_FRAME_SIZES[frame];
  const fonts = pins.font
    ? WORDART_GENERATED_FONTS.filter((f) => f.id === pins.font)
    : shuffled(WORDART_GENERATED_FONTS, random);
  const look = WORDART_LOOKS.find((l) => l.id === pins.look) ?? WORDART_LOOKS[Math.floor(random() * WORDART_LOOKS.length)];
  return { text: request.text, frame, width, height, fonts: fonts.map((f) => ({ ...f })), look };
}
