"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MultiImageUploader, type UploadedImage } from "@elkdonis/studio-ui";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import "@elkdonis/cms-ui/editor.css";
import { savePieceAction, type PieceInput } from "@/lib/manage-actions";
import { Notice } from "@elkdonis/cms-ui/manage";
import { useToast } from "@elkdonis/cms-ui/manage/client";

/**
 * A trimmed artwork form for one potter's one store: title, description,
 * kind, year, medium, glaze, size, price, quantity, pictures. (art-auction's
 * studio form is 900 lines because it also carries maker credit, beneficiary,
 * provenance and estimates; none of those belong here.)
 *
 * Pictures upload through THIS site's /api/media/upload (editors only; it
 * answers { url, id, ... } which is what MultiImageUploader expects) into the
 * owner's own Media/Images folder, so the same address works on Collect Art.
 */

export interface PieceFormInitial {
  id: string | null;
  title: string;
  descriptionHtml: string;
  kind: PieceInput["kind"];
  yearCreated: number | null;
  medium: string;
  style: string;
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  weightKg?: number | null;
  /** Major units. */
  price: number | null;
  currency: "CAD" | "USD";
  inventoryQty: number;
  images: UploadedImage[];
  status: string;
}

const numOrNull = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

export function PieceForm({ initial, readOnlyReason }: { initial: PieceFormInitial; readOnlyReason?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const [title, setTitle] = useState(initial.title);
  const [descriptionHtml, setDescriptionHtml] = useState(initial.descriptionHtml);
  const [kind, setKind] = useState(initial.kind);
  const [year, setYear] = useState(initial.yearCreated?.toString() ?? "");
  const [medium, setMedium] = useState(initial.medium);
  const [style, setStyle] = useState(initial.style);
  const [h, setH] = useState(initial.heightCm?.toString() ?? "");
  const [w, setW] = useState(initial.widthCm?.toString() ?? "");
  const [d, setD] = useState(initial.depthCm?.toString() ?? "");
  const [kg, setKg] = useState(initial.weightKg?.toString() ?? "");
  const [price, setPrice] = useState(initial.price?.toString() ?? "");
  const [currency, setCurrency] = useState(initial.currency);
  const [qty, setQty] = useState(String(initial.inventoryQty));
  const [images, setImages] = useState<UploadedImage[]>(initial.images);

  const disabled = Boolean(readOnlyReason) || pending;

  const save = (publish: boolean) => {
    start(async () => {
      const input: PieceInput = {
        title,
        descriptionHtml,
        kind,
        yearCreated: numOrNull(year),
        medium,
        style,
        heightCm: numOrNull(h),
        widthCm: numOrNull(w),
        depthCm: numOrNull(d),
        weightKg: numOrNull(kg),
        price: numOrNull(price),
        currency,
        inventoryQty: Number(qty) || 1,
        images: images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
        publish,
      };
      const r = await savePieceAction(initial.id, input).catch(() => null);
      toast(r);
      if (r?.ok) {
        if (!initial.id && r.id) router.replace(`/manage/pieces/${r.id}`);
        else router.refresh();
      }
    });
  };

  return (
    <form
      className="ktp-m-form"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      {readOnlyReason ? (
        <Notice>
          {readOnlyReason}
        </Notice>
      ) : null}

      <section className="ktp-m-card">
        <h2>The piece</h2>
        <div className="ktp-m-grid">
          <label className="ktp-m-field ktp-m-span2">
            <span>Title *</span>
            <input className="ktp-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={disabled} />
          </label>
          <div className="ktp-m-field ktp-m-span2">
            <span id="desc-label">Description</span>
            <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} placeholder="How it was made, how it feels to use, how to care for it." toolbar="minimal" ariaLabel="Description" minHeight={160} />
          </div>
          <label className="ktp-m-field">
            <span>Kind</span>
            <select className="ktp-input" value={kind} onChange={(e) => setKind(e.target.value as PieceInput["kind"])} disabled={disabled}>
              <option value="original">One of a kind</option>
              <option value="limited_edition">Limited edition</option>
              <option value="open_edition">Open edition</option>
            </select>
          </label>
          <label className="ktp-m-field">
            <span>Year</span>
            <input className="ktp-input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Medium</span>
            <input className="ktp-input" value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="Wheel-thrown stoneware" maxLength={200} disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Glaze / finish</span>
            <input className="ktp-input" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Tenmoku" maxLength={200} disabled={disabled} />
          </label>
        </div>
      </section>

      <section className="ktp-m-card">
        <h2>Size and weight, price and quantity</h2>
        <div className="ktp-m-grid ktp-m-grid--4">
          <label className="ktp-m-field">
            <span>Height (cm)</span>
            <input className="ktp-input" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Width (cm)</span>
            <input className="ktp-input" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Depth (cm)</span>
            <input className="ktp-input" inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Weight (kg)</span>
            <input className="ktp-input" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="e.g. 0.45" disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Quantity</span>
            <input className="ktp-input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Price</span>
            <input className="ktp-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Blank = price on request" disabled={disabled} />
          </label>
          <label className="ktp-m-field">
            <span>Currency</span>
            <select className="ktp-input" value={currency} onChange={(e) => setCurrency(e.target.value as "CAD" | "USD")} disabled={disabled}>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <p className="ktp-m-fine">A piece with no price is shown as &ldquo;Price on request&rdquo; and can&rsquo;t be added to a cart. Weigh the piece itself, without a box (a kitchen scale is fine): shipping prices are worked out from the size and weight.</p>
      </section>

      <section className="ktp-m-card">
        <h2>Pictures</h2>
        <p className="ktp-m-fine">The first picture is the cover. Drag to reorder; add a short description of each for screen readers.</p>
        <MultiImageUploader value={images} onChange={setImages} uploadEndpoint="/api/media/upload" maxImages={12} disabled={disabled} onBusyChange={setUploading} />
      </section>

      <div className="ktp-m-savebar">
        <button type="submit" className="ktp-btn ktp-btn--ghost" disabled={disabled || uploading}>
          {pending ? "Saving…" : initial.status === "available" ? "Save changes" : "Save draft"}
        </button>
        {initial.status === "available" ? null : (
          <button type="button" className="ktp-btn" disabled={disabled || uploading} onClick={() => save(true)}>
            Save and put on sale
          </button>
        )}
        {uploading ? <span className="ktp-m-fine">Waiting for a picture to finish uploading…</span> : null}
      </div>
    </form>
  );
}
