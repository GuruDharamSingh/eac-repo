"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { COMMUNITY_GAME_SLOT } from "@/lib/cms/community-render";
import type { ArcadeArtwork } from "@/lib/arcade";

const EndlessRunner = dynamic(
  () => import("@elkdonis/three/endless-runner").then((m) => ({ default: m.EndlessRunner })),
  { ssr: false, loading: () => null },
);

/**
 * The newsroom's right column is a server-rendered HTML string, so the game is
 * portalled into the mount node that string leaves behind rather than nested
 * as JSX.
 */
export function CommunityGame({
  subtitle,
  artwork,
  playerImageUrl,
}: {
  subtitle?: string;
  artwork?: ArcadeArtwork[];
  playerImageUrl?: string | null;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(COMMUNITY_GAME_SLOT));
  }, []);

  if (!slot) return null;

  return createPortal(
    <EndlessRunner
      title="HOPPER"
      subtitle={subtitle}
      height={260}
      artwork={artwork}
      playerImageUrl={playerImageUrl}
    />,
    slot,
  );
}
