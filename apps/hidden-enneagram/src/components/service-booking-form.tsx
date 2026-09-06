"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBookingAction } from "@/app/services/[slug]/book/actions";

export function ServiceBookingForm({
  slug,
  defaultName,
  defaultEmail,
  listPrice,
  slidingFloor,
  currency,
}: {
  slug: string;
  defaultName?: string;
  defaultEmail?: string;
  /** Major units. */
  listPrice: number;
  /** Major units, or null when this service has no sliding scale. */
  slidingFloor: number | null;
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState(slidingFloor != null ? String(listPrice) : "");

  const fmt = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createBookingAction(slug, { name, email, notes, amount });
      if (!res.ok) {
        toast.error(res.error ?? "Could not create this booking.");
        return;
      }
      router.push(`/services/orders/${res.orderId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {slidingFloor != null && (
        <div className="space-y-1.5">
          <Label htmlFor="amount">
            What you'll pay ({fmt(slidingFloor)}–{fmt(listPrice)})
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min={slidingFloor}
            max={listPrice}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Anything to share? (optional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="space-y-1.5">
        <Label>Payment</Label>
        <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
          <input type="radio" checked readOnly />
          <span>Interac eTransfer — instructions on the next page</span>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm text-muted-foreground opacity-60">
          <input type="radio" disabled />
          <span>Credit / debit card — coming soon</span>
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}
