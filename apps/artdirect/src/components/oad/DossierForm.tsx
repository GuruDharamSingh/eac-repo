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

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#121413",
  color: "#f7f1e3",
  fontFamily: "'Courier Prime', 'Courier New', monospace",
  padding: "2.5rem 1.5rem",
};
const sheet: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  background: "#f7f1e3",
  color: "#1a1a1a",
  padding: "2rem",
  border: "1px solid #000",
  boxShadow: "0 24px 60px rgba(0,0,0,.45)",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase",
  fontWeight: 700,
  margin: "1rem 0 0.25rem",
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  border: "1px solid #1a1a1a",
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 14,
  boxSizing: "border-box",
};

export function DossierForm({ action, mode, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div style={wrap}>
      <form style={sheet} action={formAction}>
        <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8c3b3b", margin: 0 }}>
          ArtDirect
        </p>
        <h1 style={{ fontSize: "1.8rem", margin: "0.25rem 0 0.5rem", letterSpacing: 1 }}>
          {mode === "create" ? "OPEN A FILE" : "AMEND FILE"}
        </h1>
        <p style={{ fontSize: 13, color: "#4a4a40", lineHeight: 1.6, marginTop: 0 }}>
          {mode === "create"
            ? "Add an artist to the directory — someone you know, work with, or want the network to find. They can claim and verify their file later."
            : "Anyone in the network can keep a file accurate. Your changes are saved to the public record."}
        </p>

        {mode === "edit" && initial && <input type="hidden" name="slug" defaultValue={initial.slug} />}

        <label style={label} htmlFor="name">Artist name *</label>
        <input style={input} id="name" name="name" required defaultValue={initial?.name ?? ""} placeholder="Jane Doe" />

        <label style={label} htmlFor="occupation">Occupation / discipline</label>
        <input style={input} id="occupation" name="occupation" defaultValue={initial?.occupation ?? ""} placeholder="Muralist / Printmaker" />

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
        <p style={{ fontSize: 11, color: "#8a8070", margin: "0.35rem 0 0" }}>
          Real places from the map (OpenStreetMap) — picking one stores the canonical city/region/country, postal code, and coordinates, so community hubs can surface “artists near you.”
        </p>

        <label style={label} htmlFor="bio">Notes / bio — one paragraph per blank line</label>
        <textarea style={{ ...input, minHeight: 110 }} id="bio" name="bio" defaultValue={initial?.bioText ?? ""} />

        <label style={label} htmlFor="portrait_url">Photo URL</label>
        <input style={input} id="portrait_url" name="portrait_url" defaultValue={initial?.portrait_url ?? ""} placeholder="https://… or /path.jpg" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <div>
            <label style={label} htmlFor="website">Website</label>
            <input style={input} id="website" name="website" defaultValue={initial?.website ?? ""} placeholder="https://…" />
          </div>
          <div>
            <label style={label} htmlFor="email">Contact email</label>
            <input style={input} id="email" name="email" defaultValue={initial?.email ?? ""} placeholder="artist@example.com" />
          </div>
        </div>

        <label style={label} htmlFor="links">Links — one per line: <code>Label | https://…</code></label>
        <textarea style={{ ...input, minHeight: 70 }} id="links" name="links" defaultValue={initial?.linksText ?? ""} placeholder="Instagram | https://instagram.com/…" />

        <label style={label} htmlFor="source_note">Source / how you know them <span style={{ fontWeight: 400, textTransform: "none", color: "#8a8070" }}>(optional, wiki attribution)</span></label>
        <textarea style={{ ...input, minHeight: 56 }} id="source_note" name="source_note" defaultValue={initial?.source_note ?? ""} placeholder="Studio-mate at …, or link to a news story / portfolio" />

        {state.error && (
          <p style={{ color: "#8c3b3b", fontWeight: 700, marginTop: "1rem" }}>{state.error}</p>
        )}

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.5rem", alignItems: "center" }}>
          <button
            type="submit"
            disabled={pending}
            style={{ background: "#1a1a1a", color: "#f7f1e3", border: "none", padding: "0.6rem 1.4rem", letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}
          >
            {pending ? "Filing…" : mode === "create" ? "File dossier" : "Save changes"}
          </button>
          <a href={mode === "edit" && initial ? `/${initial.slug}` : "/"} style={{ color: "#4a4a40", fontSize: 13 }}>
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
