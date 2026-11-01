"use client";

import * as React from "react";
import { CoverFramer, type CoverFramerShape } from "./CoverFramer";
import { MediaPicker } from "./MediaPicker";
import { coverEmbedSrc, type CoverFrame } from "./cover-frame";

/** A cover: a picture (framed), an uploaded video (with an optional still), or a YouTube/Vimeo page ("embed"). */
export interface CoverValue {
  url: string;
  kind: "image" | "video" | "embed";
  posterUrl?: string | null;
  frame?: CoverFrame | null;
}

const COVER_KINDS: Array<{ id: CoverValue["kind"]; label: string }> = [
  { id: "image", label: "A picture" },
  { id: "video", label: "A video file" },
  { id: "embed", label: "A YouTube or Vimeo link" },
];

/**
 * A cover chooser (2026-10-13 for a series; shared 2026-10-18 so a series
 * week takes a video too): pick a picture and frame it in its box, upload a
 * video (playing muted on a loop, with an optional still for before it
 * plays), or paste a YouTube/Vimeo link. The preview is the cover in its box
 * with `overlay` (the card's words) over it.
 *
 * Styles: `.eac-series__*` and `.eac-coverframe*` (surface.css,
 * files-card.css); the host's --sf-* tokens colour it.
 */
export function CoverField({
  cover,
  onChange,
  uploadEndpoint,
  libraryEndpoint,
  uploadFields,
  overlay,
  shape = { label: "Wide", aspect: 16 / 9 },
  alsoShapes = [],
  hint = "Shown in the card and at the top of the page. A video plays silently on a loop until someone turns the sound on.",
  name,
}: {
  cover: CoverValue | null;
  onChange: (cover: CoverValue | null) => void;
  uploadEndpoint: string;
  libraryEndpoint?: string;
  /** Sent with each upload (e.g. the series and week that admit a week's host). */
  uploadFields?: Record<string, string>;
  /** Laid over the preview: the title and line as the card shows them. */
  overlay?: React.ReactNode;
  shape?: CoverFramerShape;
  alsoShapes?: CoverFramerShape[];
  hint?: string;
  /** Radio group name; unique per field on the page. */
  name?: string;
}) {
  const [kind, setKind] = React.useState<CoverValue["kind"]>(cover?.kind ?? "image");
  const [link, setLink] = React.useState(cover?.kind === "embed" ? cover.url : "");
  const autoName = React.useId();
  const group = name ?? autoName;
  React.useEffect(() => {
    if (cover) setKind(cover.kind);
    if (cover?.kind === "embed") setLink(cover.url);
  }, [cover]);

  const embed = cover?.kind === "embed" ? coverEmbedSrc(cover.url) : null;

  return (
    <div className="eac-series__field eac-series__cover">
      <div className="eac-series__checks" role="radiogroup" aria-label="Cover">
        {COVER_KINDS.map((k) => (
          <label key={k.id}>
            <input type="radio" name={group} checked={kind === k.id} onChange={() => setKind(k.id)} />
            {k.label}
          </label>
        ))}
      </div>
      {hint && <p className="eac-series__hint">{hint}</p>}

      {cover?.kind === "image" && kind === "image" && (
        <CoverFramer
          src={cover.url}
          frame={cover.frame ?? null}
          onChange={(frame) => onChange({ ...cover, frame })}
          shape={shape}
          alsoShapes={alsoShapes}
          overlay={overlay}
        />
      )}
      {cover?.kind === "video" && kind === "video" && (
        <div className="eac-series__card-preview">
          <video src={cover.url} poster={cover.posterUrl ?? undefined} muted loop autoPlay playsInline controls />
          {overlay && <div className="eac-coverframe__overlay">{overlay}</div>}
        </div>
      )}
      {cover?.kind === "embed" && kind === "embed" && (
        <div className="eac-series__card-preview">
          {embed ? (
            <iframe src={embed} title="Cover video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <p className="eac-series__hint" role="alert">That link is not a YouTube or Vimeo video.</p>
          )}
        </div>
      )}

      {kind === "image" && (
        <MediaPicker
          value={cover?.kind === "image" ? cover.url : ""}
          onChange={(url) => onChange(url ? { url, kind: "image", frame: null } : null)}
          uploadEndpoint={uploadEndpoint}
          libraryEndpoint={libraryEndpoint}
          uploadFields={uploadFields}
          label=""
          preview="none"
          hint={cover?.kind === "image" ? "Drop another picture to replace this one" : "A wide picture works best (16:9)."}
        />
      )}
      {kind === "video" && (
        <>
          <MediaPicker
            value={cover?.kind === "video" ? cover.url : ""}
            onChange={(url) => onChange(url ? { url, kind: "video", posterUrl: cover?.kind === "video" ? cover.posterUrl ?? null : null } : null)}
            uploadEndpoint={uploadEndpoint}
            libraryEndpoint={libraryEndpoint}
            uploadFields={uploadFields}
            label=""
            accept="video/*"
            preview="none"
            hint="MP4 or WebM, up to 500 MB. Short loops load fastest."
          />
          {cover?.kind === "video" && (
            <div className="eac-series__field">
              <span>
                Still shown before it plays <em className="eac-series__optional">(optional; also used on cards and in emails)</em>
              </span>
              <MediaPicker
                value={cover.posterUrl ?? ""}
                onChange={(url) => onChange({ ...cover, posterUrl: url || null })}
                uploadEndpoint={uploadEndpoint}
                libraryEndpoint={libraryEndpoint}
                uploadFields={uploadFields}
                label=""
              />
            </div>
          )}
        </>
      )}
      {kind === "embed" && (
        <>
          <div className="eac-series__addlink eac-series__addlink--one">
            <input
              className="eac-input"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
              aria-label="YouTube or Vimeo link"
            />
            <button
              type="button"
              className="eac-face-tool"
              disabled={!link.trim()}
              onClick={() => onChange({ url: link.trim(), kind: "embed", posterUrl: cover?.kind === "embed" ? cover.posterUrl ?? null : null })}
            >
              Use this video
            </button>
          </div>
          {cover?.kind === "embed" && (
            <div className="eac-series__field">
              <span>
                Still for cards and emails <em className="eac-series__optional">(optional)</em>
              </span>
              <MediaPicker
                value={cover.posterUrl ?? ""}
                onChange={(url) => onChange({ ...cover, posterUrl: url || null })}
                uploadEndpoint={uploadEndpoint}
                libraryEndpoint={libraryEndpoint}
                uploadFields={uploadFields}
                label=""
              />
            </div>
          )}
        </>
      )}
      {cover && (
        <button type="button" className="eac-rota__plan-edit" onClick={() => onChange(null)}>
          Remove the cover
        </button>
      )}
    </div>
  );
}
