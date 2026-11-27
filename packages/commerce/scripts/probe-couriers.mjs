// Raw Easyship /rates comparison (quotes only, buys nothing; read-only). Run in eac-art-auction:
//   node /app/packages/commerce/scripts/probe-couriers.mjs
const V = "2024-09";
const origin = { contact_name: "Guru Dharam Singh", company_name: "Guru Dharam Singh", contact_phone: "6472006155", contact_email: "justin.gillisb@gmail.com", line_1: "348 Palmerston Blvd", city: "Toronto", state: "ON", postal_code: "M6G 2N6", country_alpha2: "CA" };
const dest = { contact_name: "Probe", contact_phone: "6472006155", contact_email: "buyer@example.com", line_1: "10 Dunhill St", city: "Toronto", state: "ON", postal_code: "M1C 1Y4", country_alpha2: "CA" };
const parcel = (l, w, h, kg) => ({ box: { length: l, width: w, height: h }, items: [{ quantity: 1, description: "Painting", hs_code: "97011000", declared_currency: "CAD", declared_customs_value: 1, actual_weight: kg }] });
async function rates(label, host, tok, p, rules) {
  const r = await fetch(`https://${host}/${V}/rates`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ origin_address: origin, destination_address: dest, incoterms: "DDU", insurance: { is_insured: false }, shipping_settings: { units: { weight: "kg", dimensions: "cm" } }, parcels: [p], courier_settings: { show_courier_logo_url: false, apply_shipping_rules: rules } }) });
  const j = await r.json();
  console.log(`\n${label} [${r.status}] keys=${Object.keys(j).join(",")}`);
  for (const x of (j.rates ?? []).sort((a, b) => a.total_charge - b.total_charge)) console.log("  ", x.courier_service?.umbrella_name, "|", x.courier_service?.name, "|", x.total_charge, x.currency, "|", x.min_delivery_time, "-", x.max_delivery_time, "d");
  if (!r.ok) console.log("  ", JSON.stringify(j).slice(0, 300));
}
const envs = [["sandbox", "public-api-sandbox.easyship.com", process.env.EASYSHIP_SANDBOX_TOKEN], ["production", "public-api.easyship.com", process.env.EASYSHIP_PRODUCTION_TOKEN]];
for (const [n, h, t] of envs) {
  await rates(`${n} large 68x58x12 4kg, rules on`, h, t, parcel(68, 58, 12, 4), true);
  await rates(`${n} large 68x58x12 4kg, rules off`, h, t, parcel(68, 58, 12, 4), false);
  await rates(`${n} small 30x25x5 1kg, rules on`, h, t, parcel(30, 25, 5, 1), true);
}
