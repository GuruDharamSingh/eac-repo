// Shipping rehearsal helpers (Test mode / Easyship sandbox only). Usage:
//   docker compose run --rm --no-deps -T -e STRIPE_SECRET_KEY= -e EASYSHIP_PRODUCTION_TOKEN= \
//     -e EASYSHIP_SANDBOX_TOKEN=... -e MODE=<mode> -e ORDER=<order uuid> -w /app/apps/katie-the-potter admin \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/shipping-rehearsal.ts
// MODE
//   status    print the order's shipments (no secrets, no addresses)
//   webhook   simulate Easyship webhooks for the order's TEST shipment, signed
//             (HS256 JWT, X-EASYSHIP-SIGNATURE) with a throwaway secret, through
//             the same handler the route uses; also checks a wrong secret, a
//             missing signature and a tampered token are refused
//   cleanup   cancel the order's TEST shipments with Easyship (sandbox) and
//             mark them cancelled
// Refuses to touch a live-mode shipment, and never runs with a production token.
import { randomBytes } from "node:crypto";
import { db } from "@elkdonis/db";
import { handleEasyshipWebhook, signEasyshipJwt } from "../src/lib/shipping/webhook";
import { cancelShipmentRow, getShipment } from "../src/lib/shipping/shipments";

const MODE = process.env.MODE ?? "status";
const ORDER = process.env.ORDER ?? "";
if (process.env.EASYSHIP_PRODUCTION_TOKEN) {
  console.error("Refusing: EASYSHIP_PRODUCTION_TOKEN is set. Blank it (-e EASYSHIP_PRODUCTION_TOKEN=).");
  process.exit(1);
}
if (!/^[0-9a-f-]{36}$/i.test(ORDER)) {
  console.error("ORDER=<uuid> is required");
  process.exit(1);
}

let failed = 0;
const expect = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

async function rows() {
  return db<Array<{ id: string; mode: string; status: string; easyship_shipment_id: string | null; courier_name: string | null; tracking_number: string | null; tracking_status: string | null; label_url: string | null; created_at: Date }>>`
    SELECT id, mode, status, easyship_shipment_id, courier_name, tracking_number, tracking_status, label_url, created_at
    FROM order_shipment WHERE order_id = ${ORDER} ORDER BY created_at`;
}

async function status() {
  for (const r of await rows()) {
    console.log(`${r.id.slice(0, 8)} ${r.mode} ${r.status} es=${r.easyship_shipment_id ?? "-"} courier=${r.courier_name ?? "-"} tracking=${r.tracking_number ?? "-"} (${r.tracking_status ?? "-"}) label=${r.label_url ? "yes" : "no"}`);
  }
}

async function webhook() {
  const [r] = (await rows()).filter((x) => x.mode === "test" && x.easyship_shipment_id && ["label_bought", "in_transit", "label_pending"].includes(x.status));
  if (!r) throw new Error("no test shipment with a label on this order");
  const secret = `webh_${randomBytes(16).toString("hex")}`;
  const claims = { easyship_company_id: "TEST_COMPANY", iat: Math.floor(Date.now() / 1000) };
  const good = signEasyshipJwt(claims, secret);
  const body = (status: string) =>
    JSON.stringify({
      event_type: "shipment.tracking.status.changed",
      resource_type: "shipment",
      resource_id: r.easyship_shipment_id,
      data: { easyship_shipment_id: r.easyship_shipment_id, status, tracking_number: r.tracking_number ?? "TEST", tracking_page_url: `https://www.trackmyshipment.co/shipment-tracking/${r.easyship_shipment_id}` },
    });

  const none = await handleEasyshipWebhook(body("Delivered"), null, [secret]);
  expect(none.status === 401, `missing signature refused (${none.status} ${none.body})`);
  const wrong = await handleEasyshipWebhook(body("Delivered"), signEasyshipJwt(claims, `webh_${randomBytes(8).toString("hex")}`), [secret]);
  expect(wrong.status === 401, `wrong secret refused (${wrong.status} ${wrong.body})`);
  const [h, , s] = good.split(".");
  const forged = `${h}.${Buffer.from(JSON.stringify({ easyship_company_id: "OTHER" })).toString("base64url")}.${s}`;
  const tampered = await handleEasyshipWebhook(body("Delivered"), forged, [secret]);
  expect(tampered.status === 401, `tampered token refused (${tampered.status} ${tampered.body})`);
  const noSecrets = await handleEasyshipWebhook(body("Delivered"), good, []);
  expect(noSecrets.status === 503, `no secret configured: 503 (${noSecrets.status})`);
  expect((await getShipment(r.id))?.status === r.status, "nothing changed by the refused calls");

  const t1 = await handleEasyshipWebhook(body("In Transit to Customer"), good, [secret]);
  expect(t1.status === 200 && t1.body === "ok in_transit", `signed "In Transit to Customer" -> in_transit (${t1.body})`);
  const t2 = await handleEasyshipWebhook(body("Delivered"), good, [secret]);
  expect(t2.status === 200 && t2.body === "ok delivered", `signed "Delivered" -> delivered (${t2.body})`);
  const t3 = await handleEasyshipWebhook(body("In Transit to Customer"), good, [secret]);
  expect(t3.body === "ok delivered", `a late "In Transit" never moves it back (${t3.body})`);
  const after = await getShipment(r.id);
  expect(after?.trackingStatus === "Delivered", `latest tracking words kept (${after?.trackingStatus})`);
  const unknown = await handleEasyshipWebhook(JSON.stringify({ event_type: "shipment.tracking.status.changed", resource_type: "shipment", data: { easyship_shipment_id: "ESNOTOURS000", status: "Delivered" } }), good, [secret]);
  expect(unknown.status === 200 && unknown.body === "unknown shipment", "another account's shipment is ignored (200, no change)");
}

async function cleanup() {
  for (const r of await rows()) {
    if (r.mode !== "test") {
      console.log(`skip ${r.id.slice(0, 8)}: live shipment, not touched`);
      continue;
    }
    if (r.status === "cancelled") continue;
    const row = await getShipment(r.id);
    if (!row) continue;
    const out = await cancelShipmentRow(row, "rehearsal cleanup");
    console.log(`${r.id.slice(0, 8)} ${r.status} -> ${out.status}${out.error ? ` (Easyship: ${out.error})` : " (Easyship: cancelled)"}`);
  }
}

async function main() {
  if (MODE === "status") await status();
  else if (MODE === "webhook") {
    await webhook();
    await status();
  } else if (MODE === "cleanup") {
    await cleanup();
    await status();
  } else throw new Error(`unknown MODE ${MODE}`);
}

main()
  .then(() => process.exit(failed ? 1 : 0))
  .catch((e) => {
    console.error(String(e));
    process.exit(1);
  });
