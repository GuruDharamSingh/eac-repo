"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type { TourDeparture } from "@elkdonis/commerce/server";
import { bookTourAction } from "@/lib/tour-actions";
import { formatDeparture } from "@/lib/tour-format";
import { Button, Input, Label, Textarea } from "@elkdonis/primitives";
import { useTourPage } from "@/blocks/tour/context";

interface BookingFormProps {
  tourSlug: string;
  departures: TourDeparture[];
  priceLabel: string;
  pricePerPerson: number | null;
  currency: string;
  maxParty: number;
  /** Null when bookable; otherwise the sentence to show instead of the form. */
  unavailable: string | null;
  signedInEmail?: string | null;
  signedInName?: string | null;
  /** For the "ask us" mail when the tour cannot be booked; default: the tour page's title and contact address. */
  tourTitle?: string;
  contactEmail?: string | null;
  /** Departure to preselect (the phone page's index sets it); ignored when it has no seats left. */
  initialDepartureId?: string | null;
}

/**
 * What the booking box says when it cannot sell: one plain sentence and a
 * mail link with the subject filled in, so the visitor still has a next step.
 */
function AskInstead(p: { text: string; action: string; subject: string; body?: string; email: string | null }) {
  const href = p.email
    ? `mailto:${p.email}?subject=${encodeURIComponent(p.subject)}${p.body ? `&body=${encodeURIComponent(p.body)}` : ""}`
    : null;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">{p.text}</p>
      {href && (
        <>
          <p>
            <a href={href} className="font-medium text-foreground underline underline-offset-4">{p.action}</a>
          </p>
          <p className="break-all text-xs text-muted-foreground">or write to {p.email}</p>
        </>
      )}
    </div>
  );
}

export function BookingForm(p: BookingFormProps) {
  const page = useTourPage();
  const tourTitle = p.tourTitle ?? page?.tour.title ?? "a tour";
  const contactEmail = p.contactEmail ?? page?.contactEmail ?? null;
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(
    params.get("payment") === "cancelled" ? "Payment was cancelled. Your places were not taken." :
    params.get("payment") === "pending" ? "Your payment is being confirmed; the booking email will follow in a moment." : null
  );
  const open = p.departures.filter((d) => d.seatsLeft > 0);
  const [departureId, setDepartureId] = useState(open.find((d) => d.id === p.initialDepartureId)?.id ?? open[0]?.id ?? "");
  const [party, setParty] = useState(2);
  const [name, setName] = useState(p.signedInName ?? "");
  const [email, setEmail] = useState(p.signedInEmail ?? "");
  const [note, setNote] = useState("");

  const chosen = useMemo(() => p.departures.find((d) => d.id === departureId) ?? null, [p.departures, departureId]);
  const maxHere = Math.max(1, Math.min(p.maxParty, chosen?.seatsLeft ?? p.maxParty));
  const total = p.pricePerPerson != null ? p.pricePerPerson * party : null;

  const dateBody = "Preferred date(s):\nNumber of people:\n";
  if (!(p.pricePerPerson != null && p.pricePerPerson > 0)) {
    return <AskInstead email={contactEmail} text={p.unavailable ?? "This tour is not priced yet."} action="Email us for a price" subject={`Price: ${tourTitle}`} body={dateBody} />;
  }
  if (p.unavailable) {
    return <AskInstead email={contactEmail} text={p.unavailable} action="Ask about a date by email" subject={`Private date: ${tourTitle}`} body={dateBody} />;
  }
  if (open.length === 0) {
    return <AskInstead email={contactEmail} text="No dates are open for booking right now." action="Ask about a private date" subject={`Private date: ${tourTitle}`} body={dateBody} />;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await bookTourAction({ tourSlug: p.tourSlug, departureId, partySize: party, name, email, note });
      // On success the action redirects to Stripe and never resolves here.
      if (r && r.ok === false) setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="departure">Date</Label>
        <select
          id="departure"
          value={departureId}
          onChange={(e) => setDepartureId(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {p.departures.map((d) => (
            <option key={d.id} value={d.id} disabled={d.seatsLeft === 0}>
              {formatDeparture(d.startsAt)}
              {d.seatsLeft === 0 ? " · full" : d.seatsLeft <= 3 ? ` · ${d.seatsLeft} left` : ""}
              {d.guideName ? ` · with ${d.guideName}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <div>
          <Label htmlFor="party">People</Label>
          <Input
            id="party"
            type="number"
            min={1}
            max={maxHere}
            value={party}
            onChange={(e) => setParty(Math.max(1, Math.min(maxHere, Number(e.target.value) || 1)))}
            className="mt-1"
          />
        </div>
        <div className="self-end text-sm text-muted-foreground">
          {p.priceLabel} per person
          {total != null && (
            <span className="ml-2 font-medium text-foreground">
              · total {new Intl.NumberFormat("en-GB", { style: "currency", currency: p.currency }).format(total)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" autoComplete="email" />
        </div>
      </div>

      <div>
        <Label htmlFor="note">Anything your guide should know? <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" maxLength={1000} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending || !departureId} className="w-full sm:w-auto">
        {pending ? "Opening secure payment…" : "Book and pay"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Payment is taken by card on Stripe's secure page. You will get a confirmation email with your ticket link.
      </p>
    </form>
  );
}
