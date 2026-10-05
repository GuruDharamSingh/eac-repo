import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { subjectView } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { SubjectPage } from "@/components/studio/foundation-cells";
import { SUBJECT_TYPE_LABEL, label } from "@/components/studio/foundation-labels";

export const metadata: Metadata = { title: "Subject · Foundations · Studio" };
export const dynamic = "force-dynamic";

/**
 * One subject (the element fire, the sign Aries, …): everything any book
 * gives for it, in one place — by subsection (the thing itself; a lot of it;
 * little or none of it), then category, each value tagged with its book.
 */
export default async function FoundationSubjectPage({ params }: { params: Promise<{ type: string; subject: string }> }) {
  const p = await params;
  const type = decodeURIComponent(p.type);
  const subject = decodeURIComponent(p.subject);
  const viewer = await requireStudioReviewer(`/hub/studio/foundations/subject/${p.type}/${p.subject}`);
  const data = await subjectView(viewer.userId, type, subject);
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href={`/hub/studio/foundations/correspondences?type=${type}`} className="text-sm text-muted-foreground hover:text-primary">
        ← {label(SUBJECT_TYPE_LABEL, type)} in the table
      </Link>
      <SubjectPage view={data.view} history={data.history} />
    </div>
  );
}
