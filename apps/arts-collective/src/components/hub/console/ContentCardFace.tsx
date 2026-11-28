"use client";

import * as React from "react";
import { SurfaceCard, useSurface } from "@elkdonis/cms-ui/surface";
import type { ContentCardData } from "@/lib/content-card-types";
import { CONTENT_CARD_SURFACES } from "./content-card-keys";
import "./content-card.css";

const TONES = ["#15171b", "#24302a", "#1f2433", "#3a2c24", "#2a2622", "#4b3f33", "#262a31", "#1d2026"];

/**
 * "Content", as a face on the console (the cornerstone's hub-card ruling): a large title, a few recent pieces
 * as large thumbnails, one count line. No icon tile and no kicker. It opens the card's surface
 * (ContentCardSurface), a popup on a desktop and a sheet on a phone, never a new page.
 */
export function ContentCardFace({ data }: { data: ContentCardData }) {
  const surfaces = useSurface();
  const pieces = data.latest.slice(0, 4);
  const types = Object.entries(data.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${n} ${t}${n === 1 ? "" : "s"}`)
    .join(" · ");

  return (
    <SurfaceCard
      kind="gallery"
      kicker={null}
      layout="header"
      title="Content"
      cue="Open"
      ariaLabel={`Open the content library for ${data.orgName}: published pieces, files and search`}
      onClick={(origin) =>
        surfaces.open({ type: "custom", key: CONTENT_CARD_SURFACES.main, title: "Content", size: "wide" }, origin)
      }
      preview={
        <div className="kc-face">
          {pieces.length ? (
            <ul className="kc-thumbs" aria-hidden="true">
              {pieces.map((p, i) => (
                <li key={p.key} style={p.cover ? undefined : { background: TONES[i % TONES.length] }}>
                  {p.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : null}
                  <span className="kc-thumb-title">{p.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="kc-face-line">Nothing published yet.</p>
          )}
          <p className="kc-face-line">
            {data.total === 0 ? data.orgName : `${data.total} published on ${data.orgName}`}
            {types ? ` · ${types}` : ""}
          </p>
        </div>
      }
    />
  );
}
