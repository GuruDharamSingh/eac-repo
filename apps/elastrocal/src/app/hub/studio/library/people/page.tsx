import Link from "next/link";
import type { Metadata } from "next";
import { libraryNotes, libraryPeople, libraryReady } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { LibraryNote } from "@/components/studio/library-note";

export const metadata: Metadata = { title: "People · Library · Studio" };
export const dynamic = "force-dynamic";

/** Famous people the books name, by placement. */
export default async function LibraryPeoplePage() {
  const viewer = await requireStudioReviewer("/hub/studio/library/people");
  const groups = (await libraryReady()) ? await libraryPeople() : [];
  const notes = await libraryNotes(viewer.userId, { type: "placement" });
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <Link href="/hub/studio/library" className="text-sm text-muted-foreground hover:text-primary">
        ← Library
      </Link>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-gold">Library</p>
      <h1 className="mt-1 text-2xl font-semibold">People</h1>
      <p className="mt-2 text-sm text-muted-foreground">Famous people the books name as examples, grouped by the placement they are given for.</p>
      {groups.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No people have been imported yet.</p>}
      <ul className="mt-4 space-y-3">
        {groups.map((g) => (
          <li key={g.placement} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <Link href={`/hub/studio/library/placement/${encodeURIComponent(g.placement)}`} className="font-semibold hover:text-primary">
              {g.label} →
            </Link>
            <p className="mt-1 text-muted-foreground">
              {g.people.map((p, i) => (
                <span key={p.name} title={p.book}>
                  {i > 0 && " · "}
                  {p.name}
                </span>
              ))}
            </p>
            <div className="flex flex-wrap">
              <LibraryNote
                targetType="person"
                targetId={g.placement}
                silo={{ type: "placement", subject: g.placement }}
                context={`Famous people with ${g.label}: ${g.people.slice(0, 12).map((p) => p.name).join(", ")}`}
                note={notes[`person|${g.placement}`]}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
