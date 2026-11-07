import type { Metadata } from "next";
import { LayoutStudio } from "@/components/studio/layout-studio";
import { experienceSample } from "@/components/studio/experience-sample";
import { toPuckData } from "@/components/studio/puck-data";
import { requireOrgEditor } from "@/lib/auth";
import { loadExperienceLayout } from "@/lib/experience-layout";

export const metadata: Metadata = {
  title: "Experience page layout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The site default experience layout (site_config `puck:experience-detail`,
 * lib/experience-layout.ts): every experience without a layout of its own.
 * Editors only: gated here and again in the publish action.
 */
export default async function ExperienceDetailStudioPage() {
  await requireOrgEditor("/studio/experience-detail");
  const [layout, sample] = await Promise.all([loadExperienceLayout(), experienceSample()]);
  return (
    <LayoutStudio
      target={{ kind: "experience-detail", sample: sample.data }}
      initial={toPuckData(layout)}
      title="Experience page layout (default)"
      back={{ href: "/manage/experiences", label: "Experiences" }}
      sampleNote={sample.label}
    />
  );
}
