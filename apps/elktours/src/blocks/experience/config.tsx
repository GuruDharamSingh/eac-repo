"use client";

import * as React from "react";
import {
  ExperienceGalleryBlock,
  ExperienceHeroBlock,
  ExperienceIntroBlock,
  ExperienceMainBlock,
  ExperienceMoreBlock,
  ExperienceTextBlock,
  type ExperienceGalleryProps,
  type ExperienceHeroProps,
  type ExperienceIntroProps,
  type ExperienceMainProps,
  type ExperienceMoreProps,
  type ExperienceTextProps,
} from "./blocks";
import type { ExperienceLayoutData } from "./layout-data";

/**
 * The experience page's block catalogue in Puck's `Config` shape (fields,
 * defaultProps, render), mirroring blocks/tour/config.tsx, so the same object
 * can be handed to `<Puck>` / `<Render>` once the layout editor is mounted
 * and is drawn by ExperienceLayout below until then.
 *
 * The keys are persisted identifiers (site_config `puck:experience-detail`
 * and each experience's `metadata.page`): renaming one orphans stored layouts.
 */

type Field =
  | { type: "text" | "textarea"; label: string }
  | { type: "number"; label: string; min?: number; max?: number }
  | { type: "radio"; label: string; options: { label: string; value: string | boolean }[] };

interface BlockConfig<P> {
  label: string;
  fields: { [K in keyof P]: Field };
  defaultProps: P;
  render: React.ComponentType<P>;
}

const yesNo = (label: string): Field => ({ type: "radio", label, options: [{ label: "Show", value: true }, { label: "Hide", value: false }] });

export const experienceConfig = {
  categories: {
    experience: {
      title: "Experience",
      components: ["ExperienceHero", "ExperienceIntro", "ExperienceMain", "ExperienceGallery", "ExperienceMore", "ExperienceText"],
    },
  },
  components: {
    ExperienceHero: {
      label: "Cover picture",
      fields: { size: { type: "radio", label: "Size", options: [{ label: "Page width", value: "wide" }, { label: "Narrower", value: "narrow" }] } },
      defaultProps: { size: "wide" },
      render: ExperienceHeroBlock,
    } satisfies BlockConfig<ExperienceHeroProps>,
    ExperienceIntro: {
      label: "Title and facts",
      fields: { showFacts: yesNo("Facts row") },
      defaultProps: { showFacts: true },
      render: ExperienceIntroBlock,
    } satisfies BlockConfig<ExperienceIntroProps>,
    ExperienceMain: {
      label: "Description, people and inquiry",
      fields: {
        showHighlights: yesNo("Highlights"),
        showPeople: yesNo("Artists and hosts"),
        showInquiry: yesNo("Inquiry box"),
        inquiryHeading: { type: "text", label: "Inquiry box heading" },
      },
      defaultProps: { showHighlights: true, showPeople: true, showInquiry: true, inquiryHeading: "Ask about it" },
      render: ExperienceMainBlock,
    } satisfies BlockConfig<ExperienceMainProps>,
    ExperienceGallery: {
      label: "Pictures",
      fields: { heading: { type: "text", label: "Heading" } },
      defaultProps: { heading: "Pictures" },
      render: ExperienceGalleryBlock,
    } satisfies BlockConfig<ExperienceGalleryProps>,
    ExperienceMore: {
      label: "More experiences",
      fields: { heading: { type: "text", label: "Heading" }, count: { type: "number", label: "How many", min: 0, max: 6 } },
      defaultProps: { heading: "More experiences", count: 3 },
      render: ExperienceMoreBlock,
    } satisfies BlockConfig<ExperienceMoreProps>,
    ExperienceText: {
      label: "Text on every experience",
      fields: { heading: { type: "text", label: "Heading" }, text: { type: "textarea", label: "Text" } },
      defaultProps: { heading: "", text: "" },
      render: ExperienceTextBlock,
    } satisfies BlockConfig<ExperienceTextProps>,
  },
};

export type ExperienceBlockType = keyof typeof experienceConfig.components;

/** Draws a stored layout: what Puck's <Render> does for a flat document, defaults filled in. */
export function ExperienceLayout({ data }: { data: ExperienceLayoutData }) {
  return (
    <>
      {data.content.map((item) => {
        const def = (experienceConfig.components as unknown as Record<string, BlockConfig<Record<string, unknown>>>)[item.type];
        if (!def) return null;
        const Block = def.render;
        const { id, ...props } = item.props;
        return <Block key={String(id)} {...def.defaultProps} {...props} />;
      })}
    </>
  );
}
