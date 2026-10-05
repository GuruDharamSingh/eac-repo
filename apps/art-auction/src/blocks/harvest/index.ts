// ============================================================================
// Sections harvested from HyperUI (MIT, Copyright (c) Mark Mead), adapted to
// this app's shadcn tokens. Source paths per block: ./NOTICE.md.
//
// Every block is Tailwind-styled and server-rendered (no "use client").
// Add `HARVEST_BLOCKS` to the app's site block list next to its other blocks.
// This app does not rely on Tailwind preflight, so each block zeroes the
// margins and list styles it would otherwise inherit from the browser.
// ============================================================================

import type { Block } from "@elkdonis/blocks";
import { statBand } from "./stat-band";
import { timeline } from "./timeline";
import { cardImage } from "./card-image";
import { cardTicket } from "./card-ticket";
import { announcement } from "./announcement";
import { featureList } from "./feature-list";

export { statBand, timeline, cardImage, cardTicket, announcement, featureList };

export const HARVEST_BLOCKS = [
  statBand,
  timeline,
  cardImage,
  cardTicket,
  announcement,
  featureList,
] as unknown as Block<never>[];
