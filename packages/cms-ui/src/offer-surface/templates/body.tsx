"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { useOpenOffer } from "../page";
import type { TemplateData } from "./types";

// The block editor's body inside a reading template (styles: body.css, class "ost-body").
// `html` must already be sanitised by the host (the loader runs sanitizeRichText).
//
// An embedded thread card (figure.eac-card, data-thread-id) follows the system rule: when the page holds
// that piece or offer it opens its surface (wr-read for a piece, the offer layer for an offer); when it does
// not, the card is inert (a click on it, or on its link, goes nowhere). Live cards carry data-live.

export function OstBody({ html, data, className }: { html: string; data: TemplateData; className?: string }) {
  const { open } = useSurface();
  const openOffer = useOpenOffer();
  const ref = React.useRef<HTMLDivElement>(null);

  const find = React.useCallback(
    (id: string): { piece?: string; offer?: NonNullable<TemplateData["featured"]> } | null => {
      for (const key of [`thread:${id}`, `artwork:${id}`, id]) {
        if (data.pieces.some((p) => p.key === key)) return { piece: key };
        const o = [data.featured, ...data.offers].find((x) => x?.key === key);
        if (o) return { offer: o };
      }
      return null;
    },
    [data.pieces, data.featured, data.offers],
  );

  React.useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>(".eac-card[data-thread-id]").forEach((c) => {
      if (find(c.dataset.threadId ?? "")) c.setAttribute("data-live", "");
      else c.removeAttribute("data-live");
    });
  }, [html, find]);

  const onClick = (e: React.MouseEvent<HTMLElement>) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".eac-card");
    if (!card) return;
    e.preventDefault();
    const hit = find(card.dataset.threadId ?? "");
    if (!hit) return;
    if (hit.piece) open(offerDescriptor("wr-read", hit.piece), card);
    else if (hit.offer) openOffer(hit.offer, card);
  };

  return <div ref={ref} className={`ost-body${className ? ` ${className}` : ""}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
