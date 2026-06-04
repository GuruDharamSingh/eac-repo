"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MultiImageUploader,
  RichTextEditor,
  type UploadedImage,
} from "@elkdonis/studio-ui";
import {
  createArtworkAction,
  updateArtworkAction,
  publishArtworkAction,
  archiveArtworkAction,
  type ArtworkFormInput,
} from "../actions";

export type ArtworkFormInitial = {
  id?: string;
  title?: string;
  descriptionHtml?: string;
  kind?: "original" | "limited_edition" | "open_edition";
  yearCreated?: number | null;
  medium?: string | null;
  style?: string | null;
  subject?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  depthCm?: number | null;
  certificateOfAuthenticity?: boolean;
  provenanceNotes?: string | null;
  price?: number;
  inventoryQty?: number;
  status?: string;
  images?: UploadedImage[];
};

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-[2px] focus:ring-ring/50";
const labelCls = "mb-1 block text-sm font-medium";

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ArtworkForm({ initial }: { initial?: ArtworkFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [descriptionHtml, setDescriptionHtml] = React.useState(
    initial?.descriptionHtml ?? ""
  );
  const [kind, setKind] = React.useState<ArtworkFormInput["kind"]>(
    initial?.kind ?? "original"
  );
  const [year, setYear] = React.useState(
    initial?.yearCreated != null ? String(initial.yearCreated) : ""
  );
  const [medium, setMedium] = React.useState(initial?.medium ?? "");
  const [style, setStyle] = React.useState(initial?.style ?? "");
  const [subject, setSubject] = React.useState(initial?.subject ?? "");
  const [height, setHeight] = React.useState(
    initial?.heightCm != null ? String(initial.heightCm) : ""
  );
  const [width, setWidth] = React.useState(
    initial?.widthCm != null ? String(initial.widthCm) : ""
  );
  const [depth, setDepth] = React.useState(
    initial?.depthCm != null ? String(initial.depthCm) : ""
  );
  const [coa, setCoa] = React.useState(
    initial?.certificateOfAuthenticity ?? false
  );
  const [provenance, setProvenance] = React.useState(
    initial?.provenanceNotes ?? ""
  );
  const [price, setPrice] = React.useState(
    initial?.price != null ? String(initial.price) : ""
  );
  const [inventory, setInventory] = React.useState(
    initial?.inventoryQty != null ? String(initial.inventoryQty) : "1"
  );
  const [images, setImages] = React.useState<UploadedImage[]>(
    initial?.images ?? []
  );
  const [pending, setPending] = React.useState(false);

  function buildInput(): ArtworkFormInput {
    return {
      title,
      descriptionHtml,
      kind,
      yearCreated: numOrNull(year),
      medium: medium.trim() || null,
      style: style.trim() || null,
      subject: subject.trim() || null,
      heightCm: numOrNull(height),
      widthCm: numOrNull(width),
      depthCm: numOrNull(depth),
      certificateOfAuthenticity: coa,
      provenanceNotes: provenance.trim() || null,
      price: Number(price) || 0,
      inventoryQty: numOrNull(inventory) ?? 1,
      images: images.map((img) => ({
        url: img.url,
        nextcloudPath: img.path ?? null,
        nextcloudFileId: img.nextcloudFileId ?? null,
        alt: img.alt ?? null,
      })),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("A title is required.");
    if (!price || Number(price) <= 0)
      return toast.error("Set a price greater than zero.");
    setPending(true);
    try {
      if (isEdit && initial?.id) {
        const res = await updateArtworkAction(initial.id, buildInput());
        if (!res.ok) return toast.error(res.error ?? "Failed to save.");
        toast.success("Artwork saved.");
        router.refresh();
      } else {
        const res = await createArtworkAction(buildInput());
        if (!res.ok || !res.id)
          return toast.error(res.error ?? "Failed to create.");
        toast.success("Artwork created as a draft.");
        router.push(`/studio/artworks/${res.id}/edit`);
      }
    } finally {
      setPending(false);
    }
  }

  async function handlePublish() {
    if (!initial?.id) return;
    setPending(true);
    try {
      // Persist current edits before publishing.
      const saved = await updateArtworkAction(initial.id, buildInput());
      if (!saved.ok) return toast.error(saved.error ?? "Failed to save.");
      const res = await publishArtworkAction(initial.id);
      if (!res.ok) return toast.error(res.error ?? "Failed to publish.");
      toast.success("Artwork published.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleArchive() {
    if (!initial?.id) return;
    setPending(true);
    try {
      const res = await archiveArtworkAction(initial.id);
      if (!res.ok) return toast.error(res.error ?? "Failed to archive.");
      toast.success("Artwork archived.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-serif text-xl">Images</h2>
        <MultiImageUploader
          value={images}
          onChange={setImages}
          uploadEndpoint="/api/upload"
          maxImages={12}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Description</label>
          <RichTextEditor
            value={descriptionHtml}
            onChange={setDescriptionHtml}
            placeholder="Describe this piece…"
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="kind">
            Kind
          </label>
          <select
            id="kind"
            className={inputCls}
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as ArtworkFormInput["kind"])
            }
          >
            <option value="original">Original</option>
            <option value="limited_edition">Limited edition</option>
            <option value="open_edition">Open edition</option>
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="price">
            Price (CAD)
          </label>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="year">
            Year created
          </label>
          <input
            id="year"
            type="number"
            className={inputCls}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="inventory">
            Inventory
          </label>
          <input
            id="inventory"
            type="number"
            min="0"
            className={inputCls}
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="medium">
            Medium
          </label>
          <input
            id="medium"
            className={inputCls}
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="Oil on canvas"
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="style">
            Style
          </label>
          <input
            id="style"
            className={inputCls}
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="subject">
            Subject
          </label>
          <input
            id="subject"
            className={inputCls}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <div>
            <label className={labelCls} htmlFor="height">
              Height (cm)
            </label>
            <input
              id="height"
              type="number"
              step="0.1"
              className={inputCls}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="width">
              Width (cm)
            </label>
            <input
              id="width"
              type="number"
              step="0.1"
              className={inputCls}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="depth">
              Depth (cm)
            </label>
            <input
              id="depth"
              type="number"
              step="0.1"
              className={inputCls}
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="provenance">
            Provenance notes
          </label>
          <textarea
            id="provenance"
            className={inputCls}
            rows={3}
            value={provenance}
            onChange={(e) => setProvenance(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={coa}
            onChange={(e) => setCoa(e.target.checked)}
          />
          Includes a certificate of authenticity
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {isEdit ? "Save changes" : "Create draft"}
        </button>

        {isEdit && (
          <>
            <button
              type="button"
              onClick={handlePublish}
              disabled={pending}
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {initial?.status === "available" ? "Re-publish" : "Publish"}
            </button>
            {initial?.status !== "archived" && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={pending}
                className="inline-flex items-center rounded-md px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
              >
                Archive
              </button>
            )}
          </>
        )}
        {isEdit && initial?.status && (
          <span className="ml-auto text-sm text-muted-foreground">
            Status: <span className="font-medium">{initial.status}</span>
          </span>
        )}
      </div>
    </form>
  );
}
