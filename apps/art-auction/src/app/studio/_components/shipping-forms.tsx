"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buyLabelAction, recordTrackingAction, saveParcelAction, saveShipFromAction } from "../actions";

type Result = { ok: boolean; error?: string };

function useRun() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const run = async (fn: () => Promise<Result>, success: string) => {
    setPending(true);
    try {
      const r = await fn();
      if (r.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong.");
      return r.ok;
    } finally {
      setPending(false);
    }
  };
  return { pending, run };
}

function Field(props: { label: string; name: string; defaultValue?: string | number | null; span?: boolean; type?: string; step?: string; required?: boolean }) {
  return (
    <label className={props.span ? "sm:col-span-2" : undefined}>
      <span className="mb-1 block text-xs text-muted-foreground">{props.label}</span>
      <Input name={props.name} defaultValue={props.defaultValue ?? ""} type={props.type} step={props.step} required={props.required} />
    </label>
  );
}

// ─── Ship-from (the maker's own) ─────────────────────────────────────────────

export interface ShipFromValue {
  recipientName: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
}

export function ShipFromForm({ initial }: { initial: ShipFromValue | null }) {
  const { pending, run } = useRun();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const g = (k: string) => String(d.get(k) ?? "").trim();
    void run(
      () =>
        saveShipFromAction({
          recipientName: g("recipientName"),
          company: g("company") || undefined,
          line1: g("line1"),
          line2: g("line2") || undefined,
          city: g("city"),
          region: g("region") || undefined,
          postalCode: g("postalCode"),
          country: g("country"),
          phone: g("phone"),
          email: g("email"),
        }),
      "Ship-from address saved."
    );
  };
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Name" name="recipientName" defaultValue={initial?.recipientName} required />
      <Field label="Studio or company (optional)" name="company" defaultValue={initial?.company} />
      <Field label="Street address" name="line1" defaultValue={initial?.line1} span required />
      <Field label="Unit (optional)" name="line2" defaultValue={initial?.line2} span />
      <Field label="City" name="city" defaultValue={initial?.city} required />
      <Field label="Province / state" name="region" defaultValue={initial?.region} />
      <Field label="Postal / ZIP code" name="postalCode" defaultValue={initial?.postalCode} required />
      <Field label="Country (CA, US, FR…)" name="country" defaultValue={initial?.country ?? "CA"} required />
      <Field label="Phone (couriers require it)" name="phone" defaultValue={initial?.phone} required />
      <Field label="Email for the courier" name="email" type="email" defaultValue={initial?.email} required />
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>Save ship-from address</Button>
        {initial && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => void run(() => saveShipFromAction(null), "Ship-from address removed.")}>
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}

// ─── Packed parcel (per artwork) ─────────────────────────────────────────────

export function ParcelForm({
  artworkId,
  initial,
}: {
  artworkId: string;
  initial: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number } | null;
}) {
  const { pending, run } = useRun();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const n = (k: string) => Number(String(d.get(k) ?? "").replace(",", "."));
    void run(
      () => saveParcelAction(artworkId, { lengthCm: n("lengthCm"), widthCm: n("widthCm"), heightCm: n("heightCm"), weightKg: n("weightKg") }),
      "Packed size saved."
    );
  };
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="Length (cm)" name="lengthCm" type="number" step="0.1" defaultValue={initial?.lengthCm} required />
      <Field label="Width (cm)" name="widthCm" type="number" step="0.1" defaultValue={initial?.widthCm} required />
      <Field label="Height (cm)" name="heightCm" type="number" step="0.1" defaultValue={initial?.heightCm} required />
      <Field label="Weight (kg)" name="weightKg" type="number" step="0.1" defaultValue={initial?.weightKg} required />
      <div className="col-span-2 flex gap-3 sm:col-span-4">
        <Button type="submit" disabled={pending}>Save packed size</Button>
        {initial && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => void run(() => saveParcelAction(artworkId, null), "Packed size removed.")}>
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}

// ─── One sale's shipment (sales table) ───────────────────────────────────────

export function ShipmentCell({
  orderId,
  mode,
  serviceName,
  canShip,
  shipment,
}: {
  orderId: string;
  mode: "quote" | "platform" | "arranged";
  /** The courier service the buyer paid for, or null when arranged. */
  serviceName: string | null;
  /** Paid and not yet shipped. */
  canShip: boolean;
  shipment: { courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; labelUrl: string | null; status: string } | null;
}) {
  const { pending, run } = useRun();
  const [open, setOpen] = React.useState(false);

  if (shipment) {
    return (
      <div className="text-xs text-muted-foreground">
        {shipment.courierName ?? "Courier"}
        {shipment.trackingNumber && (
          <>
            {" · "}
            {shipment.trackingUrl ? (
              <a href={shipment.trackingUrl} className="underline underline-offset-4">{shipment.trackingNumber}</a>
            ) : (
              shipment.trackingNumber
            )}
          </>
        )}
        {shipment.labelUrl && (
          <>
            {" · "}
            <a href={shipment.labelUrl} className="font-medium text-foreground underline underline-offset-4">Print label</a>
          </>
        )}
      </div>
    );
  }
  if (!serviceName) return <p className="text-xs text-muted-foreground">Shipping arranged with the buyer</p>;
  if (!canShip) return <p className="text-xs text-muted-foreground">Buyer chose {serviceName}</p>;

  if (mode === "platform") {
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="text-xs text-muted-foreground">Buyer paid for {serviceName}</p>
        <Button size="sm" disabled={pending} onClick={() => void run(() => buyLabelAction(orderId), "Label bought.")}>
          {pending ? "Buying label…" : "Get shipping label"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-xs text-muted-foreground">Buyer paid for {serviceName}; ship and add tracking to be paid shipping.</p>
      {!open ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Add tracking</Button>
      ) : (
        <form
          className="flex flex-col items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            const g = (k: string) => String(d.get(k) ?? "").trim();
            void run(
              () => recordTrackingAction({ orderId, courierName: g("courier"), trackingNumber: g("number"), trackingUrl: g("url") || undefined }),
              "Tracking recorded."
            ).then((ok) => ok && setOpen(false));
          }}
        >
          <Input name="courier" placeholder="Courier" defaultValue={serviceName.split(" - ")[0]} className="w-56" required />
          <Input name="number" placeholder="Tracking number" className="w-56" required />
          <Input name="url" placeholder="Tracking link (optional, https://…)" className="w-56" />
          <Button size="sm" type="submit" disabled={pending}>Save tracking</Button>
        </form>
      )}
    </div>
  );
}
