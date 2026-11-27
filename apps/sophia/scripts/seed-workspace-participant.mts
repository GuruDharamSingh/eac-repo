// One test participant for the workspace screens (slice 3a, owner approved D10). Creates a users row through
// services createUnclaimedProfile (no email, no password, never signs in; used only through SOPHIA_DEV_VIEWER_ID on a dev copy),
// then seats it in the clay-and-breath run through the lms package enrol(). The invite-only rule is passed
// by presenting a guide role of the course org to enrol(), which is the engine path a guide uses.
//   docker compose run --rm --no-deps -e NODE_ENV=development -e SENDGRID_API_KEY= sophia sh -c "cd /app/packages/lms && npx tsx ../../apps/sophia/scripts/seed-workspace-participant.mts"
import { db } from "@elkdonis/db";
import { createUnclaimedProfile } from "@elkdonis/services";
import { enrol, getCourseBySlug, getRunBySlug } from "@elkdonis/lms";

const NAME = process.env.SEED_NAME ?? "Workspace Participant (test)";
const course = await getCourseBySlug("clay-and-breath");
const run = course ? await getRunBySlug(course.id, "thursday-evenings") : null;
if (!course || !run) throw new Error("clay-and-breath run missing");
let [u] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE display_name = ${NAME} LIMIT 1`;
if (!u) {
  const r = await createUnclaimedProfile({ displayName: NAME, slug: NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), sourceNote: "Test participant for workspace screens" });
  if (!r.ok) throw new Error(r.error);
  u = { id: r.userId };
}
const seat = await enrol({ userId: u.id, roles: { [course.orgId]: "guide" } }, run.id);
console.log(JSON.stringify({ userId: u.id, runId: run.id, seat: seat.ok ? { enrolmentId: seat.enrolment.id, isNew: seat.isNew } : seat.error }));
process.exit(0);
