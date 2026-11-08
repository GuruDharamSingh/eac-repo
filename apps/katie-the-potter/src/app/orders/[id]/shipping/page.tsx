import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Currency } from "@elkdonis/commerce/types";

const fm = (minor: number, currency: string) => formatMoney(minor, currency as Currency);
import { loadOrderForViewer } from "@/lib/shop";
import { formatAddress } from "@/lib/address";
import { shippingAccessFor } from "@/lib/shipping/access";
import { advance, currentShipment, isQuoteFlow, LABEL_STATES, ratesForOrder, type ShipmentRow } from "@/lib/shipping/shipments";
import { daysLabel } from "@/lib/shipping/rates";
import { getInsurance, insuranceView } from "@/lib/shipping/settings";
import {
  chooseShippingAction,
  continueShippingPaymentAction,
  correctAddressAction,
  rechooseShippingAction,
  refreshShippingRatesAction,
} from "@/lib/shipping/actions";
import { ShippingPicker } from "@/components/shipping-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose shipping", robots: { index: false, follow: false } };

const TRACK_WORDS: Record<string, string> = {
  label_pending: "Label being made",
  label_bought: "Label bought, waiting for the carrier's first scan",
  in_transit: "On its way",
  delivered: "Delivered",
};

export default async function ShippingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; changed?: string; option?: string; fixed?: string; cancelled?: string; paid?: string; test?: string; edit?: string; tw?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Same access rule as the order page; "not yours" and "not found" are both 404.
  const order = await loadOrderForViewer(id);
  if (!order) notFound();
  const access = await shippingAccessFor(order);
  if (!access) redirect(`/orders/${order.id}`);

  let row: ShipmentRow | null = await currentShipment(order.id, access.mode);
  // Whatever is owed right now: a payment to read back, a label to buy.
  if (row) row = await advance(row);

  const ship = formatAddress(order.shippingAddress);
  const quoteFlow = access.flow === "quote";
  const testBanner =
    access.mode === "test" ? (
      <p className="ktp-shop-note" data-tone="sample">
        <b>Test mode.</b> Only editors see this page.{" "}
        {quoteFlow ? "Quotes come from Easyship's sandbox (sample prices); nothing is paid." : "Rates and labels come from Easyship's sandbox; nothing is paid or shipped."}
        {access.rehearsal ? " This order isn't paid: when shipping is on, buyers only see this after paying." : null}
      </p>
    ) : null;

  const head = (
    <>
      <p className="ktp-shop-kicker">Order {order.number}</p>
      <h1 className="ktp-shop-title">Shipping</h1>
      {testBanner}
    </>
  );

  // ── a label exists: tracking ──
  if (row && (LABEL_STATES as string[]).includes(row.status)) {
    return (
      <div className="ktp-shop">
        {head}
        <section className="ktp-shop-card">
          <h2>{TRACK_WORDS[row.status] ?? "On its way"}</h2>
          <dl className="ktp-shop-facts">
            <div>
              <dt>Carrier</dt>
              <dd>{row.courierName ?? row.chosenRate?.service}</dd>
            </div>
            {row.trackingNumber ? (
              <div>
                <dt>Tracking</dt>
                <dd className="ktp-shop-mono">{row.trackingNumber}</dd>
              </div>
            ) : null}
            {row.trackingStatus ? (
              <div>
                <dt>Latest</dt>
                <dd>{row.trackingStatus}</dd>
              </div>
            ) : null}
            {row.paidMinor && row.currency ? (
              <div>
                <dt>Shipping paid</dt>
                <dd>{fm(row.paidMinor, row.currency)}{row.insured ? " (insured)" : ""}</dd>
              </div>
            ) : null}
          </dl>
          {row.trackingUrl ? (
            <p className="ktp-shop-actions">
              <a className="ktp-btn" href={row.trackingUrl} target="_blank" rel="noopener noreferrer">
                Track your parcel
              </a>
            </p>
          ) : null}
          <p>
            {isQuoteFlow(row)
              ? "Katie has sent your piece. The carrier's tracking page fills in once they scan it."
              : "Katie packs your piece and drops it off with the carrier. The tracking page fills in once the carrier scans it."}
          </p>
          {ship ? (
            <p className="ktp-shop-ship">
              <span>Ship to</span> {ship}
            </p>
          ) : null}
        </section>
        <Back id={order.id} />
      </div>
    );
  }

  // ── quote-only: paid, Katie buys the label and sends the tracking ──
  if (row && row.status === "paid" && isQuoteFlow(row) && row.chosenRate) {
    return (
      <div className="ktp-shop">
        {head}
        <section className="ktp-shop-card">
          <h2>Shipping paid</h2>
          <p className="ktp-shop-paidship">
            <b>{row.chosenRate.service}</b>, est. {daysLabel(row.chosenRate)}
            {row.paidMinor && row.currency ? <>, {fm(row.paidMinor, row.currency)}</> : null}
            {row.insured ? " (insured)" : ""}. Katie will send you the tracking.
          </p>
          {sp.paid ? <p className="ktp-shop-fine">Thank you. Your card receipt for shipping comes from Stripe.</p> : null}
          <p>Katie packs your piece, buys the label with {row.chosenRate.courier} and drops it off. You get the tracking number by email as soon as she has it.</p>
          {ship ? (
            <p className="ktp-shop-ship">
              <span>Ship to</span> {ship}
            </p>
          ) : null}
        </section>
        <Back id={order.id} />
      </div>
    );
  }

  // ── payment cleared, label being bought ──
  if (row && (row.status === "paid" || row.status === "buying")) {
    return (
      <div className="ktp-shop">
        {head}
        <section className="ktp-shop-card">
          <h2>Your shipping payment is in</h2>
          <p>We&rsquo;re buying the label now. This page shows the tracking number in a moment.</p>
          <p className="ktp-shop-actions">
            <Link className="ktp-btn" href={`/orders/${order.id}/shipping`}>
              Refresh
            </Link>
          </p>
        </section>
        <Back id={order.id} />
      </div>
    );
  }

  // ── label could not be bought ──
  if (row && (row.status === "failed" || row.status === "refunded") && !sp.fixed) {
    return (
      <div className="ktp-shop">
        {head}
        <section className="ktp-shop-card">
          <h2>Katie will arrange shipping</h2>
          <p>
            The carrier didn&rsquo;t accept the label this time.
            {row.status === "refunded" && row.paidMinor && row.currency ? <> Your shipping payment of <b>{fm(row.paidMinor, row.currency)}</b> has been refunded in full.</> : null}{" "}
            Katie has been told and will write to you{order.customerEmail ? <> at <b>{order.customerEmail}</b></> : null}.
          </p>
        </section>
        <Back id={order.id} />
      </div>
    );
  }

  // ── a Stripe page was opened and left ──
  if (row && row.status === "awaiting_payment" && row.chosenRate) {
    return (
      <div className="ktp-shop">
        {head}
        <section className="ktp-shop-card">
          <h2>Finish paying for shipping</h2>
          {sp.cancelled ? <p className="ktp-shop-note">You left the payment page before paying. Nothing was charged.</p> : null}
          <p>
            You chose <b>{row.chosenRate.service}</b>, {daysLabel(row.chosenRate)}
            {row.amountMinor && row.currency ? <>, {fm(row.amountMinor, row.currency)}</> : null}
            {row.insured ? " (insured)" : ""}.
          </p>
          <div className="ktp-shop-actions">
            <form action={continueShippingPaymentAction.bind(null, order.id)}>
              <button type="submit" className="ktp-btn">
                Continue to payment
              </button>
            </form>
            <form action={rechooseShippingAction.bind(null, order.id)}>
              <button type="submit" className="ktp-btn ktp-btn--ghost">
                Choose a different option
              </button>
            </form>
          </div>
        </section>
        <Back id={order.id} />
      </div>
    );
  }

  // ── choosing ──
  const testWeight = access.mode === "test" && sp.tw ? Number(sp.tw) : null;
  const rates = await ratesForOrder(order, access.mode, { testWeightKg: Number.isFinite(testWeight) ? testWeight : null });
  const changed = sp.changed?.match(/^(\d+)-(\d+)-([A-Z]{3})$/);
  const editing = sp.edit === "1" || (rates.ok === false && rates.kind === "address");
  const a = order.shippingAddress;
  const declared = rates.ok ? rates.row.parcels.reduce((t, p) => t + p.declared, 0) : 0;
  const bad = rates.ok === false ? rates : null;
  // Quote-only: insurance is Katie's call (folded in, a checkbox, or none).
  const insurance = quoteFlow ? insuranceView(await getInsurance()) : "choice";

  return (
    <div className="ktp-shop">
      {head}
      {sp.msg ? (
        <p className="ktp-shop-note" role="alert">
          {sp.msg}
        </p>
      ) : null}
      {changed ? (
        <p className="ktp-shop-note" role="alert">
          The price for that option changed from {fm(Number(changed[1]), changed[3]!)} to <b>{fm(Number(changed[2]), changed[3]!)}</b>. Nothing was charged. Check the new price below and choose again to confirm.
        </p>
      ) : null}
      {sp.fixed ? <p className="ktp-shop-note">Address updated. Here are the carriers for it.</p> : null}

      <section className="ktp-shop-card">
        <h2>Choose how it travels</h2>
        {ship ? (
          <p className="ktp-shop-ship">
            <span>Ship to</span> {ship}{" "}
            {!editing ? (
              <Link className="ktp-linkbtn" href={`/orders/${order.id}/shipping?edit=1`}>
                Edit address
              </Link>
            ) : null}
          </p>
        ) : null}

        {rates.ok ? (
          <ShippingPicker
            action={chooseShippingAction.bind(null, order.id)}
            featured={rates.row.rates?.featured ?? []}
            rest={rates.row.rates?.rest ?? []}
            mode={access.mode}
            flow={access.flow}
            insurance={insurance}
            initialOption={sp.option ?? null}
            insuredValue={fm(Math.round(declared * 100), order.currency)}
          />
        ) : bad && (bad.kind === "parcel" || bad.kind === "setup" || bad.kind === "service") ? (
          <>
            <p>
              {bad.kind === "service"
                ? "The shipping service didn't answer just now."
                : "This order can't be quoted automatically."}{" "}
              Katie will be in touch to arrange shipping{order.customerEmail ? <> at <b>{order.customerEmail}</b></> : null}.
            </p>
            {access.isEditor && bad.problems?.length ? (
              <ul className="ktp-shop-fine">
                {bad.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            {access.mode === "test" && bad.kind === "parcel" && bad.problems?.some((x) => /no weight/.test(x)) ? (
              <form method="get" className="ktp-shop-note" data-tone="sample">
                <label>
                  <b>Test mode:</b> try with a weight of{" "}
                  <input className="ktp-input" name="tw" inputMode="decimal" defaultValue="0.5" size={4} aria-label="Test weight in kg" /> kg for pieces without one (not saved on the piece).
                </label>{" "}
                <button type="submit" className="ktp-btn ktp-btn--ghost ktp-btn--sm">
                  Get test rates
                </button>
              </form>
            ) : null}
            {access.isEditor && bad.kind === "setup" ? <p className="ktp-shop-fine">For editors: {bad.message} See Manage, Shipping.</p> : null}
            {bad.kind === "service" ? (
              <form action={refreshShippingRatesAction.bind(null, order.id)}>
                <button type="submit" className="ktp-btn ktp-btn--ghost">
                  Try again
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <div className="ktp-shop-note" role="alert">
            <p>
              <b>{bad.message}</b> Please check the address below.
            </p>
            {bad.details.length ? (
              <ul>
                {bad.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      {editing ? (
        <section className="ktp-shop-card">
          <h2>Shipping address</h2>
          <form action={correctAddressAction.bind(null, order.id)} className="ktp-ship-addr">
            <label>
              <span>Name</span>
              <input className="ktp-input" name="recipientName" defaultValue={a?.recipientName ?? order.customerName ?? ""} maxLength={200} autoComplete="name" />
            </label>
            <label>
              <span>Street</span>
              <input className="ktp-input" name="line1" defaultValue={a?.line1 ?? ""} required maxLength={200} autoComplete="address-line1" />
            </label>
            <label>
              <span>Apartment, suite (optional)</span>
              <input className="ktp-input" name="line2" defaultValue={a?.line2 ?? ""} maxLength={200} autoComplete="address-line2" />
            </label>
            <label>
              <span>City</span>
              <input className="ktp-input" name="city" defaultValue={a?.city ?? ""} required maxLength={100} autoComplete="address-level2" />
            </label>
            <label>
              <span>Province / state</span>
              <input className="ktp-input" name="region" defaultValue={a?.region ?? ""} maxLength={60} autoComplete="address-level1" />
            </label>
            <label>
              <span>Postal / ZIP code</span>
              <input className="ktp-input" name="postalCode" defaultValue={a?.postalCode ?? ""} required maxLength={20} autoComplete="postal-code" />
            </label>
            <label>
              <span>Country</span>
              <select className="ktp-input" name="country" defaultValue={a?.country ?? "CA"} autoComplete="country">
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </label>
            <label>
              <span>Phone (for the carrier)</span>
              <input className="ktp-input" name="phone" defaultValue={a?.phone ?? ""} maxLength={40} autoComplete="tel" />
            </label>
            <div className="ktp-shop-actions">
              <button type="submit" className="ktp-btn">
                Save address and get carriers
              </button>
              <Link className="ktp-btn ktp-btn--ghost" href={`/orders/${order.id}/shipping`}>
                Cancel
              </Link>
            </div>
          </form>
        </section>
      ) : null}

      <p className="ktp-shop-fine">
        {quoteFlow
          ? "Prices are live carrier quotes from Easyship. You pay for shipping on a secure card page (Stripe), separate from your piece; it goes to Katie, who buys the label and emails you the tracking. Prefer not to? Katie can arrange shipping by email instead."
          : "You pay for the label on a secure card page (Stripe), separate from your piece. The label is bought only after that payment goes through. Prefer not to? Katie can arrange shipping by email instead."}
      </p>
      <Back id={order.id} />
    </div>
  );
}

function Back({ id }: { id: string }) {
  return (
    <p className="ktp-shop-actions">
      <Link className="ktp-btn ktp-btn--ghost" href={`/orders/${id}`}>
        Back to your order
      </Link>
    </p>
  );
}
