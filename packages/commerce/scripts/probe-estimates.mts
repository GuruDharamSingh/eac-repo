// Rate estimates from a maker's saved ship-from to several destinations. Sandbox only;
// writes nothing (no shipment, no DB rows). Run in eac-art-auction:
//   /app/apps/admin/node_modules/.bin/tsx scripts/probe-estimates.mts <userId>
import { db } from "@elkdonis/db";
import { easyshipEnv, getShipFrom } from "../src/shipping";
import { requestRates } from "../src/shipping/easyship";

if (easyshipEnv() !== "sandbox") { console.error("Refusing: EASYSHIP_ENV is not sandbox."); process.exit(1); }
const [userId] = process.argv.slice(2);
const f = await getShipFrom(userId);
if (!f) { console.error("No ship_from saved for", userId); process.exit(1); }
const origin = {
  contact_name: f.recipientName ?? "Maker", company_name: f.company ?? f.recipientName, contact_phone: f.phone ?? "",
  contact_email: f.email, line_1: f.line1, line_2: f.line2 ?? null, city: f.city, state: f.region ?? null,
  postal_code: f.postalCode, country_alpha2: f.country,
};
const dests = [
  { label: "Montreal QC", a: { line_1: "175 Rue Sainte-Catherine O", city: "Montreal", state: "QC", postal_code: "H2X 1Y4", country_alpha2: "CA" } },
  { label: "Vancouver BC", a: { line_1: "1055 Dunsmuir St", city: "Vancouver", state: "BC", postal_code: "V7X 1L3", country_alpha2: "CA" } },
  { label: "New York NY", a: { line_1: "350 5th Ave", city: "New York", state: "NY", postal_code: "10118", country_alpha2: "US" } },
  { label: "Paris FR", a: { line_1: "5 Avenue Anatole France", city: "Paris", state: null, postal_code: "75007", country_alpha2: "FR" } },
];
const parcel = { box: { length: 68, width: 58, height: 12 }, items: [{ quantity: 1, description: "Painting", hs_code: "97011000", declared_currency: "CAD", declared_customs_value: 850, actual_weight: 4 }] };
for (const d of dests) {
  const destination = { contact_name: "Probe Buyer", contact_phone: "+15145550100", contact_email: "buyer@example.com", line_2: null, ...d.a };
  try {
    const rates = await requestRates({ origin, destination, parcels: [parcel] });
    console.log(`\n${d.label}: ${rates.length} rates`);
    for (const r of rates.slice(0, 5) as any[]) console.log("  ", r.courier_name ?? r.courier_service?.name, "|", r.courier_service?.name, "|", r.total_charge, r.currency, "|", r.min_delivery_time ?? "?", "-", r.max_delivery_time ?? "?", "days");
  } catch (e) { console.log(`\n${d.label}: ERROR`, (e as Error).message); }
}
await db.end();
