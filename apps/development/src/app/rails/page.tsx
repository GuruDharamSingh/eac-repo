import type { Metadata } from "next";
import Link from "next/link";
import { requireNetworkAdmin } from "@/lib/gate";
import { countsBySubject } from "@/lib/versions";
import { capById, countLevels, courseById, courseSteps, readiness, trackById } from "@/rails/data";
import { CountsBar, Legend, SampleBanner } from "@/rails/ui";
import { levelOf, railSubject, stepAnchor } from "@/rails/types";

export const metadata: Metadata = { title: "Rails" };
export const dynamic = "force-dynamic";

const AREA_ORDER = ["profile", "organisation", "publishing", "business", "site", "artwork", "production", "email"];

export default async function RailsPage() {
  await requireNetworkAdmin("/rails");
  // How many saved edits each course has. If the versions table is missing, show none.
  let edits: Record<string, number> = {};
  try {
    edits = await countsBySubject();
  } catch {
    edits = {};
  }
  const courses = [...readiness.courses].sort((a, b) => AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area));
  const allSteps = readiness.courses.flatMap((c) => courseSteps(c.id));
  return (
    <div className="dev-page dev-r-page" style={{ maxWidth: "none" }}>
      <h1>Rails</h1>
      <p className="dev-lede">
        The trails a person can follow in the dock, one lane per course. Each box is a module; each chip is a step, coloured by how far it is built. Open a course to see every step and to edit its trail. Edits are drafts and never reach the live courses.
      </p>
      <SampleBanner sample={readiness.sample} />
      <Legend counts={readiness.counts} total={readiness.capabilities.length} note={`Counts above are every capability on the platform. The ${readiness.courses.length} courses use ${new Set(allSteps.map((s) => s.cap).filter(Boolean)).size} of them.`} />
      <div className="dev-r-sub">
        <Link href="/rails/nexus" className="dev-r-link">
          How the modules connect (trail map)
        </Link>
        <Link href="/map" className="dev-r-link">
          Every capability
        </Link>
        <span className="dev-r-muted">Snapshot of {readiness.generated.slice(0, 16).replace("T", " ")} UTC</span>
      </div>

      <div className="dev-r-lanes">
        {courses.map((c) => {
          const steps = courseSteps(c.id);
          const counts = countLevels(steps.map((s) => s.level));
          const n = edits[railSubject(c.id)] ?? 0;
          return (
            <section key={c.id} className="dev-r-lane" data-dev-anchor={`rail:${c.id}`}>
              <header>
                <h2>
                  <Link href={`/rails/${c.id}`}>{c.label}</Link>
                </h2>
                <span className="dev-r-area">{c.area}</span>
                <CountsBar counts={counts} />
                {n ? <span className="dev-r-edited">{n} saved edit{n === 1 ? "" : "s"}, not live</span> : null}
                {c.builds_on.length ? (
                  <span className="dev-r-builds">
                    Builds on:
                    {c.builds_on.map((b) => (
                      <Link key={b} href={`/rails/${b}`}>
                        {courseById.get(b)?.label ?? b}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <span className="dev-r-builds">Starts here (builds on nothing)</span>
                )}
              </header>
              <div className="dev-r-modules">
                {c.tracks.map((tid) => {
                  const t = trackById.get(tid);
                  if (!t) return null;
                  const mine = steps.filter((s) => s.trackId === tid);
                  return (
                    <div key={tid} className="dev-r-mod" data-dev-anchor={`track:${tid}`}>
                      <div className="dev-r-modname">
                        {t.label}
                        <small>{mine.length} step{mine.length === 1 ? "" : "s"}</small>
                      </div>
                      <div className="dev-r-chips">
                        {mine.map((s) => {
                          const label = s.cap ? (capById.get(s.cap)?.label ?? s.cap) : `Missing: ${s.gap}`;
                          return (
                            <Link
                              key={s.index}
                              href={`/rails/${c.id}#step-${s.index + 1}`}
                              className={`dev-r-chip is-${s.level}`}
                              style={{ ["--lv" as string]: levelOf(s.level).color }}
                              title={`${label} (${levelOf(s.level).name})`}
                              data-dev-anchor={stepAnchor(c.id, s, s.index)}
                            >
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
