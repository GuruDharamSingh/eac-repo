// One-off verification for the buyer journey (no Stripe calls). Usage:
//   docker compose run --rm --no-deps -T -e ORDER_ID=<uuid> [-e CANCEL=1] -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/verify-r3.ts
// Prints the order's state, whether the sample guard sees a sample piece in
// it, whether any Stripe session was recorded, and the pieces' statuses; with
// CANCEL=1 it cancels the order through cancelOrder (the app's own path) and
// shows the pieces afterwards.
import { db } from "@elkdonis/db";
import { cancelOrder } from "@elkdonis/commerce/server";
import { orderHasSamplePiece, SAMPLE_CARD_GUARD } from "../src/lib/sample-guard";

async function main() {
  const id = process.env.ORDER_ID!;
  const [o] = await db`SELECT number, status, payment_method, customer_id, payment_metadata AS pm FROM commerce_order WHERE id = ${id}`;
  console.log("order:", JSON.stringify({ number: o?.number, status: o?.status, method: o?.payment_method, customerId: o?.customer_id, stripeSessionRecorded: Boolean(o?.pm?.stripe) }));
  console.log("SAMPLE_CARD_GUARD:", SAMPLE_CARD_GUARD, "| orderHasSamplePiece:", await orderHasSamplePiece(id));
  const show = async (label: string) =>
    console.log(label, JSON.stringify(await db`SELECT a.title, a.status FROM commerce_order_line l JOIN artwork a ON a.id = l.artwork_id WHERE l.order_id = ${id}`));
  await show("pieces before:");
  console.log("active reservations:", JSON.stringify(await db`SELECT count(*)::int AS n FROM reservation r JOIN commerce_order_line l ON l.artwork_variant_id = r.artwork_variant_id WHERE l.order_id = ${id} AND r.status = 'active'`));
  if (process.env.CANCEL === "1") {
    const c = await cancelOrder({ orderId: id, reason: "round-3 test order (sample piece, eTransfer rail)" });
    console.log("cancelled ->", c.status);
    await show("pieces after:");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
