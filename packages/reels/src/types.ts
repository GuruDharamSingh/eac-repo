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

export type ReelTemplateId = 'artwork-reel';

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
