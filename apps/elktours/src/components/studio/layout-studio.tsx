"use client";

import * as React from "react";
import Link from "next/link";
import type { Config, Data } from "@puckeditor/core";
import { PuckEditor } from "@elkdonis/page-builder";
import { tourConfig } from "@/blocks/tour/config";
import { TourPageProvider, type TourPageData } from "@/blocks/tour/context";
import { experienceConfig } from "@/blocks/experience/config";
import { ExperiencePageProvider, type ExperiencePageData } from "@/blocks/experience/context";
import {
  publishExperienceDefaultLayoutAction,
  publishExperiencePageAction,
  publishTourLayoutAction,
} from "@/app/studio/actions";
import { siteConfig } from "@/config/site";

/** What a studio page edits and where Publish writes. */
export type StudioTarget =
  | { kind: "tour-detail"; sample: TourPageData }
  | { kind: "experience-detail"; sample: ExperiencePageData }
  | { kind: "experience"; experienceId: string; sample: ExperiencePageData; custom: boolean };

/**
 * A Puck layout editor for elktours' Puck-shaped block catalogues (the
 * pattern of danamccool's components/studio/page-editor.tsx). The blocks
 * hold settings only; the words come from the sample in the provider, so
 * the canvas shows a real tour or experience while the layout is arranged.
 * Puck's canvas is portalled from this tree, so the provider reaches it.
 */
export function LayoutStudio({
  target,
  initial,
  title,
  back,
  sampleNote,
}: {
  target: StudioTarget;
  initial: Data;
  title: string;
  back: { href: string; label: string };
  /** Which tour or experience the canvas is drawn over. */
  sampleNote: string;
}) {
  const onPublish = React.useCallback(
    async (_slug: string, data: Data) => {
      if (target.kind === "tour-detail") return publishTourLayoutAction(data);
      if (target.kind === "experience-detail") return publishExperienceDefaultLayoutAction(data);
      return publishExperiencePageAction(target.experienceId, data);
    },
    [target]
  );

  const slug = target.kind === "experience" ? `experience-${target.experienceId}` : target.kind;
  const config = (target.kind === "tour-detail" ? tourConfig : experienceConfig) as unknown as Config;
  const editor = (
    <PuckEditor slug={slug} initial={initial} config={config} orgId={siteConfig.orgId} onPublish={onPublish} title={title} />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-600 bg-amber-100 px-4 py-2 text-sm text-amber-950">
        <Link href={back.href} className="underline underline-offset-4">← {back.label}</Link>
        <span className="font-medium">Work in progress — layout edits may not be kept</span>
        <span className="text-xs">{sampleNote}</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {target.kind === "tour-detail" ? (
          <TourPageProvider data={target.sample}>{editor}</TourPageProvider>
        ) : (
          <ExperiencePageProvider data={target.sample}>{editor}</ExperiencePageProvider>
        )}
      </div>
    </div>
  );
}
