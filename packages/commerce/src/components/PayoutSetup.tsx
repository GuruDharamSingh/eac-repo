"use client";

import * as React from "react";
import { payoutRailsFor, normaliseCountry, type PayoutRail } from "../payout-rails";
import { cn } from "./cn";

/**
 * How this person wants to be paid — asked in the order that makes the
 * question answerable.
 *
 * Country first, deliberately. Interac e-Transfer reaches Canadian banks and
 * nowhere else, so "what's your payout email?" is a real question in Canada
 * and a misleading one everywhere else: an artist in Chicago can fill it in,
 * believe they are set up, and never be payable. Asking where they are first
 * means we only ever offer a rail that can actually reach them.
 *
 * Headless: the caller supplies `onSave`, so the same control works in the
 * art-auction studio, an org hub, or a profile surface.
 */

export interface PayoutSetupValue {
  country: string | null;
  rail: PayoutRail | null;
  payoutEmail: string | null;
}

export interface PayoutSetupProps {
  initial?: Partial<PayoutSetupValue>;
  /** Whether Stripe onboarding has already been completed. */
  stripeOnboarded?: boolean;
  /** Fires for the e-Transfer/manual rails. Stripe uses `onConnectStripe`. */
  onSave: (value: { country: string; rail: PayoutRail; payoutEmail: string | null }) => Promise<void>;
  /** Fires when they pick Stripe — the caller starts Express onboarding. */
  onConnectStripe?: () => Promise<void> | void;
  /** Card payments off at the platform level: don't offer what can't run. */
  stripeAvailable?: boolean;
  className?: string;
}

// Kept short on purpose: the countries this platform can actually pay, plus
// an "elsewhere" escape that routes to a conversation rather than a dead form.
const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "ZZ", name: "Somewhere else" },
];

export function PayoutSetup({
  initial,
  stripeOnboarded = false,
  onSave,
  onConnectStripe,
  stripeAvailable = true,
  className,
}: PayoutSetupProps) {
  const [country, setCountry] = React.useState<string>(
    normaliseCountry(initial?.country) ?? ""
  );
  const [rail, setRail] = React.useState<PayoutRail | null>(initial?.rail ?? null);
  const [email, setEmail] = React.useState(initial?.payoutEmail ?? "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const rails = React.useMemo(
    () => (country ? payoutRailsFor(country === "ZZ" ? "ZZ" : country) : []),
    [country]
  );
  const offered = rails.filter((r) => r.rail !== "stripe" || stripeAvailable);
  const chosen = rail && offered.some((o) => o.rail === rail) ? rail : offered[0]?.rail ?? null;

  async function save() {
    if (!country || !chosen) return;
    setMsg(null);
    if (chosen === "etransfer" && !email.trim()) {
      setMsg("We need the email to send the e-Transfer to.");
      return;
    }
    setBusy(true);
    try {
      // Always save first, Stripe included: `onConnectStripe` creates the
      // Express account from whatever country is already on file, and a
      // country only ever held in this component's own state is a country
      // Stripe onboarding never sees (2026-09-20 — every account was
      // created under the platform's default regardless of what was picked
      // here, because this branch used to skip straight to onConnectStripe).
      await onSave({
        country: country === "ZZ" ? "" : country,
        rail: chosen,
        payoutEmail: chosen === "etransfer" ? email.trim() : null,
      });
      if (chosen === "stripe") {
        await onConnectStripe?.();
      } else {
        setMsg("Saved.");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("eac-commerce eac-payout", className)}>
      <label className="eac-payout-field">
        <span className="eac-payout-label">Where are you?</span>
        <select
          className="eac-payout-input"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setRail(null);
            setMsg(null);
          }}
        >
          <option value="">Choose…</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="eac-payout-help">
          This decides how we can get money to you — it isn&rsquo;t shown on your profile.
        </span>
      </label>

      {offered.length > 0 && (
        <fieldset className="eac-payout-rails">
          <legend className="eac-payout-label">How should we pay you?</legend>
          {offered.map((o) => (
            <label
              key={o.rail}
              className={cn("eac-payout-rail", chosen === o.rail && "eac-payout-rail--on")}
            >
              <input
                type="radio"
                name="payout-rail"
                value={o.rail}
                checked={chosen === o.rail}
                onChange={() => setRail(o.rail)}
              />
              <span>
                <strong className="eac-payout-rail-name">
                  {o.label}
                  {o.rail === "stripe" && stripeOnboarded ? " — connected" : ""}
                </strong>
                <span className="eac-payout-rail-detail">{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {chosen === "etransfer" && (
        <label className="eac-payout-field">
          <span className="eac-payout-label">Email to pay</span>
          <input
            className="eac-payout-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
      )}

      {chosen && (
        <div className="eac-payout-actions">
          <button type="button" className="eac-pc-btn" onClick={save} disabled={busy || !country}>
            {busy
              ? "Working…"
              : chosen === "stripe"
                ? stripeOnboarded
                  ? "Review your Stripe details"
                  : "Connect Stripe"
                : "Save"}
          </button>
          {msg && <span className="eac-payout-msg">{msg}</span>}
        </div>
      )}
    </div>
  );
}
