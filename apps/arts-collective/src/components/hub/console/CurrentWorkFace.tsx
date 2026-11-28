"use client";

import * as React from "react";
import { SurfaceCard, useSurface } from "@elkdonis/cms-ui/surface";
import { TEMPLATES } from "@elkdonis/cms-ui/offer-templates/types";
import { KIND_WORD, type CurrentWorkData } from "@/lib/offer-card-types";
import { CURRENT_WORK_SURFACES } from "./current-work-keys";
import "./current-work.css";

/** The card's dark look uses the offer kit's faces (Fraunces for titles, JetBrains Mono for small labels); Georgia and the system mono stand in until they load. */
const FACE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Spectral:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap";

/**
 * "Current Work Page", as a face on the console: what leads the page now (kind, title, a small
 * picture), the template's name, and the way to the site. The face opens the card's surface
 * (CurrentWorkSurface), a popup on a desktop and a bottom sheet on a phone, never a new page.
 */
export function CurrentWorkFace({ data }: { data: CurrentWorkData }) {
  const surfaces = useSurface();
  const f = data.featured;
  const template = f ? TEMPLATES.find((t) => t.id === f.template) : null;

  return (
    <SurfaceCard
      kind="gallery"
      glyph="▤"
      kicker="Your site"
      layout="header"
      title="Current Work Page"
      blurb={data.enabled ? "The new page is on." : "The new page is off."}
      ariaLabel="Open the Current Work Page: what leads your site, its template and its look"
      onClick={(origin) =>
        surfaces.open({ type: "custom", key: CURRENT_WORK_SURFACES.main, title: "Current Work Page", size: "wide" }, origin)
      }
      preview={
        <div className="cwp-face cwp-dark">
          <link rel="stylesheet" href={FACE_FONTS_HREF} precedence="default" />
          {f ? (
            <div className="cwp-lead">
              {f.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="cwp-pic" src={f.cover} alt="" loading="lazy" />
              ) : (
                <span className="cwp-pic" aria-hidden />
              )}
              <span className="cwp-lead-text">
                <span className="cwp-lead-kind">
                  {KIND_WORD[f.kind]}
                  {f.chosen ? "" : " · chosen automatically"}
                </span>
                <span className="cwp-lead-title">{f.title}</span>
              </span>
            </div>
          ) : (
            <p className="cwp-face-line">Nothing public to lead the page with yet.</p>
          )}
          {template && <p className="cwp-face-line">Template: {template.name}</p>}
          {/* The one live control in the face (everything else opens the card). */}
          <a className="eac-face-live cwp-face-link" href={data.siteUrl} target="_blank" rel="noopener">
            View the site ↗
          </a>
        </div>
      }
    />
  );
}
