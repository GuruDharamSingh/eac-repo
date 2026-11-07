"use client";

import { useState } from "react";
import { sized, srcSet } from "./media";
import type { PieceImage } from "./artwork-data";

/**
 * Thumbnails under a feature card. The card is server markup; this island swaps
 * the card's own picture (`.ktp-card-img` in the same `.ktp-piece`) rather than
 * drawing a second one, so the card keeps one markup everywhere.
 */
export function ThumbStrip({ images, title }: { images: PieceImage[]; title: string }) {
  const [shown, setShown] = useState(0);
  return (
    <ul className="ktp-piece-thumbs" aria-label={`More pictures of ${title}`}>
      {images.map((img, i) => (
        <li key={`${img.url}-${i}`}>
          <button
            type="button"
            className="ktp-gallery-thumb"
            aria-pressed={i === shown}
            aria-label={`Picture ${i + 1} of ${images.length}`}
            onClick={(e) => {
              const host = e.currentTarget.closest(".ktp-piece");
              const target = host?.querySelector<HTMLImageElement>(".ktp-card-img");
              if (target) {
                target.src = sized(img.url, 1024);
                const set = srcSet(img.url);
                if (set) target.srcset = set;
                else target.removeAttribute("srcset");
              }
              setShown(i);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sized(img.url, 256)} alt="" loading="lazy" />
          </button>
        </li>
      ))}
    </ul>
  );
}
