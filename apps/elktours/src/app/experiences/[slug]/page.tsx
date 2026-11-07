import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExperiencePageProvider, type ExperiencePageData } from "@/blocks/experience/context";
import { ExperienceLayout } from "@/blocks/experience/config";
import { toExperienceView } from "@/components/experiences/view";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { listAssets } from "@/lib/assets";
import { getViewer } from "@/lib/auth";
import { getExperienceBySlug, listExperiences } from "@/lib/experiences";
import { resolveExperienceLayout } from "@/lib/experience-layout";

interface Props {
  params: Promise<{ slug: string }>;
}

async function load(slug: string, includeDrafts: boolean) {
  return getExperienceBySlug(slug, { includeDrafts }).catch((err) => {
    console.warn("[elktours] /experiences/[slug] getExperienceBySlug:", err);
    return null;
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getViewer().catch(() => null);
  const e = await load(slug, Boolean(viewer?.canEdit));
  if (!e) return {};
  return {
    title: e.title,
    description: e.excerpt ?? undefined,
    openGraph: { title: e.title, description: e.excerpt ?? undefined, images: e.coverImageUrl ? [e.coverImageUrl] : undefined },
  };
}

export const dynamic = "force-dynamic";

/**
 * An experience page: the experience's own layout (`metadata.page`, a Puck
 * document) when it has one, else the default, drawn over the experience
 * through blocks/experience. Phase A is inquiry only: no dates, no checkout.
 */
export default async function ExperiencePage({ params }: Props) {
  const { slug } = await params;
  const viewer = await getViewer().catch(() => null);
  const canEdit = Boolean(viewer?.canEdit);
  const e = await load(slug, canEdit);
  if (!e) notFound();

  // Its own metadata.page, else the site default (site_config puck:experience-detail), else the built-in layout.
  const [assets, all, layout] = await Promise.all([
    listAssets({ threadId: e.id }).catch(() => []),
    listExperiences().catch(() => []),
    resolveExperienceLayout(e.page),
  ]);

  const data: ExperiencePageData = {
    experience: toExperienceView(e, assets),
    canEdit,
    signedInEmail: viewer?.email ?? null,
    others: all.filter((o) => o.id !== e.id && o.status === "published").slice(0, 6).map((o) => toExperienceView(o)),
  };

  return (
    <ExperiencePageProvider data={data}>
      <article className="pb-16">
        <ExperienceLayout data={layout} />
        <div className="mx-auto mt-16 max-w-6xl px-5">
          <ReviewsSection target={{ type: "experience", id: e.id }} />
        </div>
      </article>
    </ExperiencePageProvider>
  );
}
