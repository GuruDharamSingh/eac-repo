"use client";

import type { CSSProperties } from "react";
import { PieceCard } from "../../../../../katie-the-potter/src/blocks/piece-card";
import "../../../../../katie-the-potter/src/blocks/artwork-grid.css";
import "../../../../../katie-the-potter/src/blocks/piece-block.css";
import "@elkdonis/blocks/record.css";
import "./katie-mock.css";
import { PIECES } from "./pieces";

// PieceBlock's frame is copied (RecordFrame markup); the card and its CSS are real. The CTA is the "View" link
// (ctaMode open-page); Add to cart / Buy now need the shop's server actions.
const VARS = { "--ktp-radius": "10px" } as CSSProperties;

export default function PieceMock() {
  const piece = PIECES[0];
  return (
    <div className="ktp-mock-piece">
      <div className="blk-rec ktp-piece" style={VARS}>
        <div className="blk-rec-frame ktp-piece-frame" data-layout="card">
          <PieceCard
            as="div"
            piece={piece}
            opts={{ showPrice: true, showMedium: true, showStatus: true, minColumn: 360 }}
            cta={
              <a className="ktp-buy ktp-buy--ghost" href="#" onClick={(e) => e.preventDefault()}>
                View
              </a>
            }
          />
        </div>
      </div>
    </div>
  );
}
