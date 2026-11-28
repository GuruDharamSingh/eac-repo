import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireNetworkAdmin } from "@/lib/gate";
import { isMissingTable, listHistory } from "@/lib/versions";
import type { History } from "@/lib/versions-types";
import { capById, countLevels, courseById, courseSteps, leadsTo, readiness, slim } from "@/rails/data";
import { TrailEditor, type BaseStep } from "@/rails/TrailEditor";
import { CountsBar, Legend, SampleBanner } from "@/rails/ui";
import { railSubject, type Cap, type RailDoc } from "@/rails/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const { course } = await params;
  return { title: courseById.get(course)?.label ?? "Course" };
}

function asDoc(doc: unknown): RailDoc | null {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as RailDoc).steps)) return null;
  return doc as RailDoc;
}

export default async function RailCoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: id } = await params;
  const admin = await requireNetworkAdmin(`/rails/${id}`);
  const course = courseById.get(id);
  if (!course) notFound();

  const steps = courseSteps(id);
  const baseline: BaseStep[] = steps.map((s) => ({ cap: s.cap, gap: s.gap, trackLabel: s.trackLabel }));
  const details: Record<string, Cap> = {};
  for (const s of steps) if (s.cap && capById.get(s.cap)) details[s.cap] = capById.get(s.cap)!;

  // The saved work for this course: the draft first, else the kept version, else the newest one.
  let history: History | null = null;
  let setupMessage: string | null = null;
  try {
    history = await listHistory(railSubject(id), admin.userId);
  } catch (e) {
    setupMessage = isMissingTable(e) ? "Saving is not set up yet: the database table has not been created, so edits stay in this page only." : "Saved versions could not be read just now.";
  }
  let initialDoc: RailDoc | null = null;
  let initialBaseId: string | null = null;
  let initialFrom: "draft" | "version" | "atlas" = "atlas";
  if (history) {
    const pick = history.versions.find((v) => v.kept) ?? history.versions[history.versions.length - 1] ?? null;
    if (history.draft && asDoc(history.draft.doc)) {
      initialDoc = asDoc(history.draft.doc);
      initialBaseId = history.draft.baseId;
      initialFrom = "draft";
    } else if (pick && asDoc(pick.doc)) {
      initialDoc = asDoc(pick.doc);
      initialBaseId = pick.id;
      initialFrom = "version";
    }
  }
  // Extra detail for any capability the saved work names.
  for (const s of initialDoc?.steps ?? []) if (s.cap && capById.get(s.cap)) details[s.cap] = capById.get(s.cap)!;

  const counts = countLevels(steps.map((s) => s.level));
  const after = leadsTo(id);
  return (
    <div className="dev-page dev-r-page">
      <Link href="/rails" className="dev-back">
        All trails
      </Link>
      <h1>{course.label}</h1>
      <div className="dev-r-sub" style={{ marginTop: 6 }}>
        <span className="dev-r-area">{course.area}</span>
        <CountsBar counts={counts} />
        <span className="dev-r-builds">
          {course.builds_on.length ? (
            <>
              Builds on:
              {course.builds_on.map((b) => (
                <Link key={b} href={`/rails/${b}`}>
                  {courseById.get(b)?.label ?? b}
                </Link>
              ))}
            </>
          ) : (
            "Starts here (builds on nothing)"
          )}
        </span>
        {after.length ? (
          <span className="dev-r-builds">
            Courses that build on this:
            {after.map((b) => (
              <Link key={b.id} href={`/rails/${b.id}`}>
                {b.label}
              </Link>
            ))}
          </span>
        ) : null}
      </div>
      <SampleBanner sample={readiness.sample} />
      <Legend />
      <h2>Steps, in order</h2>
      <TrailEditor
        course={id}
        baseline={baseline}
        details={details}
        pool={readiness.capabilities.map(slim)}
        initialDoc={initialDoc}
        initialBaseId={initialBaseId}
        initialFrom={initialFrom}
        history={history}
        setupMessage={setupMessage}
      />
    </div>
  );
}
