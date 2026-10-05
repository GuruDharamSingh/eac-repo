import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { foundationLessonView, foundationsReady } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FoundationsReview } from "@/components/studio/foundations-review";

export const metadata: Metadata = { title: "Foundations · Studio" };
export const dynamic = "force-dynamic";

/**
 * One Foundations lesson: a tab per basic idea (`?c=fire`), and for the
 * chosen one everything the books say about it, to review
 * (components/studio/foundations-review.tsx).
 */
export default async function FoundationLessonPage({ params, searchParams }: { params: Promise<{ lesson: string }>; searchParams: Promise<{ c?: string }> }) {
  const { lesson } = await params;
  const viewer = await requireStudioReviewer(`/hub/studio/foundations/${lesson}`);
  const sp = await searchParams;
  if (!(await foundationsReady())) notFound();
  const view = await foundationLessonView(viewer.userId, lesson, sp.c);
  if (!view) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio/foundations" className="text-sm text-muted-foreground hover:text-primary">
          ← Foundations
        </Link>
        <Link href={`/hub/studio/foundations/${lesson}/rulebook`} className="text-sm text-primary">
          The rulebook so far →
        </Link>
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-gold">{view.lesson.title}</p>
      <nav className="mt-2 flex flex-wrap gap-2" aria-label="Ideas in this lesson">
        {view.progress.map((c) => (
          <Link
            key={c.id}
            href={`/hub/studio/foundations/${lesson}?c=${c.id}`}
            aria-current={c.id === view.concept.id ? "page" : undefined}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm",
              c.id === view.concept.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
            )}
          >
            <span className="font-semibold">{c.label}</span>{" "}
            <span className={cn("text-xs tabular-nums", c.id === view.concept.id ? "opacity-80" : "text-muted-foreground")}>
              {c.reviewed}/{c.total}
            </span>
          </Link>
        ))}
      </nav>
      <FoundationsReview key={view.concept.id} view={view} />
    </div>
  );
}
