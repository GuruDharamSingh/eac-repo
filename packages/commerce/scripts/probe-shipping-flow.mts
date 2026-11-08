// Shipping flow probe (migration 250) against throwaway rows. Sandbox only.
// Run in eac-art-auction (DATABASE_URL + EASYSHIP_* set):
//   /app/apps/admin/node_modules/.bin/tsx scripts/probe-shipping-flow.mts <step> <orderId> [userId]
// steps: quote-choose | accrue-rollback | tracking | label
import { db } from "@elkdonis/db";
import {
  easyshipEnv, quoteOrderShipping, chooseOrderShipping, accrueOrderShipping,
  recordSellerTracking, buyPlatformLabel, getOrderShippingState,
} from "../src/shipping";

if (easyshipEnv() !== "sandbox") { console.error("Refusing: EASYSHIP_ENV is not sandbox."); process.exit(1); }
const [step, orderId, userId] = process.argv.slice(2);
const dest = { recipientName: "Probe Buyer", line1: "175 Rue Sainte-Catherine O", city: "Montreal", region: "QC", postalCode: "H2X 1Y4", country: "CA", phone: "+15145550100" };

if (step === "quote-choose") {
  const q = await quoteOrderShipping(orderId, dest);
  console.log("quote:", q.ok, q.error ?? "", (q.options ?? []).map((o) => `${o.name} ${o.amountMinor} ${o.currency}`));
  if (q.ok && q.options?.[0]) {
    const c = await chooseOrderShipping({ orderId, address: dest, optionId: q.options[0].id });
    console.log("choose:", c.ok, c.error ?? "", c.shipping?.option?.name);
    const forged = await chooseOrderShipping({ orderId, address: dest, optionId: "not-a-real-service" });
    console.log("forged option refused:", !forged.ok, forged.error);
    const [o] = await db`SELECT shipping_minor, total_minor, subtotal_minor FROM commerce_order WHERE id = ${orderId}`;
    console.log("order:", o);
    console.log("state:", JSON.stringify(await getOrderShippingState(orderId)).slice(0, 200));
  }
} else if (step === "accrue-rollback") {
  try {
    await db.begin(async (tx) => {
      const [o] = await tx`SELECT * FROM commerce_order WHERE id = ${orderId}`;
      for (const rail of ["stripe", "etransfer"]) {
        await accrueOrderShipping(tx as never, o as never, userId, null, rail);
      }
      const rows = await tx`SELECT party_kind, entry_type, amount_minor, hold_reason, note FROM payout_ledger WHERE order_id = ${orderId} ORDER BY created_at`;
      console.log("ledger (will roll back):", rows);
      throw new Error("ROLLBACK");
    });
  } catch (e) { console.log("rolled back:", (e as Error).message === "ROLLBACK"); }
  const [n] = await db`SELECT count(*)::int AS n FROM payout_ledger WHERE order_id = ${orderId}`;
  console.log("ledger rows after rollback:", n.n);
} else if (step === "tracking") {
  const r = await recordSellerTracking({ orderId, actorUserId: userId, courierName: "Canpar", trackingNumber: "PROBE123", trackingUrl: "https://www.canpar.com/en/tracking" });
  console.log("tracking:", r);
} else if (step === "label") {
  const r = await buyPlatformLabel({ orderId, actorUserId: userId });
  console.log("label:", r.ok, r.error ?? "", JSON.stringify(r.shipment ?? null));
  const again = await buyPlatformLabel({ orderId, actorUserId: userId });
  console.log("second label refused:", !again.ok, again.error);
}
await db.end();
