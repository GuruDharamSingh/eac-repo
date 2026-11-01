import type { CSSProperties } from "react";

/**
 * How a picture sits in a box of any shape: the focal point in percent (CSS
 * `object-position`) and a zoom (1 = just fills the box, up to 4), scaled
 * about the focal point. Same convention as gallery tiles (`fx`/`fy`/`zoom`)
 * and `CoverFrame` in @elkdonis/services (meeting-series.ts).
 *
 * No "use client": server pages import `coverFrameStyle` to draw a framed
 * cover. The `<img>` it styles must fill a box with `overflow: hidden`.
 */
export interface CoverFrame {
  fx: number;
  fy: number;
  zoom: number;
}

export const CENTRED: CoverFrame = { fx: 50, fy: 50, zoom: 1 };
export const MAX_ZOOM = 4;

export function coverFrameStyle(frame: Partial<CoverFrame> | null | undefined): CSSProperties {
  const fx = frame?.fx ?? 50;
  const fy = frame?.fy ?? 50;
  const zoom = frame?.zoom ?? 1;
  return {
    objectFit: "cover",
    objectPosition: `${fx}% ${fy}%`,
    ...(zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: `${fx}% ${fy}%` } : {}),
  };
}

/** Null for a centred, unzoomed frame, so an untouched picture stores nothing. */
export function frameOrNull(frame: CoverFrame | null | undefined): CoverFrame | null {
  if (!frame) return null;
  return frame.fx === 50 && frame.fy === 50 && frame.zoom === 1 ? null : frame;
}

/** A YouTube or Vimeo page as its player's address (muted, looping autoplay); null for anything else. */
export function coverEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host.endsWith("youtube.com")) id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
    if (id && /^[\w-]{6,}$/.test(id)) {
      return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&rel=0`;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const vid = u.pathname.match(/(\d{6,})/)?.[1];
      if (vid) return `https://player.vimeo.com/video/${vid}?autoplay=1&muted=1&loop=1&playsinline=1`;
    }
  } catch {
    // not a URL
  }
  return null;
}
