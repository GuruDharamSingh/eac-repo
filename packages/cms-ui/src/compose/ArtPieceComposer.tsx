"use client";

import * as React from "react";
import { SurfaceFrame, useSurface } from "../surface";

/**
 * A piece of work, catalogued from a hub.
 *
 * Unlike everything else a hub composes, the subject is an OBJECT with
 * measurements, so the form is built around the image and the specifications
 * a collector asks for. The field vocabulary is `artwork`'s own — the
 * marketplace's schema — not a second one invented here.
 *
 * ── Why this lives in cms-ui and not in the marketplace ────────────────────
 *
 * An artist's store is not owned by an org: `store.owner_user_id` is the
 * person, and `getStoreForUser` finds it without being told which org is
 * asking. So a member can list work from ANY hub they belong to and it lands
 * in the one store they already have. Keeping the form inside one app made
 * that accidentally false — only that app's members could catalogue anything.
 *
 * This package still knows nothing about commerce. The host supplies:
 *   checkStore — asked BEFORE the form is drawn. Somebody with no store
 *                should be told so, not refused after eight fields.
 *   onSave     — the server action, and therefore the permission gate.
 *   media      — the picker, wired to that app's own upload endpoints.
 *
 * It saves a DRAFT. Price, store cut and publication involve an agreement
 * about money; none of that should follow from filling in a popup.
 */

export interface ArtPieceInput {
  title: string;
  imageUrl: string;
  descriptionHtml: string;
  medium: string;
  yearCreated: string;
  heightCm: string;
  widthCm: string;
  depthCm: string;
  kind: "original" | "limited_edition" | "open_edition";
  price: string;
  certificateOfAuthenticity: boolean;
  provenanceNotes: string;
}

export interface ArtPieceStoreGate {
  ok: boolean;
  /** "store-pending" | "no-store" | anything the host wants to distinguish. */
  reason?: string;
  storeName?: string | null;
}

export interface ArtPieceComposerProps {
  checkStore: () => Promise<ArtPieceStoreGate>;
  onSave: (
    input: ArtPieceInput
  ) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>;
  media: (props: {
    value?: string;
    onChange: (url: string) => void;
    label: string;
    hint?: string;
    /**
     * Extra multipart fields to send with the upload — today, the title, so
     * the stored file can be named after the work rather than after whatever
     * the camera called it. A host forwards these to MediaPicker's
     * `uploadFields`; one that ignores them loses the nicer filename and
     * nothing else.
     */
    fields?: Record<string, string>;
  }) => React.ReactNode;
  /** Where the store itself lives, for the "you have no store" case. */
  marketplaceUrl?: string;
}

const KINDS = [
  { value: "original", label: "Original — one of one" },
  { value: "limited_edition", label: "Limited edition" },
  { value: "open_edition", label: "Open edition / print" },
] as const;

export function ArtPieceComposer({
  checkStore,
  onSave,
  media,
  marketplaceUrl,
}: ArtPieceComposerProps) {
  const surfaces = useSurface();
  const [gate, setGate] = React.useState<ArtPieceStoreGate | null>(null);

  const [imageUrl, setImageUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [medium, setMedium] = React.useState("");
  const [year, setYear] = React.useState("");
  const [h, setH] = React.useState("");
  const [w, setW] = React.useState("");
  const [d, setD] = React.useState("");
  const [kind, setKind] = React.useState<ArtPieceInput["kind"]>("original");
  const [price, setPrice] = React.useState("");
  const [coa, setCoa] = React.useState(true);
  const [provenance, setProvenance] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    checkStore()
      .then((r) => !cancelled && setGate(r))
      .catch(() => !cancelled && setGate({ ok: false }));
    return () => {
      cancelled = true;
    };
  }, [checkStore]);

  async function submit() {
    setProblem(null);
    if (!title.trim()) return setProblem("Give the piece a title.");
    if (!imageUrl) return setProblem("A piece needs an image.");

    setSaving(true);
    try {
      const result = await onSave({
        title,
        imageUrl,
        descriptionHtml: description,
        medium,
        yearCreated: year,
        heightCm: h,
        widthCm: w,
        depthCm: d,
        kind,
        price,
        certificateOfAuthenticity: coa,
        provenanceNotes: provenance,
      });
      if (!result.ok) {
        setProblem(("error" in result && result.error) || "Could not save it.");
        return;
      }
      surfaces.connectors.onMutated?.();
      surfaces.close();
    } catch {
      setProblem("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (gate === null) {
    return (
      <SurfaceFrame kind="gallery" title="Add a piece" kicker="Your work">
        <p className="eac-rota-empty">Checking your store…</p>
      </SurfaceFrame>
    );
  }

  if (!gate.ok) {
    return (
      <SurfaceFrame kind="gallery" title="Add a piece" kicker="Your work">
        <p className="eac-compose-note">
          {gate.reason === "store-pending"
            ? "Your store is not approved yet. Once it is, your work can be listed from here."
            : "A piece belongs to a store, and you do not have one on the network yet. Open one and this will list into it."}
        </p>
        {gate.reason !== "store-pending" && marketplaceUrl && (
          <div className="eac-compose-actions">
            <a
              className="eac-btn eac-btn--primary"
              href={`${marketplaceUrl}/studio/apply`}
              target="_blank"
              rel="noreferrer"
            >
              Open a store →
            </a>
          </div>
        )}
        <p className="eac-compose-note">
          Stores, pricing and sales live in the marketplace — this form only
          catalogues the work.
        </p>
      </SurfaceFrame>
    );
  }

  return (
    <SurfaceFrame
      kind="gallery"
      title="Add a piece"
      kicker={gate.storeName ? `Into ${gate.storeName}` : "Your work"}
      status={
        saving ? "Saving…" : "Saves as a draft — price and publish it in your store"
      }
    >
      <div className="eac-compose">
        {/* The title leads, and it used to come second.
            The image did, on the reasoning that "the image leads; everything
            under it describes the thing in it" — true of how the form READS,
            and wrong about the order things happen in. The upload carries the
            title so the stored file can be named after the work, and a field
            below the picker is always empty at the moment the file is sent.
            Naming the piece before picking its picture is also the order
            someone catalogues in. */}
        <div className="eac-field">
          <label className="eac-field-label" htmlFor="ap-title">Title</label>
          <input
            id="ap-title"
            className="eac-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {media({
          value: imageUrl || undefined,
          onChange: setImageUrl,
          label: "The piece",
          hint: "One image, as large as you have it — this is what a collector sees first.",
          // Sent with the upload. The host forwards it to the picker, which
          // posts it alongside the file; a route that does not read it is
          // unaffected.
          fields: { title: title.trim() },
        })}

        <div className="eac-field">
          <label className="eac-field-label" htmlFor="ap-medium">Medium</label>
          <input
            id="ap-medium"
            className="eac-input"
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="Oil on linen, bronze, silver gelatin…"
          />
        </div>

        <div className="eac-field">
          <label className="eac-field-label" htmlFor="ap-year">Year</label>
          <input
            id="ap-year"
            className="eac-input"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2026"
          />
        </div>

        <div className="eac-field">
          {/* Centimetres, and said so — the gallery hangs work at true scale
              from exactly these three numbers when they are recorded. */}
          <span className="eac-field-label">Dimensions (cm)</span>
          <div className="eac-art-dims">
            <input className="eac-input" aria-label="Height in centimetres" inputMode="decimal"
              value={h} onChange={(e) => setH(e.target.value)} placeholder="Height" />
            <input className="eac-input" aria-label="Width in centimetres" inputMode="decimal"
              value={w} onChange={(e) => setW(e.target.value)} placeholder="Width" />
            <input className="eac-input" aria-label="Depth in centimetres" inputMode="decimal"
              value={d} onChange={(e) => setD(e.target.value)} placeholder="Depth" />
          </div>
        </div>

        <div className="eac-field">
          <label className="eac-field-label" htmlFor="ap-kind">What kind of piece</label>
          <select
            id="ap-kind"
            className="eac-input"
            value={kind}
            onChange={(e) => setKind(e.target.value as ArtPieceInput["kind"])}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>

        <div className="eac-field">
          <label className="eac-field-label" htmlFor="ap-price">
            Asking price, if you have one
          </label>
          <input
            id="ap-price"
            className="eac-input"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Leave blank for price on request"
          />
        </div>

        <div className="eac-field">
          <label className="eac-gate-choice">
            <input type="checkbox" checked={coa} onChange={(e) => setCoa(e.target.checked)} />
            <span>
              <strong>A certificate of authenticity comes with it</strong>
            </span>
          </label>
        </div>

        <div className="eac-field">
          <label className="eac-field-label" htmlFor="ap-prov">Provenance</label>
          <textarea
            id="ap-prov"
            className="eac-input"
            rows={2}
            value={provenance}
            onChange={(e) => setProvenance(e.target.value)}
            placeholder="Exhibitions, previous owners, anything known about where it has been."
          />
        </div>

        <div className="eac-field">
          <label className="eac-field-label" htmlFor="ap-desc">About the piece</label>
          <textarea
            id="ap-desc"
            className="eac-input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {problem && <p className="eac-compose-problem" role="alert">{problem}</p>}

        <div className="eac-compose-actions">
          <button type="button" className="eac-btn" onClick={() => surfaces.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="eac-btn eac-btn--primary"
            onClick={() => void submit()}
            disabled={saving || !title.trim() || !imageUrl}
            aria-busy={saving}
          >
            {saving ? "Saving…" : "Save the piece"}
          </button>
        </div>
      </div>
    </SurfaceFrame>
  );
}
