"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ArcadeArtwork } from "@/lib/arcade";

const EndlessRunner = dynamic(
  () => import("@elkdonis/three/endless-runner").then((m) => ({ default: m.EndlessRunner })),
  { ssr: false, loading: () => <div className="ekh-arcade__loading">Loading…</div> },
);

type Game = { id: string; name: string; blurb: string };

/**
 * The rotating arcade. Same cabinet as the landing page's Hopper, plus
 * vendored open-source games under /public/arcade/<id>/ (framed, so their
 * globals and key handlers stay out of the app). Which game leads rotates by
 * day; the arrows step through the rest.
 *
 * To add a game: drop it in public/arcade/<id>/ with its licence, and add a
 * row here.
 */
const GAMES: Game[] = [
  { id: "hopper", name: "Hopper", blurb: "Jump the members' work. Space or tap." },
  { id: "2048", name: "2048", blurb: "Gabriele Cirulli's sliding-tile classic. MIT." },
];

function dayIndex(): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  return Math.floor((now.getTime() - start) / 86_400_000);
}

export function Arcade({ artwork }: { artwork: ArcadeArtwork[] }) {
  // Server and first client render agree on game 0; the day's pick lands after
  // hydration so the two never disagree.
  const [i, setI] = useState(0);
  useEffect(() => setI(dayIndex() % GAMES.length), []);
  const game = GAMES[i];
  const step = (d: number) => setI((n) => (n + d + GAMES.length) % GAMES.length);

  return (
    <div className="ekh-arcade">
      <div className="ekh-arcade__bar">
        <button type="button" className="ekh-arcade__arrow" onClick={() => step(-1)} aria-label="Previous game">‹</button>
        <div className="ekh-arcade__title">
          <span className="ekh-kicker">Arcade · {i + 1}/{GAMES.length}</span>
          <strong>{game.name}</strong>
        </div>
        <button type="button" className="ekh-arcade__arrow" onClick={() => step(1)} aria-label="Next game">›</button>
      </div>
      <div className="ekh-arcade__screen">
        {game.id === "hopper" ? (
          <EndlessRunner title="HOPPER" subtitle="ELKDONIS ARCADE" height={330} artwork={artwork} />
        ) : (
          <iframe
            key={game.id}
            src={`/arcade/${game.id}/index.html`}
            title={game.name}
            className="ekh-arcade__frame"
            loading="lazy"
          />
        )}
      </div>
      <p className="ekh-arcade__blurb">{game.blurb}</p>
    </div>
  );
}
