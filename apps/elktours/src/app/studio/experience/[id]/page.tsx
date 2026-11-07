import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LayoutStudio } from "@/components/studio/layout-studio";
import { experienceSample } from "@/components/studio/experience-sample";
import { toPuckData } from "@/components/studio/puck-data";
import { requireOrgEditor } from "@/lib/auth";
import { getExperienceById } from "@/lib/experiences";
import { resolveExperienceLayout } from "@/lib/experience-layout";

export const metadata: Metadata = {
  title: "Experience page layout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One experience's own layout (`metadata.page`), starting from the site
 * default when it has none. Editors only in Phase A (linked artists editing
 * their page is Phase B); gated here and again in the publish action.
 */
export default async function ExperienceStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOrgEditor(`/studio/experience/${id}`);
  const experience = await getExperienceById(id);
  if (!experience) notFound();

  const [layout, sample] = await Promise.all([resolveExperienceLayout(experience.page), experienceSample(experience)]);
  const custom = experience.page != null;
  return (
    <LayoutStudio
      target={{ kind: "experience", experienceId: experience.id, sample: sample.data, custom }}
      initial={toPuckData(layout)}
      title={`${experience.title}: page layout${custom ? "" : " (starts from the default)"}`}
      back={{ href: `/manage/experiences/${experience.id}`, label: "Edit experience" }}
      sampleNote={custom ? "This experience has its own layout" : "Publishing gives this experience its own layout"}
    />
  );
}
