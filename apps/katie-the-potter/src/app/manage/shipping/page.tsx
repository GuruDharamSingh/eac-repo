import type { Metadata } from "next";
import { db } from "@elkdonis/db";
import { Notice, PageHeader } from "@elkdonis/cms-ui/manage";
import { loadManageCtx } from "@/lib/manage";
import { isEasyshipConfigured } from "@/lib/shipping/easyship";
import { accountOf, getInsurance, getPacking, getShipFrom, getShippingMode, labelBuyingEnabled, liveBlockers, shipFromHash } from "@/lib/shipping/settings";
import { InsuranceForm, ModeSwitch, PackingForm, ShipFromForm, TryIt } from "@/components/manage/shipping-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shipping" };

// Quote-only (docs/SHIPPING_PLAN.md): the collective buys no labels. Katie
// sees Off / Test / On; the parked label-buying modes are developer-only.
const MODE_WORDS = {
  off: "Off: you arrange shipping with each buyer by email, as now.",
  quote_test: "Test: only editors see Choose shipping on an order. Sandbox quotes (sample prices), no payment, nothing is shipped.",
  quote: "On: after paying for a piece, buyers choose a carrier from live quotes and pay you for shipping. You buy the label and type in the tracking.",
  test: "Label buying test (developer mode): sandbox labels, no payment.",
  live: "Label buying Live (developer mode): the collective buys labels on its Easyship account.",
} as const;

const MODE_TITLE = { off: "Off", quote_test: "in Test mode", quote: "On", test: "in label-buying test (developer)", live: "label-buying Live (developer)" } as const;

export default async function ManageShipping() {
  const { store, canAct, isStoreOwner } = await loadManageCtx("/manage/shipping");
  const [mode, origin, packing, insurance] = await Promise.all([getShippingMode(), getShipFrom(), getPacking(), getInsurance()]);
  const blockers = liveBlockers(origin);
  if (!isEasyshipConfigured("live")) blockers.push("The Easyship production token must be set on the server.");
  if (!isStoreOwner) blockers.push("Only the shop's owner can switch shipping On (you are signed in as a helper).");
  const checked = Boolean(origin?.checkedAt && origin.checkedHash === shipFromHash(origin));
  const live = accountOf(mode) === "live" && mode !== "off";

  const pieces = store
    ? await db<Array<{ id: string; title: string; weight_kg: string | null; height_cm: string | null; width_cm: string | null; depth_cm: string | null }>>`
        SELECT id, title, weight_kg, height_cm, width_cm, depth_cm FROM artwork
        WHERE store_id = ${store.id} AND status IN ('available', 'draft', 'reserved', 'sold')
        ORDER BY (status = 'available') DESC, updated_at DESC LIMIT 60
      `
    : [];
  const pieceOpts = pieces.map((p) => ({
    id: p.id,
    title: p.title,
    weightKg: p.weight_kg == null ? null : Number(p.weight_kg),
    size: [p.height_cm, p.width_cm, p.depth_cm].filter(Boolean).length ? `${[p.height_cm, p.width_cm, p.depth_cm].map((x) => (x == null ? "?" : Number(x))).join(" × ")} cm` : "no size",
  }));

  return (
    <>
      <PageHeader
        title="Shipping"
        description="Live carrier quotes for your buyers. When this is On, a buyer who has paid for a piece picks a carrier and pays you for shipping; you buy that label yourself and type in the tracking."
      />
      {!canAct ? <Notice>You can look, but only the shop&rsquo;s owner or someone on its team can change shipping.</Notice> : null}

      <section className="ktp-m-card">
        <h2>Shipping quotes are {MODE_TITLE[mode]}</h2>
        <p>{MODE_WORDS[mode]}</p>
        <ModeSwitch current={mode} liveBlocked={blockers.length > 0} liveWhy={blockers} labelBuying={labelBuyingEnabled()} />
        <details className="ktp-m-devnote">
          <summary>Label buying — not enabled</summary>
          <p className="ktp-m-fine">
            The first design had the collective buy each label on its own Easyship account (paid from that account&rsquo;s balance). It is parked: the
            code is kept but switched off, and only a developer can turn it on (server setting <code>SHIPPING_LABEL_BUYING=on</code>). Quotes use
            Easyship read-only: no shipment, no label, no money with Easyship.
          </p>
        </details>
      </section>

      <section className="ktp-m-card">
        <h2>1. Ship from</h2>
        {origin ? (
          <p className="ktp-m-fine">
            {checked ? "Checked: a quote from this address worked." : "Not checked yet: press Try it below once."}
          </p>
        ) : (
          <p className="ktp-m-fine">Where your parcels leave from: the quotes are worked out from here. Canada only for now.</p>
        )}
        <ShipFromForm
          saved={Boolean(origin)}
          canClear={!live}
          initial={{
            name: origin?.name ?? "",
            company: origin?.company ?? "",
            line1: origin?.line1 ?? "",
            line2: origin?.line2 ?? "",
            city: origin?.city ?? "",
            region: origin?.region ?? "",
            postalCode: origin?.postalCode ?? "",
            country: "CA",
            phone: origin?.phone ?? "",
            email: origin?.email ?? "",
          }}
        />
      </section>

      <section className="ktp-m-card">
        <h2>2. Packing</h2>
        <PackingForm initial={packing} />
      </section>

      <section className="ktp-m-card">
        <h2>3. Insurance</h2>
        <InsuranceForm initial={insurance} />
      </section>

      <section className="ktp-m-card">
        <h2>4. Weights</h2>
        <p>
          Each piece needs its <b>weight</b> (a kitchen scale is fine) and its size. Add them on each piece&rsquo;s page under <b>Pieces</b>. While shipping is Test or On, a piece can only go on sale with both.
        </p>
      </section>

      <section className="ktp-m-card">
        <h2>5. Try it</h2>
        <p>See what a buyer would be offered for one piece. Pieces without a weight can be tried with a weight typed here (it isn&rsquo;t saved).</p>
        <TryIt
          pieces={pieceOpts}
          account={live ? "real Easyship account (read-only quote)" : "Easyship sandbox"}
          disabledReason={!origin ? "Save the ship-from address first." : pieceOpts.length === 0 ? "Add a piece first." : null}
        />
      </section>

      <section className="ktp-m-card">
        <h2>How it works</h2>
        <ol className="ktp-m-steps">
          <li>A buyer buys the piece as now (card or eTransfer).</li>
          <li>Once it&rsquo;s paid, their order page shows <b>Choose shipping</b>: up to three carriers (cheapest, fastest, best value) and &ldquo;Show all carriers&rdquo;, priced live by Easyship.</li>
          <li>They pay for shipping on a second, small card page. The money is yours, like your sale money: straight to your Stripe account once you&rsquo;ve connected it under Payouts, otherwise the collective holds it for you and pays it out with your sales. No commission on shipping.</li>
          <li>You get an email, <b>Ship this order</b>, and the order under <b>Orders</b> shows the carrier and service they chose, the address and the parcel. Buy that label yourself (your own Easyship account, the carrier&rsquo;s website or the counter).</li>
          <li>Type the carrier and tracking number on the order and press <b>Mark shipped</b>. The buyer gets the tracking by email.</li>
        </ol>
        <p className="ktp-m-fine">
          <b>About the price:</b> the label you buy may cost a little more or less than the buyer&rsquo;s quote (carriers change prices, and your account may get other rates). Small differences are yours; buyers are not charged again.
        </p>
      </section>
    </>
  );
}
