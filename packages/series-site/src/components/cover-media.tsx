import type { CSSProperties } from "react";
import { coverEmbedSrc, coverFrameStyle, type CoverFrame } from "@elkdonis/cms-ui/files";

/**
 * A cover as the public pages draw it (2026-10-13): a framed picture
 * (focal point and zoom, set in the planner's CoverFramer), an uploaded
 * video that plays muted on a loop, or a YouTube/Vimeo player. Fills its
 * box, which must be positioned and sized by the caller; `.ifs-cover`
 * (site.css) clips it. No hooks, so server pages render it.
 */
export interface CoverMediaValue {
  url: string;
  kind: "image" | "video" | "embed";
  posterUrl?: string | null;
  frame?: CoverFrame | null;
}

export function CoverMedia({
  cover,
  className = "",
  style,
  controls = true,
}: {
  cover: CoverMediaValue;
  className?: string;
  style?: CSSProperties;
  /** Video controls (sound, pause); off where the cover is a small card image. */
  controls?: boolean;
}) {
  if (cover.kind === "video") {
    return (
      <div className={`ifs-cover ifs-cover--video ${className}`} style={style}>
        <video src={cover.url} poster={cover.posterUrl ?? undefined} autoPlay muted loop playsInline controls={controls} preload="metadata" />
      </div>
    );
  }
  if (cover.kind === "embed") {
    const src = coverEmbedSrc(cover.url);
    if (!src) return null;
    return (
      <div className={`ifs-cover ifs-cover--video ${className}`} style={style}>
        <iframe src={src} title="Series video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
      </div>
    );
  }
  return (
    <div className={`ifs-cover ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.url} alt="" style={coverFrameStyle(cover.frame)} />
    </div>
  );
}

/** A week's cover: a framed picture, or (migration 206) a video or YouTube/Vimeo player with its still. */
export function weekCover(
  url: string | null | undefined,
  frame: CoverFrame | null | undefined,
  kind: "image" | "video" | "embed" = "image",
  posterUrl: string | null = null
): CoverMediaValue | null {
  if (!url) return null;
  return kind === "image" ? { url, kind, frame: frame ?? null } : { url, kind, posterUrl };
}
