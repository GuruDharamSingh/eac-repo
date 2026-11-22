"use client";

import { TourStage } from "@/components/tours/stage/tour-stage";
import { readStageOptions } from "./stage-options";

/** The Hero stage block's props are the stage's options, stored as they are (see stage-options.ts). */
export type TourStageBlockProps = Record<string, unknown>;

/** Thin wrapper: the stage reads the tour from the page context; the block supplies only its settings. */
export function TourStageBlock(props: TourStageBlockProps) {
  return <TourStage {...readStageOptions(props)} />;
}
