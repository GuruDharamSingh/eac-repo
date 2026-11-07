"use client";

import type { ComponentType } from "react";
import {
  TourFilmBlock,
  TourIntroBlock,
  TourMainBlock,
  TourMoreBlock,
  TourTextBlock,
  type TourFilmProps,
  type TourIntroProps,
  type TourMainProps,
  type TourMoreProps,
  type TourTextProps,
} from "./blocks";
import type { TourLayoutData } from "./layout-data";

/**
 * The tour page's block catalogue in Puck's `Config` shape (fields,
 * defaultProps, render), so the same object can be handed to `<Puck>` /
 * `<Render>` from @puckeditor/core once the layout editor is mounted, and
 * drawn by TourLayout below until then. Field kinds are the ones Puck knows:
 * text, textarea, number, radio.
 *
 * The keys are persisted identifiers (stored in site_config
 * `puck:tour-detail`): renaming one orphans stored layouts.
 */

type Field =
  | { type: "text" | "textarea"; label: string }
  | { type: "number"; label: string; min?: number; max?: number }
  | { type: "radio"; label: string; options: { label: string; value: string | boolean }[] };

interface BlockConfig<P> {
  label: string;
  fields: { [K in keyof P]: Field };
  defaultProps: P;
  render: ComponentType<P>;
}

const yesNo = (label: string): Field => ({ type: "radio", label, options: [{ label: "Show", value: true }, { label: "Hide", value: false }] });

export const tourConfig = {
  categories: { tour: { title: "Tour", components: ["TourFilm", "TourIntro", "TourMain", "TourMore", "TourText"] } },
  components: {
    TourFilm: {
      label: "Film",
      fields: {
        size: { type: "radio", label: "Size", options: [{ label: "Page width", value: "wide" }, { label: "Narrower", value: "narrow" }] },
        interactive: yesNo("Interactive 3D route preview below the film"),
      },
      defaultProps: { size: "wide", interactive: false },
      render: TourFilmBlock,
    } satisfies BlockConfig<TourFilmProps>,
    TourIntro: {
      label: "Title and facts",
      fields: { showFacts: yesNo("Facts row") },
      defaultProps: { showFacts: true },
      render: TourIntroBlock,
    } satisfies BlockConfig<TourIntroProps>,
    TourMain: {
      label: "Description, route and booking",
      fields: {
        showHighlights: yesNo("Highlights and what is included"),
        showRoute: yesNo("Stop-by-stop route with map"),
        routeHeading: { type: "text", label: "Route heading" },
        showBooking: yesNo("Booking box"),
      },
      defaultProps: { showHighlights: true, showRoute: true, routeHeading: "The route", showBooking: true },
      render: TourMainBlock,
    } satisfies BlockConfig<TourMainProps>,
    TourMore: {
      label: "More tours",
      fields: { heading: { type: "text", label: "Heading" }, count: { type: "number", label: "How many", min: 0, max: 6 } },
      defaultProps: { heading: "More tours", count: 3 },
      render: TourMoreBlock,
    } satisfies BlockConfig<TourMoreProps>,
    TourText: {
      label: "Text on every tour",
      fields: { heading: { type: "text", label: "Heading" }, text: { type: "textarea", label: "Text" } },
      defaultProps: { heading: "", text: "" },
      render: TourTextBlock,
    } satisfies BlockConfig<TourTextProps>,
  },
};

export type TourBlockType = keyof typeof tourConfig.components;

/** Draws a stored layout: what Puck's <Render> does for a flat document, defaults filled in. */
export function TourLayout({ data }: { data: TourLayoutData }) {
  return (
    <>
      {data.content.map((item) => {
        const def = (tourConfig.components as unknown as Record<string, BlockConfig<Record<string, unknown>>>)[item.type];
        if (!def) return null;
        const Block = def.render;
        const { id, ...props } = item.props;
        return <Block key={String(id)} {...def.defaultProps} {...props} />;
      })}
    </>
  );
}
