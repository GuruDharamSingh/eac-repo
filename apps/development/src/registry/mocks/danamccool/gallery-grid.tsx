"use client";

import { ProfileGallery, type GalleryItem } from "@elkdonis/cms-ui/gallery";
import "@elkdonis/cms-ui/gallery.css";
import "./dana-mock.css";

// Real component: cms-ui's ProfileGallery (what the block's GalleryGridView renders), read-only, square tiles,
// titles on hover, 4 across. The block's slideshow wiring and editing actions are left out. Invented paintings:
// flat colour fields as inline SVG.
function art(a: string, b: string, c: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${a}"/><circle cx="150" cy="170" r="110" fill="${b}"/><rect x="190" y="210" width="170" height="150" fill="${c}" opacity="0.85"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PALETTES: [string, string, string][] = [
  ["#795ff0", "#48d0ed", "#ef4926"],
  ["#f2ead8", "#2d5b7a", "#c9533a"],
  ["#1d1f2b", "#e0b04a", "#7aa6a1"],
  ["#d9e4dd", "#8f4a6b", "#ffffff"],
  ["#ef4926", "#f6e8c8", "#2b2a4a"],
  ["#48d0ed", "#795ff0", "#f2f2f2"],
  ["#2f3a2c", "#d8c78a", "#b04a3a"],
  ["#f6f1e9", "#3a3a3a", "#e07a5f"],
];
const TITLES = ["Study in violet", "Harbour, morning", "Night garden", "Two figures, abstract", "Red field", "Blue room", "Orchard", "Quiet table"];

const ITEMS: GalleryItem[] = PALETTES.map((p, n) => ({
  id: `m${n}`,
  url: art(...p),
  title: TITLES[n],
  x: (n % 4) * 3,
  y: Math.floor(n / 4) * 3,
  w: 3,
  h: 3,
}));

export default function GalleryGridMock() {
  return (
    <section className="dm-grid">
      <h1 className="page-title dm-grid-title">Recent paintings</h1>
      <div className="dm-grid-wrap" data-editable="false">
        <ProfileGallery items={ITEMS} editable={false} squareTiles gap={6} captions="hover" framing />
      </div>
    </section>
  );
}
