import Link from "next/link";
import type { Metadata } from "next";
import { correspondenceView } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { CorrespondenceTable } from "@/components/studio/foundation-cells";

export const metadata: Metadata = { title: "Correspondences · Foundations · Studio" };
export const dynamic = "force-dynamic";

/**
 * The correspondence table: one kind of subject at a time (`?type=sign`),
 * subjects as columns, categories as rows, every book's values side by side
 * in the cell (components/studio/foundation-cells.tsx).
 */
export default async function CorrespondencesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const viewer = await requireStudioReviewer("/hub/studio/foundations/correspondences");
  const sp = await searchParams;
  const view = await correspondenceView(viewer.userId, sp.type);
  return (
    <div className="px-4 pb-24 pt-6">
      <Link href="/hub/studio/foundations" className="text-sm text-muted-foreground hover:text-primary">
        ← Foundations
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">The correspondence table</p>
      <h1 className="mt-1 text-2xl font-semibold">What goes with what</h1>
      {view ? (
        <CorrespondenceTable key={view.table.subjectType} view={view} />
      ) : (
        <p className="mt-6 max-w-2xl rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No table has been imported yet.</p>
      )}
    </div>
  );
}
