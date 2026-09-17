"use client";

import * as React from "react";
import type { SurfaceDescriptor } from "../types";
import { useLayer } from "../context";
import { SurfaceFrame } from "../SurfaceShell";

// ============================================================================
// One file, in the popup.
//
// The smallest surface in the system, and the reason it exists: a list of
// materials whose links NAVIGATE costs you the page you were reading, and on
// the hub that page is the whole members' area. A document opened here is a
// layer like any other — the masthead grows a "‹ back" to the meeting it came
// from, and closing it puts you back where you were.
//
// It embeds what a browser can play (an image, a video, an audio file, a PDF
// served from the network) and OFFERS what it cannot. An external link is
// never framed: a recording on someone else's service will refuse the frame,
// and a panel that silently fails is worse than a button that says where it
// goes.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "material" }>;

const KIND_LABEL: Record<string, string> = {
  image: "Image",
  video: "Recording",
  audio: "Audio",
  document: "Document",
};

/** Bytes, at the precision a person reads. */
function size(bytes: number | null | undefined): string | null {
  if (!bytes || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(material: Descriptor["material"]): boolean {
  return (
    material.mimeType === "application/pdf" || /\.pdf($|\?)/i.test(material.url)
  );
}

export function MaterialSurface({ descriptor }: { descriptor: Descriptor }) {
  const layer = useLayer();
  const { material, context } = descriptor;

  React.useEffect(() => {
    layer.setMeta({
      title: material.name,
      kind: material.kind === "image" ? "gallery" : "document",
      // Wide, not full: a handout is read at a page's width, and a full-bleed
      // panel around a 400px image is furniture.
      size: "wide",
    });
  }, [layer, material.name, material.kind]);

  const facts = [KIND_LABEL[material.kind] ?? "File", size(material.size)]
    .filter(Boolean)
    .join(" · ");

  return (
    <SurfaceFrame
      kind={material.kind === "image" ? "gallery" : "document"}
      title={material.name}
      kicker={context ?? KIND_LABEL[material.kind] ?? "File"}
      status={facts}
      actions={[
        {
          label: material.external ? "Open where it lives" : "Open in a new tab",
          href: material.url,
          external: true,
          primary: true,
        },
      ]}
    >
      <div className="eac-material">
        {material.external ? (
          <p className="eac-material-note">
            This one lives outside the network, so it opens in its own tab.
          </p>
        ) : material.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="eac-material-image" src={material.url} alt={material.name} />
        ) : material.kind === "video" ? (
          <video className="eac-material-player" src={material.url} controls preload="metadata" />
        ) : material.kind === "audio" ? (
          <audio className="eac-material-audio" src={material.url} controls preload="metadata" />
        ) : isPdf(material) ? (
          <iframe className="eac-material-frame" src={material.url} title={material.name} />
        ) : (
          <p className="eac-material-note">
            Nothing to show in place for this kind of file — open it and it will
            download or hand off to whatever opens it.
          </p>
        )}
      </div>
    </SurfaceFrame>
  );
}
