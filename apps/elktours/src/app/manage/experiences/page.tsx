import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@elkdonis/primitives";
import { ExperienceRowActions } from "@/components/experiences/experience-row-actions";
import { ExperienceAudienceSelect } from "@/components/experiences/experience-audience";
import { FORMAT_LABEL } from "@/components/experiences/types";
import { listExperiences } from "@/lib/experiences";
import { formatPrice } from "@/lib/tour-format";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Every experience, drafts included (the /manage layout already gates this to editors). */
export default async function ManageExperiencesPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const experiences = await listExperiences({ includeDrafts: true });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Experiences</h2>
        <span className="flex items-center gap-4">
        <Link href="/studio/experience-detail" className="text-sm underline underline-offset-4">Default page layout</Link>
        <Button asChild size="sm">
          <Link href="/manage/experiences/new">
            <Plus className="size-4" aria-hidden />
            New experience
          </Link>
        </Button>
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Time with an artist — a studio visit, a workshop, a performance. Visitors send an inquiry; there is no checkout yet.
      </p>

      {experiences.length === 0 ? (
        <p className="mt-8 border border-dashed border-border p-10 text-center text-muted-foreground">
          No experiences yet.{" "}
          <Link href="/manage/experiences/new" className="underline underline-offset-4">Write the first one</Link>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Experience</th>
                <th className="pb-2 font-medium">With</th>
                <th className="pb-2 font-medium">Format</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Who sees it</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {experiences.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/manage/experiences/${e.id}`} className="font-medium underline-offset-4 hover:underline">{e.title}</Link>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {e.people.filter((p) => p.role === "artist").map((p) => p.name).join(", ") || "—"}
                  </td>
                  <td className="py-3 pr-4">{FORMAT_LABEL[e.format] ?? e.format}</td>
                  <td className="py-3 pr-4">{e.price != null && e.price > 0 ? formatPrice(e.price, e.currency) : "On request"}</td>
                  <td className="py-3 pr-4">
                    <ExperienceAudienceSelect experience={e} />
                  </td>
                  <td className="py-3 text-right">
                    <ExperienceRowActions id={e.id} slug={e.slug} status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
