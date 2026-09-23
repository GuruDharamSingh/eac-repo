/**
 * Paid workshop join, end to end, without touching Stripe.
 *
 * The rule this guards: a priced workshop is enrolled by PAYMENT, never by
 * asking. `confirmOrderPaid` writes the `thread_rsvps` row, so the seat and the
 * money land in one transaction — and nothing before the payment grants it.
 *
 * Creates its own workshop and buyer, asserts, then removes both. Run with:
 *   docker compose exec -T -e SENDGRID_API_KEY= art-auction sh -c \
 *     "cd /app/packages/commerce && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/probe-paid-workshop.mts"
 */

import { db } from "@elkdonis/db";
import { createThreadOrder } from "../src/server/service-orders";
import { confirmOrderPaid } from "../src/server/orders";

const ORG = "inner_group";
const THREAD_ID = "probe_paid_ws_0001";
let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label} ${detail}`);
  }
}

async function expectThrow(label: string, fn: () => Promise<unknown>, match: RegExp) {
  try {
    await fn();
    fail++;
    console.log(`  FAIL ${label} (did not throw)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ok(`${label} — "${msg.slice(0, 48)}"`, match.test(msg), msg);
  }
}

async function main() {
  const [buyer] = await db<{ id: string; email: string }[]>`
    SELECT id, email FROM users WHERE email IS NOT NULL ORDER BY created_at LIMIT 1
  `;
  if (!buyer) throw new Error("no user to act as buyer");

  await cleanup();

  // A $20 workshop with a $10 floor, authored by the buyer's org-mate (the
  // author is the payee; who that is does not matter here).
  await db`
    INSERT INTO threads (id, org_id, author_id, kind, title, slug, status, visibility,
                         is_rsvp_enabled, price, currency, section)
    VALUES (${THREAD_ID}, ${ORG}, ${buyer.id}, 'workshop', 'Probe: paid workshop',
            'probe-paid-workshop', 'published', 'PUBLIC', true, 20.00, 'CAD', 'gatherings')
  `;
  await db`
    INSERT INTO workshop_pages (thread_id, price_member, price_sliding_min, registration_status)
    VALUES (${THREAD_ID}, 20.00, 10.00, 'open')
  `;

  console.log("\ncard rail opens");
  const order = await createThreadOrder({
    orgId: ORG,
    threadId: THREAD_ID,
    kinds: ["workshop", "event"],
    customerEmail: buyer.email,
    customerId: buyer.id,
    paymentMethod: "stripe",
  });
  ok("order created on the card rail", order.paymentMethod === "stripe", order.paymentMethod);
  ok("unpaid, awaiting the card", order.status === "pending_payment", order.status);
  ok("charged the list price", order.totalMinor === 2000, String(order.totalMinor));
  const [raw] = await db<{ payment_instructions: string | null }[]>`
    SELECT payment_instructions FROM commerce_order WHERE id = ${order.id}
  `;
  ok("no eTransfer instructions on a card order", raw?.payment_instructions == null);

  console.log("\nnot enrolled until it is paid");
  const [before] = await db<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM thread_rsvps
    WHERE thread_id = ${THREAD_ID} AND user_id = ${buyer.id} AND status = 'yes'
  `;
  ok("no place held before payment", before!.n === 0, String(before!.n));

  console.log("\nsliding scale");
  const mid = await createThreadOrder({
    orgId: ORG,
    threadId: THREAD_ID,
    kinds: ["workshop"],
    customerEmail: buyer.email,
    customerId: buyer.id,
    paymentMethod: "stripe",
    amountMinor: 1500,
  });
  ok("a chosen amount inside the range is taken", mid.totalMinor === 1500, String(mid.totalMinor));
  await expectThrow(
    "below the floor is refused",
    () =>
      createThreadOrder({
        orgId: ORG,
        threadId: THREAD_ID,
        kinds: ["workshop"],
        customerEmail: buyer.email,
        customerId: buyer.id,
        paymentMethod: "stripe",
        amountMinor: 500,
      }),
    /sliding-scale range/i
  );

  console.log("\npayment grants the place");
  await confirmOrderPaid({
    orderId: order.id,
    confirmedByUserId: null,
    method: "stripe",
    paymentReference: "pi_probe",
    notes: "probe",
  });
  const [after] = await db<{ status: string }[]>`
    SELECT status FROM thread_rsvps
    WHERE thread_id = ${THREAD_ID} AND user_id = ${buyer.id}
  `;
  ok("enrolled by the payment", after?.status === "yes", String(after?.status));

  // The webhook and the return hop both land here; the second must not explode
  // the first one's work.
  await expectThrow(
    "a second confirmation is refused, not double-applied",
    () => confirmOrderPaid({ orderId: order.id, confirmedByUserId: null, method: "stripe" }),
    /cannot be marked paid|not in a state/i
  );
  const [still] = await db<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM thread_rsvps WHERE thread_id = ${THREAD_ID}
  `;
  ok("still exactly one place", still!.n === 1, String(still!.n));
}

async function cleanup() {
  const ids = await db<{ id: string }[]>`
    SELECT DISTINCT o.id FROM commerce_order o
    JOIN commerce_order_line l ON l.order_id = o.id
    WHERE l.thread_id = ${THREAD_ID}
  `;
  for (const { id } of ids) {
    await db`DELETE FROM payout_ledger WHERE order_id = ${id}`;
    await db`DELETE FROM payout WHERE order_id = ${id}`;
    await db`DELETE FROM commerce_order_line WHERE order_id = ${id}`;
    await db`DELETE FROM commerce_order WHERE id = ${id}`;
  }
  await db`DELETE FROM thread_rsvps WHERE thread_id = ${THREAD_ID}`;
  await db`DELETE FROM workshop_pages WHERE thread_id = ${THREAD_ID}`;
  await db`DELETE FROM threads WHERE id = ${THREAD_ID}`;
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
