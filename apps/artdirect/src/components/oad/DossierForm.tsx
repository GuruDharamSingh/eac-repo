"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/oad-actions";
import type { DossierEditFields } from "@/lib/oad";
import { PlaceAutocomplete } from "@/components/oad/PlaceAutocomplete";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  mode: "create" | "edit";
  initial?: DossierEditFields | null;
};

export function DossierForm({ action, mode, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="ad-desk">
      <form className="ad-sheet" action={formAction}>
        <p className="ad-sheet-eyebrow">ArtDirect</p>
        <h1 className="ad-sheet-title">
          {mode === "create" ? "OPEN A FILE" : "AMEND FILE"}
        </h1>
        <p className="ad-sheet-lede">
          {mode === "create"
            ? "Add an artist to the directory — someone you know, work with, or want the network to find. They can claim and verify their file later."
            : "Anyone in the network can keep a file accurate. Your changes are saved to the public record."}
        </p>

        {mode === "edit" && initial && <input type="hidden" name="slug" defaultValue={initial.slug} />}

        <label className="ad-label" htmlFor="name">Artist name *</label>
        <input className="ad-field" id="name" name="name" required defaultValue={initial?.name ?? ""} placeholder="Jane Doe" />

        <label className="ad-label" htmlFor="occupation">Occupation / discipline</label>
        <input className="ad-field" id="occupation" name="occupation" defaultValue={initial?.occupation ?? ""} placeholder="Muralist / Printmaker" />

        <PlaceAutocomplete
          initial={{
            city: initial?.city ?? "",
            region: initial?.region ?? "",
            country: initial?.country ?? "",
            postcode: initial?.postcode ?? "",
            lat: initial?.lat ?? null,
            lng: initial?.lng ?? null,
          }}
        />
        <p className="ad-field-hint">
          Real places from the map (OpenStreetMap) — picking one stores the canonical city/region/country, postal code, and coordinates, so community hubs can surface “artists near you.”
        </p>

        <label className="ad-label" htmlFor="bio">Notes / bio — one paragraph per blank line</label>
        <textarea className="ad-field" data-rows="5" id="bio" name="bio" defaultValue={initial?.bioText ?? ""} />

        <label className="ad-label" htmlFor="portrait_url">Photo URL</label>
        <input className="ad-field" id="portrait_url" name="portrait_url" defaultValue={initial?.portrait_url ?? ""} placeholder="https://… or /path.jpg" />

        <div className="ad-field-row">
          <div>
            <label className="ad-label" htmlFor="website">Website</label>
            <input className="ad-field" id="website" name="website" defaultValue={initial?.website ?? ""} placeholder="https://…" />
          </div>
          <div>
            <label className="ad-label" htmlFor="email">Contact email</label>
            <input className="ad-field" id="email" name="email" defaultValue={initial?.email ?? ""} placeholder="artist@example.com" />
          </div>
        </div>

        <label className="ad-label" htmlFor="links">Links — one per line: <code>Label | https://…</code></label>
        <textarea className="ad-field" data-rows="3" id="links" name="links" defaultValue={initial?.linksText ?? ""} placeholder="Instagram | https://instagram.com/…" />

        <label className="ad-label" htmlFor="source_note">Source / how you know them <span className="ad-field-aside">(optional, wiki attribution)</span></label>
        <textarea className="ad-field" data-rows="2" id="source_note" name="source_note" defaultValue={initial?.source_note ?? ""} placeholder="Studio-mate at …, or link to a news story / portfolio" />

        {state.error && (
          <p className="ad-sheet-error" role="alert">{state.error}</p>
        )}

        <div className="ad-sheet-actions">
          <button type="submit" disabled={pending} className="ad-button" data-variant="ink">
            {pending ? "Filing…" : mode === "create" ? "File dossier" : "Save changes"}
          </button>
          <a href={mode === "edit" && initial ? `/${initial.slug}` : "/"} className="ad-sheet-cancel">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
