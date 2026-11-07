import type { Metadata } from "next";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { toExperienceView } from "@/components/experiences/view";
import { getViewer } from "@/lib/auth";
import { listExperiences } from "@/lib/experiences";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Experiences",
  description: `Time with artists in ${siteConfig.city}: studio visits, workshops and performances, in person or online.`,
};

export const dynamic = "force-dynamic";

export default async function ExperiencesPage() {
  const viewer = await getViewer().catch(() => null);
  // Editors see their drafts here too (badged on the card); visitors see published ones only.
  const experiences = await listExperiences({ includeDrafts: Boolean(viewer?.canEdit) }).catch((err) => {
    console.warn("[elktours] /experiences listExperiences:", err);
    return [];
  });
  const views = experiences.map((e) => toExperienceView(e));

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.city}</p>
        <h1 className="mt-2 font-serif text-4xl">Experiences</h1>
        <p className="mt-3 text-muted-foreground">
          Time with the artists we work with: a studio visit, a workshop, a performance. Some happen here, some online.
          Ask about one and we arrange it with you.
        </p>
      </header>

      {views.length === 0 ? (
        <p className="mt-10 border border-dashed border-border p-10 text-center text-muted-foreground">
          The first experiences are being arranged. Check back soon.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {views.map((e) => <ExperienceCard key={e.id} experience={e} />)}
        </div>
      )}
    </div>
  );
}
