"use client";

import type { CSSProperties } from "react";
import { PieceCard } from "../../../../../katie-the-potter/src/blocks/piece-card";
import "../../../../../katie-the-potter/src/blocks/artwork-grid.css";
import "./katie-mock.css";
import { PIECES } from "./pieces";

// The grid shell is a copy of ArtworkGrid's markup (artwork-grid.client.tsx, defaults); the cards are the real PieceCard.
const VARS = {
  "--ktp-col": "260px",
  "--ktp-gap": "28px",
  "--ktp-radius": "10px",
  "--ktp-title-size": "18px",
  "--ktp-meta-size": "13px",
  "--ktp-aspect": "4 / 5",
} as CSSProperties;

export default function ArtworkGridMock() {
  return (
    <section className="blk ktp-works" data-shape="rounded" data-fit="cover" data-caption="below" data-hover="lift" data-aspect="4:5" style={VARS}>
      <header className="ktp-works-head">
        <h2 className="ktp-works-title">Recent work</h2>
        <p className="ktp-works-intro">Thrown, glazed and fired in small batches. A selection of what is on the shelves now.</p>
      </header>
      <ul className="ktp-grid">
        {PIECES.map((piece) => (
          <PieceCard key={piece.id} piece={piece} opts={{ showPrice: true, showMedium: true, showStatus: true }} />
        ))}
      </ul>
    </section>
  );
}
