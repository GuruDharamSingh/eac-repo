/**
 * The manual settlement tier: accrue → (hold) → pay → statement.
 *
 * Guards the invariant that makes this safe to operate: you cannot settle
 * money that is held, and you cannot settle the same money twice, because the
 * payout row and the negative ledger entry are written together.
 *
 *   docker compose exec -T art-auction sh -c "cd /app/packages/commerce && \
 *     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/probe-settlement.mts"
 */

import { db } from "@elkdonis/db";
import {
  writeEntry,
  getBalance,
  recordPayout,
  getEarningsStatement,
  releaseHold,
} from "../src/server/ledger";
import {
  payoutRailsFor,
  payoutSetupIssue,
  canEtransfer,
  canUseStripeExpress,
} from "../src/payout-rails";

let pass = 0,
  fail = 0;
const ok = (label: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${detail}`); }
};

let userId = "";

async function cleanup() {
  if (!userId) return;
  await db`DELETE FROM payout_ledger WHERE party_user_id = ${userId}`;
  await db`DELETE FROM payout WHERE artist_user_id = ${userId}`;
}

async function main() {
  const [u] = await db<{ id: string }[]>`
    SELECT id FROM users WHERE email IS NOT NULL ORDER BY created_at LIMIT 1
  `;
  userId = u!.id;
  const party = { kind: "user" as const, userId };
  await cleanup();

  console.log("\ncountry rules");
  ok("Canada can e-transfer", canEtransfer("CA"));
  ok("the US cannot e-transfer", !canEtransfer("US"));
  ok("the US can use Express from a CA platform", canUseStripeExpress("US"));
  ok("Australia cannot (not in supported_transfer_countries)", !canUseStripeExpress("AU"));
  ok("'Canada' spelled out still resolves", canEtransfer("Canada"));
  const caRails = payoutRailsFor("CA").map((r) => r.rail);
  ok("Canada is offered both rails", caRails.join(",") === "etransfer,stripe", caRails.join(","));
  const usRails = payoutRailsFor("US").map((r) => r.rail);
  ok("the US is offered Stripe only", usRails.join(",") === "stripe", usRails.join(","));
  ok("the US recommendation IS Stripe", payoutRailsFor("US")[0]!.recommended);
  const auRails = payoutRailsFor("AU").map((r) => r.rail);
  ok("Australia falls to manual", auRails.join(",") === "manual", auRails.join(","));
  ok(
    "an e-transfer setup abroad is flagged",
    payoutSetupIssue({ country: "US", payoutMethod: "etransfer", payoutEmail: "a@b.c", stripeOnboardedAt: null }) != null
  );
  ok(
    "a Canadian with an email is fine",
    payoutSetupIssue({ country: "CA", payoutMethod: "etransfer", payoutEmail: "a@b.c", stripeOnboardedAt: null }) == null
  );
  ok(
    "half-finished Stripe is flagged",
    payoutSetupIssue({ country: "CA", payoutMethod: "stripe", payoutEmail: null, stripeOnboardedAt: null }) != null
  );

  console.log("\naccruals and what is payable");
  await writeEntry({ party, entryType: "accrual", amountMinor: 5000, currency: "CAD", note: "probe sale A" });
  const heldEntry = await writeEntry({
    party, entryType: "accrual", amountMinor: 3000, currency: "CAD",
    holdReason: "dispute_window", note: "probe sale B (held)",
  });
  let bal = await getBalance(party);
  ok("total counts both", bal.totalMinor === 8000, String(bal.totalMinor));
  ok("only the unheld part is payable", bal.payableMinor === 5000, String(bal.payableMinor));
  ok("the held part is reported held", bal.heldMinor === 3000, String(bal.heldMinor));

  console.log("\nsettling up");
  const over = await recordPayout({
    party, amountMinor: 8000, method: "etransfer", actorUserId: userId,
  });
  ok("cannot pay out held money", !over.ok, over.error ?? "");
  const paid = await recordPayout({
    party, amountMinor: 5000, method: "etransfer",
    reference: "PROBE-REF-1", actorUserId: userId, note: "probe settle",
  });
  ok("paying the payable amount succeeds", paid.ok, paid.error ?? "");

  bal = await getBalance(party);
  ok("balance drops by what was paid", bal.totalMinor === 3000, String(bal.totalMinor));
  ok("nothing payable remains", bal.payableMinor === 0, String(bal.payableMinor));

  const [prow] = await db<{ status: string; method: string; reference: string; sent_at: string }[]>`
    SELECT status, method, reference, sent_at FROM payout WHERE id = ${paid.payoutId!}
  `;
  ok("an audit row exists, marked sent", prow?.status === "sent", String(prow?.status));
  ok("with the reference we can look up", prow?.reference === "PROBE-REF-1", String(prow?.reference));
  ok("and a sent timestamp", Boolean(prow?.sent_at));

  const again = await recordPayout({ party, amountMinor: 5000, method: "etransfer", actorUserId: userId });
  ok("the same money cannot be paid twice", !again.ok, again.error ?? "");

  console.log("\nreleasing lets the rest settle");
  await releaseHold({ entryId: heldEntry.id, releasedBy: userId, note: "probe release" });
  bal = await getBalance(party);
  ok("released money becomes payable", bal.payableMinor === 3000, String(bal.payableMinor));

  console.log("\nthe statement an artist reads");
  const lines = await getEarningsStatement(party);
  ok("no release rows in the statement", lines.every((l) => l.entryType !== "release"));
  const payoutLine = lines.find((l) => l.entryType === "payout");
  ok("the payout shows as negative", (payoutLine?.amountMinor ?? 0) === -5000, String(payoutLine?.amountMinor));
  ok("and names how it was sent", payoutLine?.payoutMethod === "etransfer", String(payoutLine?.payoutMethod));
  ok("and carries the reference", payoutLine?.payoutReference === "PROBE-REF-1");
  ok("three money lines in total", lines.length === 3, String(lines.length));
  ok("the released accrual no longer reads as held", !lines.find((l) => l.note?.includes("held"))?.held);
}

main()
  .then(async () => {
    await cleanup();
    console.log(`\n${fail === 0 ? `all ${pass} checks passed` : `${fail} FAILED, ${pass} passed`}`);
    await db.end();
    process.exit(fail === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error("\nprobe threw:", err);
    await cleanup().catch(() => {});
    await db.end();
    process.exit(1);
  });
