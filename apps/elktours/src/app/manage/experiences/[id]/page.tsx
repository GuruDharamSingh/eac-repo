import Link from "next/link";
import { notFound } from "next/navigation";
import { ExperienceForm } from "@/components/manage/experience-form";
import { listAssets } from "@/lib/assets";
import { getExperienceById, listExperienceTours, listPersonOptions, listServiceOptions } from "@/lib/experiences";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const { id } = await params;
  const experience = await getExperienceById(id).catch((err) => {
    console.error("[elktours] /manage/experiences/[id] getExperienceById:", err);
    return null;
  });
  if (!experience) notFound();

  const firstArtist = experience.people.find((p) => p.role === "artist")?.userId ?? null;
  const [assets, personOptions, serviceOptions, tours] = await Promise.all([
    listAssets({ threadId: experience.id }).catch(() => []),
    listPersonOptions().catch(() => []),
    firstArtist ? listServiceOptions(firstArtist).catch(() => []) : Promise.resolve([]),
    listExperienceTours(experience.id).catch(() => []),
  ]);
  const images = assets
    .filter((a) => a.kind === "image" && !a.archivedAt && a.url)
    .sort((a, b) => a.position - b.position)
    .map((a) => ({ id: a.id, url: a.url as string }));

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/manage/experiences" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Experiences</Link>
          <h2 className="mt-1 font-serif text-2xl">{experience.title}</h2>
        </div>
        <span className="flex gap-4 text-sm">
          <Link href={`/studio/experience/${experience.id}`} className="underline underline-offset-4">Page layout</Link>
          <Link href={`/experiences/${experience.slug}`} className="underline underline-offset-4">
            {experience.status === "published" ? "View on site" : "Preview (draft)"}
          </Link>
        </span>
      </div>

      {tours.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          A stop on{" "}
          {tours.map((t, i) => (
            <span key={t.stopId}>
              {i > 0 && ", "}
              <Link href={`/manage/tours/${t.threadId}?tab=stops`} className="underline underline-offset-4">{t.tourTitle}</Link>
              {t.tourStatus !== "published" && " (draft)"}
            </span>
          ))}
          .
        </p>
      )}

      <div className="mt-6">
        <ExperienceForm experience={experience} images={images} personOptions={personOptions} serviceOptions={serviceOptions} />
      </div>
    </>
  );
}
