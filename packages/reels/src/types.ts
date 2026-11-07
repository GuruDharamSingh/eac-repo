// ============================================================================
// A reel's edit description, and the props a template renders.
//
// `ReelEdit` is what is stored (reel_projects.edit): files are Nextcloud
// paths. A composition receives `ReelInput` = the edit plus a map from each
// path to a URL it can load, and converts it to template props itself
// (`toArtworkReelProps`). The browser preview maps paths to the app's
// signed-in media route; the renderer (render/render.mjs) maps them to a
// local file server. One conversion, in the bundle, for both.
// ============================================================================

export type ReelTemplateId = 'artwork-reel' | 'clip';

/** The clip template's frame: 16:9, 9:16 or 1:1. */
export type ReelFormat = 'landscape' | 'portrait' | 'square';

/** Kinds of overlay on a clip reel (templates/clip.tsx). */
export type ReelOverlayKind = 'title' | 'lower' | 'caption' | 'quote' | 'bug' | 'image' | 'ticker' | 'fx' | 'text' | 'subtitles' | 'sound';

/**
 * One overlay on the clip template's timeline. `at` and `seconds` are in the
 * edited clip's time (after cuts); `seconds` 0 runs to the end of the clip.
 * Fields by kind:
 *   title    text, sub (subtitle)           dims the frame
 *   lower    text (name), sub (role), style lower third
 *   caption  text, place                    a line of text, bottom or top
 *   quote    text, sub (who said it)        dims the frame
 *   bug      text, corner                   short label in a corner
 *   image    image, corner, size            a picture (logo) in a corner
 *   ticker   text, sub (label)              scrolling band along the bottom
 *   fx       fx (catalog id), sub (a call's price line)
 *                                           a Collect Art video FX with alpha
 *                                           (templates/fx-catalog.ts); a one-shot
 *                                           or transition lasts its own length,
 *                                           a loop repeats for `seconds`
 *   text     text, x, y, size, color, font, weight, align, box
 *                                           free text placed anywhere
 *   subtitles cues, place, size, color, font, box, highlight
 *                                           one item for the whole clip; cues are
 *                                           in SOURCE seconds, so they follow the
 *                                           cuts (a cut-out cue never shows)
 *   sound    sound, volume                  a sound effect played at `at` for
 *                                           `seconds` (its length); nothing drawn
 */
export interface ReelOverlayItem {
  id: string;
  kind: ReelOverlayKind;
  at: number;
  seconds: number;
  text?: string;
  sub?: string;
  style?: 'panel' | 'slash' | 'reveal' | 'fade';
  corner?: 'tl' | 'tr' | 'bl' | 'br';
  place?: 'top' | 'bottom';
  image?: ReelMediaRef;
  /** image: width as a percentage of the frame's short side (5-60).
   *  text, subtitles: letter height as a percentage of the short side (2-20). */
  size?: number;
  /** fx: the FX catalog entry's id (templates/fx-catalog.ts). */
  fx?: string;
  /** text: centre of the text in % of the frame (0-100). */
  x?: number;
  y?: number;
  /** text, subtitles: #rrggbb. */
  color?: string;
  font?: 'serif' | 'sans' | 'mono';
  weight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  /** text, subtitles: a dark box behind the text. */
  box?: boolean;
  /** subtitles: the lines, in source seconds. */
  cues?: ReelCue[];
  /** subtitles: colour of the word being spoken (#rrggbb); empty = no highlight. */
  highlight?: string;
  /** sound: the effect (network Sounds library or the person's own); `seconds` is its length. */
  sound?: ReelMediaRef;
  /** sound: 0-1.5, default 1. */
  volume?: number;
}

/** A spoken word, in seconds of the source file; `b` marks the start of a phrase. */
export interface ReelWord {
  w: string;
  s: number;
  e: number;
  b?: 1;
}

/**
 * One subtitle line, in source seconds. `words` are the transcript's words
 * for word-by-word highlight; editing the text drops them (the line then
 * shows as plain text for its span).
 */
export interface ReelCue {
  id: string;
  from: number;
  to: number;
  text: string;
  words?: ReelWord[];
}

/** The clip template's overlays. */
export interface ReelOverlays {
  items?: ReelOverlayItem[];
  /** #rrggbb for bars and rules. */
  accent?: string;
  /** Before 2026-11-02 (one of each); read into `items` by overlayItems(). */
  title?: { text: string; subtitle?: string; seconds?: number };
  lowerThird?: { name: string; role?: string; at?: number; seconds?: number; style?: 'panel' | 'slash' | 'reveal' | 'fade' };
  bug?: { text: string; corner?: 'tl' | 'tr' | 'bl' | 'br' };
}

/** A part of the source kept in the edit, in source seconds. */
export interface ReelSegment {
  from: number;
  to: number;
}

export interface ReelMediaRef {
  /** Nextcloud path (or, in folder mode, a local file name). */
  path: string;
  /** Display name. */
  name?: string;
}

export interface ReelClipRef extends ReelMediaRef {
  /** Seconds into the source where the clip starts. Default 0. */
  trimStart?: number;
  /** Seconds of source available/used. Read from the file when uploaded. */
  duration?: number;
  /** The clip has speech: music is lowered under it. Default true. */
  voice?: boolean;
  /** Length of the whole source file, once known. */
  sourceSeconds?: number;
  /** Clip template: the parts kept, in order; absent = trimStart + duration. */
  segments?: ReelSegment[];
}

export interface ReelEdit {
  template: ReelTemplateId;
  brand?: {
    name?: string;
    background?: string;
    foreground?: string;
    logo?: ReelMediaRef;
  };
  artwork?: ReelMediaRef;
  clip?: ReelClipRef;
  clip2?: ReelClipRef;
  extra?: (ReelMediaRef & { kind: 'image' }) | (ReelClipRef & { kind: 'video' });
  endCard?: { title?: string; subtitle?: string; link?: string };
  music?: ReelMediaRef & { volume?: number };
  /** Clip template: frame shape, how the clip fills it, and the overlays. */
  format?: ReelFormat;
  fit?: 'cover' | 'contain';
  overlays?: ReelOverlays;
  /** Clip template: even out the sound to -16 LUFS after rendering (default on; render.mjs levelAudio). */
  levelAudio?: boolean;
}

export interface ReelInput {
  edit: ReelEdit;
  /** path → loadable URL. A path missing here renders as a placeholder. */
  urls: Record<string, string>;
  /** Used when the edit has no brand name. */
  fallbackName?: string;
}

// ---------------------------------------------------------------------------
// Template props (what the component draws). An empty `src` is a slot not
// yet filled: the preview shows a placeholder; the renderer refuses.
// ---------------------------------------------------------------------------

export interface ReelImage {
  src: string;
}

export interface ReelClip {
  src: string;
  trimStart?: number;
  duration?: number;
  voice?: boolean;
}

export interface ReelBrand {
  logo?: ReelImage;
  name: string;
  background?: string;
  foreground?: string;
}

export interface ArtworkReelProps {
  brand: ReelBrand;
  artwork: ReelImage;
  clip: ReelClip;
  clip2?: ReelClip;
  extra?: (ReelImage & { kind: 'image' }) | (ReelClip & { kind: 'video' });
  endCard: { title: string; subtitle?: string; link?: string };
  music?: { src: string; volume?: number };
}

export function isClip(x: ArtworkReelProps['extra']): x is ReelClip & { kind: 'video' } {
  return x?.kind === 'video';
}

/** The edit → props conversion shared by the preview and the renderer. */
export function toArtworkReelProps({ edit, urls, fallbackName }: ReelInput): ArtworkReelProps {
  const src = (ref?: ReelMediaRef) => (ref?.path ? urls[ref.path] ?? '' : '');
  const clip = (ref?: ReelClipRef): ReelClip => ({
    src: src(ref),
    trimStart: ref?.trimStart,
    duration: ref?.duration,
    voice: ref?.voice,
  });
  const name = edit.brand?.name?.trim() || fallbackName || 'Elkdonis Arts Collective';
  const props: ArtworkReelProps = {
    brand: {
      name,
      background: edit.brand?.background,
      foreground: edit.brand?.foreground,
      logo: src(edit.brand?.logo) ? { src: src(edit.brand?.logo) } : undefined,
    },
    artwork: { src: src(edit.artwork) },
    clip: clip(edit.clip),
    endCard: {
      title: edit.endCard?.title?.trim() || name,
      subtitle: edit.endCard?.subtitle?.trim() || undefined,
      link: edit.endCard?.link?.trim() || undefined,
    },
  };
  if (edit.clip2 && src(edit.clip2)) props.clip2 = clip(edit.clip2);
  if (edit.extra && src(edit.extra)) {
    props.extra =
      edit.extra.kind === 'video'
        ? { kind: 'video', ...clip(edit.extra) }
        : { kind: 'image', src: src(edit.extra) };
  }
  if (edit.music && src(edit.music)) props.music = { src: src(edit.music), volume: edit.music.volume };
  return props;
}

/** Slots the renderer cannot do without. */
export function missingForRender(edit: ReelEdit): string[] {
  const out: string[] = [];
  if (edit.template === 'clip') return edit.clip?.path ? out : ['clip'];
  if (!edit.artwork?.path) out.push('artwork');
  if (!edit.clip?.path) out.push('clip');
  return out;
}

/** Every path an edit names, for building the URL map. */
export function editPaths(edit: ReelEdit): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (k === 'path' && typeof v === 'string' && v) out.push(v);
      else walk(v);
    }
  };
  walk(edit);
  return out;
}
