"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteServiceAction, saveServiceAction } from "@/app/hub/services/actions";
import type { ServiceFormInput } from "@/lib/service-schema";

const fieldClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ServiceForm({ initial, threadId }: { initial: ServiceFormInput; threadId?: string }) {
  const router = useRouter();
  const [v, setV] = useState<ServiceFormInput>(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof ServiceFormInput>(k: K, val: ServiceFormInput[K]) => setV((p) => ({ ...p, [k]: val }));

  function submit(status: "draft" | "published") {
    start(async () => {
      const res = await saveServiceAction({ ...v, status }, threadId);
      if (!res.ok) return void toast.error(res.error ?? "Could not save");
      toast.success(status === "published" ? "Published" : "Draft saved");
      if (!threadId && res.id) router.replace(`/hub/services/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(v.status ?? "draft");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" required maxLength={200} value={v.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input id="subtitle" maxLength={200} value={v.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="descriptionShort">Short description</Label>
        <Input id="descriptionShort" maxLength={300} placeholder="One sentence for the card" value={v.descriptionShort ?? ""} onChange={(e) => set("descriptionShort", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Description</Label>
        <textarea id="body" className={`${fieldClass} min-h-40`} maxLength={20000} value={v.body ?? ""} onChange={(e) => set("body", e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="bookingType">Booking</Label>
          <select id="bookingType" className={fieldClass} value={v.bookingType} onChange={(e) => set("bookingType", e.target.value as ServiceFormInput["bookingType"])}>
            <option value="one_on_one">One-on-one</option>
            <option value="group">Group</option>
            <option value="async">Self-paced</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="format">Format</Label>
          <select id="format" className={fieldClass} value={v.format ?? ""} onChange={(e) => set("format", (e.target.value || undefined) as ServiceFormInput["format"])}>
            <option value="">—</option>
            <option value="online">Online</option>
            <option value="in_person">In person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="registrationStatus">Availability</Label>
          <select id="registrationStatus" className={fieldClass} value={v.registrationStatus ?? "open"} onChange={(e) => set("registrationStatus", e.target.value as ServiceFormInput["registrationStatus"])}>
            <option value="open">Open</option>
            <option value="waitlist">Waitlist</option>
            <option value="full">Full</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price</Label>
          <Input id="price" inputMode="decimal" required value={String(v.price ?? "")} onChange={(e) => set("price", e.target.value as unknown as number)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" maxLength={3} value={v.currency ?? "CAD"} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priceSlidingMin">Sliding scale from</Label>
          <Input id="priceSlidingMin" inputMode="decimal" placeholder="optional" value={v.priceSlidingMin == null ? "" : String(v.priceSlidingMin)} onChange={(e) => set("priceSlidingMin", (e.target.value === "" ? undefined : e.target.value) as unknown as number)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sessionDurationHrs">Length (hours)</Label>
          <Input id="sessionDurationHrs" inputMode="decimal" placeholder="e.g. 1.5" value={v.sessionDurationHrs == null ? "" : String(v.sessionDurationHrs)} onChange={(e) => set("sessionDurationHrs", (e.target.value === "" ? undefined : e.target.value) as unknown as number)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slidingScaleNote">Sliding-scale note</Label>
        <Input id="slidingScaleNote" maxLength={300} value={v.slidingScaleNote ?? ""} onChange={(e) => set("slidingScaleNote", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="recurrenceLabel">Schedule</Label>
          <Input id="recurrenceLabel" maxLength={120} placeholder="e.g. By appointment" value={v.recurrenceLabel ?? ""} onChange={(e) => set("recurrenceLabel", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" maxLength={200} placeholder="e.g. Online, or an address" value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => submit("draft")}>
          Save draft
        </Button>
        <Button type="button" disabled={pending} onClick={() => submit("published")}>
          {v.status === "published" ? "Save & keep published" : "Publish"}
        </Button>
        {threadId && (
          <Button
            type="button"
            variant="outline"
            className="ml-auto text-destructive"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Delete this service? This can't be undone.")) return;
              start(async () => {
                const res = await deleteServiceAction(threadId);
                if (!res.ok) return void toast.error(res.error ?? "Could not delete");
                toast.success("Deleted");
                router.push("/hub/services");
                router.refresh();
              });
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
