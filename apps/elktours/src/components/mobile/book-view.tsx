"use client";

import { useState, useTransition } from "react";
import "@/blocks/mobile/flow.css";
import { BackButton, Chip, PrimaryButton } from "@/components/mobile";
import { payForSlotAction } from "@/lib/book-actions";

// Screen 05, Booking & payment (G3b). Summary card, method chips (a summary only: payment happens on Stripe's
// secure page), price lines, the cancellation policy and the rule, the guest fields bookTourAction needs, and the
// pay button. Errors from the quote or the booking show inline.

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);

export interface BookViewProps {
  slug: string;
  title: string;
  slotId: string;
  party: number;
  whenLabel: string;
  guide: string | null;
  meetAt: string | null;
  perPersonMinor: number;
  totalMinor: number;
  currency: string;
  policyText: string;
  ruleText: string;
  defaultName: string;
  defaultEmail: string;
}

export function BookView(p: BookViewProps) {
  const [name, setName] = useState(p.defaultName);
  const [email, setEmail] = useState(p.defaultEmail);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = money(p.totalMinor, p.currency);

  function pay() {
    setError(null);
    start(async () => {
      // Redirects to Stripe on success (and never returns); only a refusal comes back.
      const r = await payForSlotAction({ tourSlug: p.slug, slotId: p.slotId, partySize: p.party, name, email, note });
      if (r && r.ok === false) setError(r.error);
    });
  }

  return (
    <div className="elk-m m-flow">
      <div className="m-flow-top">
        <BackButton href={`/tours/${p.slug}/dates`} />
        <div className="m-flow-top-text">
          <span className="m-kicker">Booking</span>
          <span className="m-flow-top-title">{p.title}</span>
        </div>
      </div>

      <div className="m-flow-card">
        <span className="m-kicker m-sum-kicker">Your booking</span>
        <h1 className="m-sum-title">{p.title}</h1>
        <div className="m-sum-when">
          {p.whenLabel}
          <br />
          {p.party} {p.party === 1 ? "person" : "people"}
          {p.guide ? ` · with ${p.guide}` : ""}
          {p.meetAt ? <><br />Meet at {p.meetAt}</> : null}
        </div>
      </div>

      <div className="m-flow-card">
        <span className="m-kicker">Pay by</span>
        <div className="m-pay-methods">
          <Chip selected>Card</Chip>
          <Chip>Apple Pay</Chip>
        </div>
        <p className="m-flow-note">You pay on Stripe&apos;s secure page, after this step.</p>
        <div className="m-pay-line"><span>{money(p.perPersonMinor, p.currency)} × {p.party}</span><span>{total}</span></div>
        <div className="m-pay-line is-total"><span>Total</span><span>{total}</span></div>
      </div>

      <div className="m-fields">
        <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" aria-label="Your name" />
        <input className="m-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for your confirmation" autoComplete="email" aria-label="Email" />
        <textarea className="m-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for the guide (optional)" aria-label="Note for the guide" />
      </div>

      <p className="m-flow-note">{p.policyText}</p>
      {p.ruleText && <p className="m-flow-note">{p.ruleText}</p>}
      {error && <p className="m-flow-error" role="alert">{error}</p>}

      <div className="m-flow-bar">
        <PrimaryButton disabled={pending || !name.trim() || !email.trim()} onClick={pay}>
          {pending ? "One moment…" : `Book and pay ${total}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
