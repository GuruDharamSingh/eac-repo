// Hand-over test helper (no Stripe, no email). Modes:
//   MODE=snapshot                      print who owns the org, the store, its team and its pieces
//   MODE=revert CLAIMANT=<email>       put everything back on the placeholder and delete the
//                                      throwaway claimant's rows (user_organizations -> users);
//                                      the GoTrue user is deleted by the caller afterwards
//   docker compose run --rm --no-deps -T -e MODE=... -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/claim-test.ts
import { db } from "@elkdonis/db";

const ORG = "katie-the-potter";
const PLACEHOLDER = "katie@katiethepotter.example";
const STORE = "632bb16f-fe37-45e9-9611-2de298bed2ad";

async function snapshot(label: string) {
  const orgRoles = await db`SELECT u.email, uo.role FROM user_organizations uo JOIN users u ON u.id = uo.user_id WHERE uo.org_id = ${ORG} ORDER BY uo.role, u.email`;
  const [store] = await db`SELECT s.id, s.status, s.owner_kind, u.email AS owner_email FROM store s LEFT JOIN users u ON u.id = s.owner_user_id WHERE s.id = ${STORE}`;
  const team = await db`SELECT u.email, sm.role FROM store_member sm JOIN users u ON u.id = sm.user_id WHERE sm.store_id = ${STORE} ORDER BY u.email`;
  const makers = await db`SELECT u.email, count(*)::int AS n FROM artwork a LEFT JOIN users u ON u.id = a.artist_user_id WHERE a.store_id = ${STORE} GROUP BY u.email`;
  const tokens = await db`SELECT count(*) FILTER (WHERE consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now())::int AS open, count(*) FILTER (WHERE consumed_at IS NOT NULL)::int AS used, count(*)::int AS total FROM org_claim_tokens WHERE org_id = ${ORG}`;
  console.log(label, JSON.stringify({ orgRoles, store, team, makers, tokens: tokens[0] }));
}

async function revert(claimantEmail: string) {
  const [p] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = lower(${PLACEHOLDER})`;
  const [c] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = lower(${claimantEmail})`;
  if (!p) throw new Error("placeholder missing");
  if (!/^claim-test\+[a-z0-9]+@example\.com$/i.test(claimantEmail)) throw new Error("refusing: not a throwaway claim-test address");
  await db.begin(async (tx) => {
    await tx`UPDATE store SET owner_user_id = ${p.id}, updated_at = now() WHERE id = ${STORE}`;
    // Baseline (snapshot before the test, 2026-11-07): the store had NO store_member
    // rows; ownership was store.owner_user_id alone. So nothing is re-inserted here.
    if (c) {
      await tx`UPDATE artwork SET artist_user_id = ${p.id} WHERE store_id = ${STORE} AND artist_user_id = ${c.id}`;
      await tx`DELETE FROM store_member WHERE store_id = ${STORE} AND user_id = ${c.id}`;
    }
    await tx`UPDATE user_organizations SET role = 'owner' WHERE org_id = ${ORG} AND user_id = ${p.id}`;
    if (c) {
      await tx`DELETE FROM user_organizations WHERE user_id = ${c.id}`;
      await tx`UPDATE org_claim_tokens SET consumed_by = NULL WHERE consumed_by = ${c.id}`;
      await tx`DELETE FROM users WHERE id = ${c.id}`;
    }
  });
  console.log("reverted; claimant row deleted:", Boolean(c), c?.id ?? "");
}

async function main() {
  if (process.env.MODE === "revert") {
    await snapshot("before revert:");
    await revert(process.env.CLAIMANT ?? "");
    await snapshot("after revert:");
  } else {
    await snapshot("snapshot:");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e)); process.exit(1); });
