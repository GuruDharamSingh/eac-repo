"use client";

import { useState, useTransition } from "react";
import { saveOfferLookAction } from "@/lib/offer-look-actions";

type Look = { font: string; icons: string; mark: string; tint: boolean; enabled: boolean };

const FONTS = ["para", "gazette", "quiet", "marquee", "ledger", "rite"];
const ICONS = ["things", "marks", "stamps", "glyph"];
const MARKS = ["inline", "thumb", "box"];

function Choice({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm capitalize ${value === o ? "border-foreground bg-accent" : "border-border"}`}>
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="sr-only" />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LookForm({ orgSlug, initial, viewUrl }: { orgSlug: string; initial: Look; viewUrl: string }) {
  const [look, setLook] = useState<Look>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Look>) => { setLook((l) => ({ ...l, ...patch })); setMsg(null); };

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveOfferLookAction(orgSlug, look);
          setMsg(r.ok ? "Saved." : r.error ?? "Could not save.");
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={look.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Use the new page
      </label>
      <Choice label="Font template" name="font" value={look.font} options={FONTS} onChange={(font) => set({ font })} />
      <Choice label="Icon set" name="icons" value={look.icons} options={ICONS} onChange={(icons) => set({ icons })} />
      <Choice label="Phone mark" name="mark" value={look.mark} options={MARKS} onChange={(mark) => set({ mark })} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={look.tint} onChange={(e) => set({ tint: e.target.checked })} />
        Tint each kind of offer with its own colour
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <a href={viewUrl} className="text-sm underline underline-offset-4">View the site</a>
        {msg && <span role="status" className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </form>
  );
}
