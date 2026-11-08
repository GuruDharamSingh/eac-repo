"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@elkdonis/cms-ui/manage/client";
import {
  clearShipFromAction,
  saveInsuranceAction,
  saveShipFromAction,
  savePackingAction,
  setShippingModeAction,
  tryRatesAction,
  type TryResult,
} from "@/lib/shipping/actions";
import type { ShippingOption } from "@/lib/shipping/rates";

/** off | quote_test ("Test") | quote ("On"); test/live = the parked label buying (developer flag only). */
type Mode = "off" | "quote_test" | "quote" | "test" | "live";

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(minor / 100);
const days = (o: ShippingOption) =>
  o.minDays == null && o.maxDays == null
    ? "time not given"
    : o.minDays != null && o.maxDays != null && o.minDays !== o.maxDays
      ? `${o.minDays}–${o.maxDays} days`
      : `${o.maxDays ?? o.minDays} ${(o.maxDays ?? o.minDays) === 1 ? "day" : "days"}`;

// ── mode ────────────────────────────────────────────────────────────────────

export function ModeSwitch({ current, liveBlocked, liveWhy, labelBuying = false }: { current: Mode; liveBlocked: boolean; liveWhy: string[]; labelBuying?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = (m: Mode) =>
    start(async () => {
      if (m === "quote" && !window.confirm("Switch shipping quotes On? Buyers of paid orders will see Choose shipping and pay you for it; you then buy the label.")) return;
      if (m === "live" && !window.confirm("Developer: switch LABEL BUYING to Live? The collective's Easyship account pays for real labels.")) return;
      const r = await setShippingModeAction(m).catch(() => null);
      toast(r);
      if (r?.ok) router.refresh();
    });
  const opts: Array<[Mode, string]> = [
    ["off", "Off"],
    ["quote_test", "Test"],
    ["quote", "On"],
  ];
  // Developer flag only (SHIPPING_LABEL_BUYING=on): the parked label-buying modes.
  if (labelBuying) opts.push(["test", "Labels: test (dev)"], ["live", "Labels: live (dev)"]);
  const needsGate = (m: Mode) => m === "quote" || m === "live";
  return (
    <div className="ktp-m-shipmode">
      <div className="ktp-m-seg" role="group" aria-label="Shipping quotes">
        {opts.map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={current === m}
            disabled={pending || (needsGate(m) && liveBlocked && current !== m)}
            aria-describedby={needsGate(m) && liveBlocked ? "ship-live-why" : undefined}
            onClick={() => current !== m && set(m)}
          >
            {label}
          </button>
        ))}
      </div>
      {liveBlocked && current !== "quote" ? (
        <p id="ship-live-why" className="ktp-m-fine">
          Before On: {liveWhy.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

// ── insurance ───────────────────────────────────────────────────────────────

export function InsuranceForm({ initial }: { initial: { insure: boolean; buyerChooses: boolean } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const [v, setV] = useState(initial);
  return (
    <form
      className="ktp-m-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveInsuranceAction(v).catch(() => null);
          toast(r);
          if (r?.ok) router.refresh();
        });
      }}
    >
      <label className="ktp-m-check">
        <input type="checkbox" checked={v.insure} onChange={(e) => setV({ insure: e.target.checked, buyerChooses: e.target.checked && v.buyerChooses })} disabled={pending} />
        <span>
          <b>I&rsquo;ll insure parcels</b> for the piece&rsquo;s price. The insurance is folded into the quoted shipping price, and you add it when you buy the label.
        </span>
      </label>
      <label className="ktp-m-check">
        <input type="checkbox" checked={v.buyerChooses} onChange={(e) => setV({ ...v, buyerChooses: e.target.checked })} disabled={pending || !v.insure} />
        <span>Let buyers choose whether to insure (a tick box, ticked to start).</span>
      </label>
      <div className="ktp-m-actions">
        <button type="submit" className="ktp-btn ktp-btn--ghost" disabled={pending}>
          {pending ? "Saving…" : "Save insurance"}
        </button>
      </div>
    </form>
  );
}

// ── ship-from ───────────────────────────────────────────────────────────────

export interface ShipFromValues {
  name: string;
  company: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
}

export function ShipFromForm({ initial, saved, canClear }: { initial: ShipFromValues; saved: boolean; canClear: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const f = (k: keyof ShipFromValues) => ({
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value })),
    disabled: pending,
  });
  return (
    <form
      className="ktp-m-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveShipFromAction({ ...v }).catch(() => null);
          toast(r);
          if (r?.ok) router.refresh();
        });
      }}
    >
      <div className="ktp-m-grid">
        <label className="ktp-m-field">
          <span>Name on the label *</span>
          <input className="ktp-input" autoComplete="name" maxLength={22} {...f("name")} placeholder="Katie …" />
        </label>
        <label className="ktp-m-field">
          <span>Studio name</span>
          <input className="ktp-input" autoComplete="organization" maxLength={120} {...f("company")} placeholder="Katie the Potter" />
        </label>
        <label className="ktp-m-field ktp-m-span2">
          <span>Street *</span>
          <input className="ktp-input" autoComplete="address-line1" maxLength={200} {...f("line1")} />
        </label>
        <label className="ktp-m-field ktp-m-span2">
          <span>Unit, suite (optional)</span>
          <input className="ktp-input" autoComplete="address-line2" maxLength={200} {...f("line2")} />
        </label>
        <label className="ktp-m-field">
          <span>City *</span>
          <input className="ktp-input" autoComplete="address-level2" maxLength={100} {...f("city")} />
        </label>
        <label className="ktp-m-field">
          <span>Province *</span>
          <input className="ktp-input" autoComplete="address-level1" maxLength={60} {...f("region")} placeholder="ON" />
        </label>
        <label className="ktp-m-field">
          <span>Postal code *</span>
          <input className="ktp-input" autoComplete="postal-code" maxLength={8} {...f("postalCode")} placeholder="M5V 2T6" />
        </label>
        <label className="ktp-m-field">
          <span>Country</span>
          <input className="ktp-input" value="Canada" disabled readOnly />
        </label>
        <label className="ktp-m-field">
          <span>Phone *</span>
          <input className="ktp-input" type="tel" autoComplete="tel" maxLength={40} {...f("phone")} placeholder="416 555 0100" />
        </label>
        <label className="ktp-m-field">
          <span>Email for carrier notices *</span>
          <input className="ktp-input" type="email" autoComplete="email" maxLength={200} {...f("email")} />
        </label>
      </div>
      <p className="ktp-m-fine">The quotes are worked out from this address; use the same one as the sender when you buy the label. Buyers never see it on the site.</p>
      <div className="ktp-m-actions">
        <button type="submit" className="ktp-btn" disabled={pending}>
          {pending ? "Saving…" : saved ? "Save changes" : "Save ship-from address"}
        </button>
        {saved && canClear ? (
          <button
            type="button"
            className="ktp-btn ktp-btn--ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!window.confirm("Clear the ship-from address?")) return;
                const r = await clearShipFromAction().catch(() => null);
                toast(r);
                if (r?.ok) {
                  setV({ name: "", company: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "CA", phone: "", email: "" });
                  router.refresh();
                }
              })
            }
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}

// ── packing ─────────────────────────────────────────────────────────────────

export function PackingForm({ initial }: { initial: { paddingCm: number; boxKg: number; extraPct: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toast = useToast();
  const [p, setP] = useState({ paddingCm: String(initial.paddingCm), boxKg: String(initial.boxKg), extraPct: String(initial.extraPct) });
  return (
    <form
      className="ktp-m-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await savePackingAction({ paddingCm: p.paddingCm, boxKg: p.boxKg, extraPct: p.extraPct }).catch(() => null);
          toast(r);
          if (r?.ok) router.refresh();
        });
      }}
    >
      <div className="ktp-m-grid ktp-m-grid--4">
        <label className="ktp-m-field">
          <span>Padding each side (cm)</span>
          <input className="ktp-input" inputMode="decimal" value={p.paddingCm} onChange={(e) => setP({ ...p, paddingCm: e.target.value })} disabled={pending} />
        </label>
        <label className="ktp-m-field">
          <span>Box and padding (kg)</span>
          <input className="ktp-input" inputMode="decimal" value={p.boxKg} onChange={(e) => setP({ ...p, boxKg: e.target.value })} disabled={pending} />
        </label>
        <label className="ktp-m-field">
          <span>Extra, % of the piece</span>
          <input className="ktp-input" inputMode="decimal" value={p.extraPct} onChange={(e) => setP({ ...p, extraPct: e.target.value })} disabled={pending} />
        </label>
      </div>
      <p className="ktp-m-fine">
        The box is the piece plus the padding on every side; its weight is the piece, plus the box, plus the extra. The buyer&rsquo;s shipping price includes the box this way, so there is no separate handling fee.
      </p>
      <div className="ktp-m-actions">
        <button type="submit" className="ktp-btn ktp-btn--ghost" disabled={pending}>
          {pending ? "Saving…" : "Save packing"}
        </button>
      </div>
    </form>
  );
}

// ── try it ──────────────────────────────────────────────────────────────────

const EXAMPLES = {
  CA: { recipientName: "Test buyer", line1: "175 Rue Sainte-Catherine O", line2: "", city: "Montréal", region: "QC", postalCode: "H2X 1Y4", country: "CA", phone: "514 555 0100" },
  US: { recipientName: "Test buyer", line1: "350 5th Ave", line2: "", city: "New York", region: "NY", postalCode: "10118", country: "US", phone: "212 555 0100" },
};

export function TryIt({ pieces, account, disabledReason }: { pieces: Array<{ id: string; title: string; weightKg: number | null; size: string }>; account: string; disabledReason: string | null }) {
  const [pending, start] = useTransition();
  const [piece, setPiece] = useState(pieces[0]?.id ?? "");
  const [weight, setWeight] = useState("");
  const [dest, setDest] = useState<keyof typeof EXAMPLES>("CA");
  const [addr, setAddr] = useState(EXAMPLES.CA);
  const [result, setResult] = useState<TryResult | null>(null);
  const chosen = pieces.find((p) => p.id === piece);
  const router = useRouter();

  const run = () =>
    start(async () => {
      setResult(null);
      const r = await tryRatesAction({ artworkId: piece, weightKg: weight.trim() ? Number(weight) : null, destination: { ...addr, line2: addr.line2 || null } }).catch(() => ({ ok: false as const, message: "Something went wrong. Please try again." }));
      setResult(r);
      router.refresh();
    });

  const opt = (o: ShippingOption) => (
    <li key={o.courierServiceId} className="ktp-m-tryrate">
      <span>
        <b>{o.service}</b> · {days(o)}
        {o.tags.length ? <> · {o.tags.join(", ")}</> : null}
      </span>
      <span>
        {money(o.insuredMinor, o.currency)} <span className="ktp-m-fine">({money(o.uninsuredMinor, o.currency)} uninsured)</span>
      </span>
    </li>
  );

  return (
    <div className="ktp-m-form">
      {disabledReason ? <p className="ktp-m-fine">{disabledReason}</p> : null}
      <div className="ktp-m-grid">
        <label className="ktp-m-field">
          <span>Piece</span>
          <select className="ktp-input" value={piece} onChange={(e) => setPiece(e.target.value)} disabled={pending || Boolean(disabledReason)}>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.size}{p.weightKg ? `, ${p.weightKg} kg` : ", no weight yet"})
              </option>
            ))}
          </select>
        </label>
        <label className="ktp-m-field">
          <span>Weight for this test (kg)</span>
          <input
            className="ktp-input"
            inputMode="decimal"
            value={chosen?.weightKg ? String(chosen.weightKg) : weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={chosen?.weightKg ? undefined : "e.g. 0.6"}
            disabled={pending || Boolean(chosen?.weightKg) || Boolean(disabledReason)}
          />
        </label>
        <div className="ktp-m-field ktp-m-span2">
          <span>Ship to</span>
          <div className="ktp-m-seg" role="group" aria-label="Example address">
            {(["CA", "US"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={dest === k}
                disabled={pending}
                onClick={() => {
                  setDest(k);
                  setAddr(EXAMPLES[k]);
                }}
              >
                {k === "CA" ? "Montréal (Canada)" : "New York (US)"}
              </button>
            ))}
          </div>
        </div>
        <label className="ktp-m-field ktp-m-span2">
          <span>Street</span>
          <input className="ktp-input" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} disabled={pending} />
        </label>
        <label className="ktp-m-field">
          <span>City</span>
          <input className="ktp-input" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} disabled={pending} />
        </label>
        <label className="ktp-m-field">
          <span>Province / state, postal code</span>
          <span className="ktp-m-pair">
            <input className="ktp-input" aria-label="Province or state" value={addr.region} onChange={(e) => setAddr({ ...addr, region: e.target.value })} disabled={pending} />
            <input className="ktp-input" aria-label="Postal code" value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} disabled={pending} />
          </span>
        </label>
      </div>
      <div className="ktp-m-actions">
        <button type="button" className="ktp-btn" onClick={run} disabled={pending || !piece || Boolean(disabledReason)}>
          {pending ? "Asking the carriers…" : "Try it"}
        </button>
        <span className="ktp-m-fine">Quotes only, from the {account}. Nothing is bought or booked.</span>
      </div>
      <div aria-live="polite">
        {result && result.ok ? (
          <div className="ktp-m-card ktp-m-tryout">
            <p className="ktp-m-fine">
              Packed: {result.parcel} · {result.account === "sandbox" ? "Easyship sandbox (sample prices)" : "Easyship, real prices"}
            </p>
            <p>
              <b>What the buyer is offered</b>
            </p>
            <ul className="ktp-m-tryrates">{result.featured.map(opt)}</ul>
            {result.rest.length ? (
              <details>
                <summary>Show all carriers ({result.rest.length} more)</summary>
                <ul className="ktp-m-tryrates">{result.rest.map(opt)}</ul>
              </details>
            ) : null}
          </div>
        ) : result && result.ok === false ? (
          <p className="mg-notice" data-tone="warn" role="alert">
            {result.message}
            {result.details?.length ? <> ({result.details.join("; ")})</> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
