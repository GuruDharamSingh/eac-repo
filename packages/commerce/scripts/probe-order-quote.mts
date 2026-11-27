// Quote for an existing unpaid order to an address. Sandbox only; writes nothing.
//   /app/apps/admin/node_modules/.bin/tsx scripts/probe-order-quote.mts <orderId> '<address json>'
import { db } from "@elkdonis/db";
import { easyshipEnv, getOrderShippingState, quoteOrderShipping } from "../src/shipping";
if (easyshipEnv() !== "sandbox") { console.error("Refusing: EASYSHIP_ENV is not sandbox."); process.exit(1); }
const [orderId, json] = process.argv.slice(2);
const st = await getOrderShippingState(orderId);
console.log("state:", JSON.stringify({ canQuote: st?.canQuote, reason: st?.reason, mode: st?.mode }));
const addr = json ? JSON.parse(json) : { recipientName: "Probe Buyer", line1: "175 Rue Sainte-Catherine O", city: "Montreal", region: "QC", postalCode: "H2X 1Y4", country: "CA", phone: "+15145550100" };
const q = await quoteOrderShipping(orderId, addr);
console.log("quote:", q.ok, q.error ?? "", (q.options ?? []).map((o) => `${o.name} ${o.amountMinor / 100} ${o.currency}`));
await db.end();
