import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { libraryNotes, libraryReady, librarySilo } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { LibrarySiloView } from "@/components/studio/library-silo";

export const metadata: Metadata = { title: "Library · Studio" };
export const dynamic = "force-dynamic";

/**
 * One Library silo: `/library/element/fire`, `/library/sign/aries`,
 * `/library/placement/sign:jupiter:capricorn`. Read-only
 * (components/studio/library-silo.tsx).
 */
export default async function LibrarySiloPage({ params }: { params: Promise<{ type: string; subject: string }> }) {
  const p = await params;
  const viewer = await requireStudioReviewer(`/hub/studio/library/${p.type}/${p.subject}`);
  if (!(await libraryReady())) notFound();
  const silo = await librarySilo(decodeURIComponent(p.type), decodeURIComponent(p.subject));
  if (!silo) notFound();
  const notes = await libraryNotes(viewer.userId, { type: silo.type, subject: silo.subject });
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio/library" className="text-sm text-muted-foreground hover:text-primary">
        ← Library
      </Link>
      <LibrarySiloView silo={silo} notes={notes} />
    </div>
  );
}
