"use client";

import * as React from "react";
import { toast } from "sonner";
import { SurfaceFrame, useSurface } from "@elkdonis/cms-ui/surface";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@elkdonis/primitives";
import {
  canListArtPieceAction,
  createArtPieceAction,
} from "@/lib/cms/art-piece-actions";

// ============================================================================
// An art piece, from the hub.
//
// Unlike every other thing this hub composes, the subject here is an OBJECT
// with measurements — so the form is built around the image and the
// specifications a collector asks for: medium, year, the three dimensions,
// whether it is an original or an edition, and what is known about where it
// has been. The field vocabulary is `artwork`'s own (art-auction's schema),
// not a second one invented for this form.
//
// It saves as a DRAFT. Putting work up for sale involves a price, a store and
// an agreement about the cut; none of that should follow from filling in a
// popup. The piece lands in the member's store, ready to be finished there.
// ============================================================================

const KINDS = [
  { value: "original", label: "Original — one of one" },
  { value: "limited_edition", label: "Limited edition" },
  { value: "open_edition", label: "Open edition / print" },
] as const;

export function ArtPieceComposer() {
  const surfaces = useSurface();

  const [gate, setGate] = React.useState<null | {
    ok: boolean;
    reason?: string;
  }>(null);

  const [imageUrl, setImageUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [medium, setMedium] = React.useState("");
  const [year, setYear] = React.useState("");
  const [h, setH] = React.useState("");
  const [w, setW] = React.useState("");
  const [d, setD] = React.useState("");
  const [kind, setKind] = React.useState<string>("original");
  const [price, setPrice] = React.useState("");
  const [coa, setCoa] = React.useState(true);
  const [provenance, setProvenance] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Asked once, before the form is drawn: someone with no store should be told
  // so, not refused after eight fields.
  React.useEffect(() => {
    let cancelled = false;
    canListArtPieceAction()
      .then((r) => !cancelled && setGate(r))
      .catch(() => !cancelled && setGate({ ok: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!title.trim()) return toast.error("Give the piece a title");
    if (!imageUrl) return toast.error("A piece needs an image");

    setSaving(true);
    const result = await createArtPieceAction({
      title,
      imageUrl,
      descriptionHtml: description,
      medium,
      yearCreated: year,
      heightCm: h,
      widthCm: w,
      depthCm: d,
      kind: kind as "original" | "limited_edition" | "open_edition",
      price,
      certificateOfAuthenticity: coa,
      provenanceNotes: provenance,
    });
    setSaving(false);

    if (result.ok === false) return toast.error(result.error);
    toast.success("Saved as a draft in your store");
    surfaces.connectors.onMutated?.();
    surfaces.close();
  }

  if (gate === null) {
    return (
      <SurfaceFrame kind="product" title="Add a piece" kicker="Your work">
        <p className="eac-surface-muted">Checking your store…</p>
      </SurfaceFrame>
    );
  }

  if (!gate.ok) {
    return (
      <SurfaceFrame kind="product" title="Add a piece" kicker="Your work">
        <p className="eac-surface-empty">
          {gate.reason === "store-pending"
            ? "Your store is not approved yet. Once it is, your work can be listed from here."
            : "A piece belongs to a store, and you do not have one on the network yet. Open one and this will list into it."}
        </p>
        <p className="ifac-compose-note">
          Stores, pricing and sales live in the marketplace — this form only
          catalogues the work.
        </p>
      </SurfaceFrame>
    );
  }

  return (
    <SurfaceFrame
      kind="product"
      title="Add a piece"
      kicker="Your work"
      status={saving ? "Saving…" : "Saved as a draft — price and publish it in your store"}
      actions={[
        { label: "Cancel", quiet: true, onClick: () => surfaces.close() },
        {
          label: saving ? "Saving…" : "Save the piece",
          primary: true,
          onClick: () => void submit(),
          disabled: saving || !title.trim() || !imageUrl,
        },
      ]}
    >
      <div className="eac-compose">
        {/* The image leads. Everything under it describes the thing in it. */}
        <MediaPicker
          value={imageUrl || undefined}
          onChange={setImageUrl}
          uploadEndpoint="/api/media/upload"
          libraryEndpoint="/api/media/library"
          label="The piece"
          hint="One image, as large as you have it — this is what a collector sees first."
        />

        <div className="eac-field">
          <Label htmlFor="ap-title">Title</Label>
          <Input id="ap-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <section className="eac-group">
          <h3>Specifications</h3>

          <div className="eac-field-row">
            <div className="eac-field">
              <Label htmlFor="ap-medium">Medium</Label>
              <Input
                id="ap-medium"
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                placeholder="Oil on linen, bronze, silver gelatin…"
              />
            </div>
            <div className="eac-field">
              <Label htmlFor="ap-year">Year</Label>
              <Input
                id="ap-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
              />
            </div>
          </div>

          <div className="eac-field">
            <Label htmlFor="ap-h">Dimensions, in centimetres</Label>
            <div className="ifac-dims">
              <Input
                id="ap-h"
                type="number"
                step="0.1"
                value={h}
                onChange={(e) => setH(e.target.value)}
                placeholder="Height"
                aria-label="Height in centimetres"
              />
              <span aria-hidden>×</span>
              <Input
                type="number"
                step="0.1"
                value={w}
                onChange={(e) => setW(e.target.value)}
                placeholder="Width"
                aria-label="Width in centimetres"
              />
              <span aria-hidden>×</span>
              <Input
                type="number"
                step="0.1"
                value={d}
                onChange={(e) => setD(e.target.value)}
                placeholder="Depth"
                aria-label="Depth in centimetres"
              />
            </div>
            <p className="eac-field-hint">Leave depth blank for work on paper or canvas.</p>
          </div>

          <div className="eac-field-row">
            <div className="eac-field">
              <Label htmlFor="ap-kind">Edition</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="ap-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="eac-field">
              <Label htmlFor="ap-price">Asking price</Label>
              <Input
                id="ap-price"
                type="number"
                step="0.01"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Leave blank for now"
              />
            </div>
          </div>
        </section>

        <details className="eac-group eac-group--optional">
          <summary>
            <span className="eac-group-name">Provenance and notes</span>
            <span className="eac-group-blurb">Where it has been, and what it is about</span>
          </summary>
          <div className="eac-group-fields">
            <div className="eac-field">
              <Label htmlFor="ap-desc">About the piece</Label>
              <Textarea
                id="ap-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What it is, what it came out of."
              />
            </div>
            <div className="eac-field">
              <Label htmlFor="ap-prov">Provenance</Label>
              <Textarea
                id="ap-prov"
                rows={3}
                value={provenance}
                onChange={(e) => setProvenance(e.target.value)}
                placeholder="Exhibitions, previous owners, where it was made."
              />
            </div>
            <label className="eac-check">
              <Checkbox
                checked={coa}
                onCheckedChange={(next) => setCoa(next === true)}
              />
              <span>Comes with a certificate of authenticity</span>
            </label>
          </div>
        </details>
      </div>
    </SurfaceFrame>
  );
}
