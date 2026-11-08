// Sandbox probe for src/shipping/easyship.ts: one rate request and one
// sandbox label purchase. Refuses to run unless EASYSHIP_ENV=sandbox.
// docker compose exec -T -e EASYSHIP_ENV=sandbox -e EASYSHIP_SANDBOX_TOKEN=... admin \
//   sh -c 'cd /app/packages/commerce && npx tsx scripts/probe-easyship.mts'
import { easyshipEnv, requestRates, createShipmentWithLabel } from "../src/shipping/easyship";

if (easyshipEnv() !== "sandbox" || process.env.EASYSHIP_ENV !== "sandbox") {
  console.error("Refusing: set EASYSHIP_ENV=sandbox.");
  process.exit(1);
}
const c = (o: Record<string, string>) => ({ contact_name: "Probe", contact_phone: "+14165550100", contact_email: "info@elkdonis-arts.org", ...o }) as never;
const origin = c({ line_1: "123 Test Road", city: "Toronto", state: "ON", postal_code: "M4C 4Y7", country_alpha2: "CA" });
const destination = c({ line_1: "175 Rue Sainte-Catherine O", city: "Montreal", state: "QC", postal_code: "H2X 1Y4", country_alpha2: "CA" });
const parcels = [{ box: { length: 70, width: 60, height: 10 }, items: [{ quantity: 1, description: "Framed painting", hs_code: "97011000", declared_currency: "CAD", declared_customs_value: 800, actual_weight: 5 }] }];

const rates = await requestRates({ origin, destination, parcels });
console.log("rates:", rates.map((r) => `${r.courier_service.name} ${r.total_charge} ${r.currency}`));
if (!rates[0]) process.exit(0);
await new Promise((r) => setTimeout(r, 2000));
const s = await createShipmentWithLabel({ origin, destination, parcels, courierServiceId: rates[0].courier_service.id, reference: "PROBE-1" });
console.log(JSON.stringify({
  id: s.easyship_shipment_id, label_state: s.label_state, shipment_state: s.shipment_state,
  tracking_page_url: s.tracking_page_url, trackings: s.trackings,
  docs: (s.shipping_documents ?? []).map((d) => ({ category: d.category, format: d.format, url: d.url, b64: d.base64_encoded_strings?.length })),
  courier: s.courier_service, rates: (s.rates ?? []).map((r) => [r.courier_service?.name, r.total_charge, r.currency]),
}, null, 1));
