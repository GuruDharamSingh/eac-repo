// A dedicated test profile for "a network admin with no organisation role": created the same unclaimed way as the participants
// (no email, no password, never signs in). It is NOT an admin until the PM flags it. Memberships: none.
//   docker compose run --rm --no-deps -e NODE_ENV=development -e SENDGRID_API_KEY= sophia sh -c "cd /app/packages/lms && npx tsx ../../apps/sophia/scripts/seed-test-admin.mts"
import { db } from "@elkdonis/db";
import { createUnclaimedProfile } from "@elkdonis/services";

const NAME = "Workspace Admin Test (no role)";
let [u] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE display_name = ${NAME} LIMIT 1`;
if (!u) {
  const r = await createUnclaimedProfile({ displayName: NAME, slug: "workspace-admin-test", sourceNote: "Test profile for the workspace screens (admin view, no organisation role)" });
  if (!r.ok) throw new Error(r.error);
  u = { id: r.userId };
}
console.log(JSON.stringify({ userId: u.id, name: NAME }));
process.exit(0);
