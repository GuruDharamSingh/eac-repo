// Prints every edited trail (a working draft, or a version marked Kept) as a readable diff against
// packages/actions/atlas/tracks, so Claude can fold the edits into the atlas and the live courses.
// Run in a container with tsx and DATABASE_URL set:
//   tsx apps/development/scripts/rails-drafts.mts [course-id] [--all]
// --all also lists versions that are not marked Kept (newest per branch).
// Read-only. Nothing here writes to the database or the atlas.
import { db } from "@elkdonis/db";
import { loadNexus } from "../../../packages/actions/atlas/tracks/index";

interface Step {
  cap?: string;
  gap?: string;
  weight?: string;
  note?: string;
}
interface Doc {
  steps?: Step[];
  note?: string;
}
type Row = { id: string; subject: string; kind: string; branch: string; note: string | null; doc: Doc; kept: boolean; created_at: Date; updated_at: Date; who: string | null };

const args = process.argv.slice(2);
const all = args.includes("--all");
const only = args.find((a) => !a.startsWith("--"));

const { tracks, courses } = await loadNexus();
const trackById = new Map(tracks.map((t) => [t.id, t]));
const sig = (s: { cap?: string; gap?: string }) => (s.cap ? s.cap : `GAP: ${s.gap}`);

function atlasSteps(courseId: string): Array<{ s: string; track: string }> {
  const c = courses.find((x) => x.id === courseId);
  if (!c) return [];
  return c.tracks.flatMap((tid) => (trackById.get(tid)?.steps ?? []).map((st) => ({ s: typeof st === "string" ? st : `GAP: ${st.gap}`, track: tid })));
}

const rows = await db<Row[]>`
  SELECT v.id, v.subject, v.kind, v.branch, v.note, v.doc, v.kept, v.created_at, v.updated_at,
         COALESCE(NULLIF(u.display_name, ''), u.email) AS who
    FROM dev_versions v LEFT JOIN users u ON u.id = v.author_id
   WHERE v.subject LIKE 'rail:%'
   ORDER BY v.subject, v.created_at`;

const bySubject = new Map<string, Row[]>();
for (const r of rows) bySubject.set(r.subject, [...(bySubject.get(r.subject) ?? []), r]);

let printed = 0;
for (const [subject, list] of bySubject) {
  const courseId = subject.slice("rail:".length);
  if (only && only !== courseId) continue;
  const picks: Row[] = [];
  for (const r of list) if (r.kind === "draft" || r.kept) picks.push(r);
  if (all) {
    const newest = new Map<string, Row>();
    for (const r of list) if (r.kind === "version" && !r.kept) newest.set(r.branch, r);
    picks.push(...newest.values());
  }
  if (!picks.length) continue;
  const course = courses.find((c) => c.id === courseId);
  console.log(`\n=== ${courseId}${course ? ` (${course.label})` : "  (not in the atlas any more)"} ===`);
  const base = atlasSteps(courseId);
  for (const r of picks) {
    printed++;
    const label = r.kind === "draft" ? `WORKING DRAFT by ${r.who ?? "?"}, updated ${r.updated_at.toISOString()}` : `${r.kept ? "KEPT" : "version"} on branch "${r.branch}" by ${r.who ?? "?"}, ${r.created_at.toISOString()}${r.note ? `: ${r.note}` : ""}`;
    console.log(`\n--- ${label}`);
    const steps = r.doc?.steps ?? [];
    if (r.doc?.note) console.log(`Note on the trail: ${r.doc.note}`);
    const cur = steps.map(sig);
    const baseSet = new Set(base.map((b) => b.s));
    const curSet = new Set(cur);
    for (const b of base) if (!curSet.has(b.s)) console.log(`  - drop   ${b.s}   (was in module ${b.track})`);
    steps.forEach((s, i) => {
      if (!baseSet.has(sig(s))) console.log(`  + add    ${sig(s)}   at position ${i + 1}`);
    });
    const commonCur = cur.filter((x) => baseSet.has(x));
    const commonBase = base.map((b) => b.s).filter((x) => curSet.has(x));
    commonCur.forEach((x, i) => {
      if (commonBase[i] !== x) console.log(`  ~ move   ${x}   now position ${cur.indexOf(x) + 1}, atlas position ${base.findIndex((b) => b.s === x) + 1}`);
    });
    for (const s of steps) {
      if (s.weight && s.weight !== "essential") console.log(`  * mark   ${sig(s)} as ${s.weight.toUpperCase()}`);
      if (s.note?.trim()) console.log(`  # note   ${sig(s)}: ${s.note.trim()}`);
    }
    console.log(`  proposed order:`);
    steps.forEach((s, i) => console.log(`    ${String(i + 1).padStart(2)}. ${sig(s)}${s.weight && s.weight !== "essential" ? `  [${s.weight}]` : ""}`));
  }
}
if (!printed) console.log("No edited trails yet.");
await db.end({ timeout: 2 });
