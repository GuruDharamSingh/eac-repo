import Link from "next/link";
import { ExperienceForm } from "@/components/manage/experience-form";
import { listPersonOptions } from "@/lib/experiences";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewExperiencePage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const personOptions = await listPersonOptions().catch(() => []);
  return (
    <>
      <Link href="/manage/experiences" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← Experiences</Link>
      <h2 className="mt-1 font-serif text-2xl">New experience</h2>
      <p className="mt-1 text-sm text-muted-foreground">Only the title is needed to start; pictures are added after the first save.</p>
      <div className="mt-6">
        <ExperienceForm personOptions={personOptions} />
      </div>
    </>
  );
}
