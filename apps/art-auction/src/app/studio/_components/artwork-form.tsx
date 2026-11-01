"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MultiImageUploader,
  type UploadedImage,
} from "@elkdonis/studio-ui";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Button } from "@/components/ui/button";
import {
  createArtworkAction,
  updateArtworkAction,
  publishArtworkAction,
  archiveArtworkAction,
  searchPeopleAction,
  type ArtworkFormInput,
} from "../actions";

export type BeneficiaryOption = { id: string; name: string; kind: "org" | "charity"; blurb?: string | null };
export type OrgOption = { id: string; name: string };
type Person = { id: string; name: string; email: string | null; slug: string | null };

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
  currency?: "CAD" | "USD" | "EUR";
  inventoryQty?: number;
  status?: string;
  images?: UploadedImage[];
  creditedArtistUserId?: string | null;
  creditedArtistName?: string | null;
  creditStatus?: "credited" | "rejected";
  estimateLow?: number | null;
  estimateHigh?: number | null;
  donation?: {
    fromUserId?: string | null;
    fromName?: string | null;
    fromText?: string | null;
    toOrgId?: string | null;
    occurredOn?: string | null;
    note?: string | null;
  } | null;
  beneficiaryPayeeId?: string | null;
  beneficiaryScope?: "all_proceeds" | "commission" | null;
};

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const labelCls = "mb-1 block text-sm font-medium";
// Its own class list rather than `${inputCls} text-lg` — mixing `text-sm`
// (from inputCls) and `text-lg` in one className leaves the winner up to
// Tailwind's generated stylesheet order, not the order the classes are
// written in, which is exactly how a "bigger price text" fix can silently
// keep rendering small. Money is also the one field worth a legible size on
// a phone: it's easy to mistype a price you can't clearly read back.
const priceInputCls =
  "min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
// Same reasoning, same trap, the OTHER field: `${inputCls} w-[4.5rem]`
// carries inputCls's own `w-full` into the class list alongside it. Verified
// live (CDP screenshot, 2026-09-21) that `w-full` was the one winning —
// the select rendered at ~294px and squeezed the price box next to it down
// to 26px, which is the actual bug behind "the price box is too small to
// see". No shared base class for the currency select; it needs a width
// utility this one carries, not one it fights.
const currencySelectCls =
  "shrink-0 w-[4.5rem] rounded-md border border-input bg-transparent px-1 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Dimensions are stored in centimetres, but almost nobody measures a canvas
 * that way — an artist says "four by eight feet". Entering it in the unit you
 * actually work in and letting the form convert is the difference between the
 * field being filled in and being skipped, and an empty dimension is why the
 * 3D gallery cannot hang anything at true scale.
 */
const UNITS = {
  cm: { label: "cm", toCm: 1 },
  in: { label: "inches", toCm: 2.54 },
  ft: { label: "feet", toCm: 30.48 },
} as const;

type UnitKey = keyof typeof UNITS;

function toCm(value: string, unit: UnitKey): number | null {
  const n = numOrNull(value);
  if (n == null) return null;
  // Rounded to the stored scale, numeric(8,2), so what is read back matches
  // what was typed rather than drifting by a hundredth.
  return Math.round(n * UNITS[unit].toCm * 100) / 100;
}

function fromCm(cm: number | null | undefined, unit: UnitKey): string {
  if (cm == null) return "";
  const v = cm / UNITS[unit].toCm;
  return String(Math.round(v * 1000) / 1000);
}

export function ArtworkForm({
  initial,
  allowMakerChoice = false,
  beneficiaries = [],
  orgOptions = [],
}: {
  initial?: ArtworkFormInitial;
  /** Org stores: let the person choose whether they are the credited maker. */
  allowMakerChoice?: boolean;
  /** The store's org's beneficiary list (migration 209). Empty hides the block. */
  beneficiaries?: BeneficiaryOption[];
  /** Orgs a donation can be recorded "to"; the store's own org first. */
  orgOptions?: OrgOption[];
}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [creditMe, setCreditMe] = React.useState(true);

  // Credit (not payment): a person searched by name or email.
  const [credited, setCredited] = React.useState<Person | null>(
    initial?.creditedArtistUserId
      ? { id: initial.creditedArtistUserId, name: initial.creditedArtistName ?? "Credited artist", email: null, slug: null }
      : null
  );
  const [creditQuery, setCreditQuery] = React.useState("");
  const [creditHits, setCreditHits] = React.useState<Person[]>([]);
  React.useEffect(() => {
    if (creditQuery.trim().length < 2) {
      setCreditHits([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchPeopleAction(creditQuery).then((r) => live && setCreditHits(r)).catch(() => live && setCreditHits([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [creditQuery]);

  const [estimateLow, setEstimateLow] = React.useState(
    initial?.estimateLow != null ? String(initial.estimateLow) : ""
  );
  const [estimateHigh, setEstimateHigh] = React.useState(
    initial?.estimateHigh != null ? String(initial.estimateHigh) : ""
  );

  // Donation: "donated by X to Y". Off unless the piece was donated.
  const [donated, setDonated] = React.useState(Boolean(initial?.donation));
  const [donorText, setDonorText] = React.useState(initial?.donation?.fromText ?? initial?.donation?.fromName ?? "");
  const [donorUserId, setDonorUserId] = React.useState<string | null>(initial?.donation?.fromUserId ?? null);
  const [donatedTo, setDonatedTo] = React.useState(initial?.donation?.toOrgId ?? orgOptions[0]?.id ?? "");
  const [donatedOn, setDonatedOn] = React.useState(initial?.donation?.occurredOn ?? "");
  const [donationNote, setDonationNote] = React.useState(initial?.donation?.note ?? "");

  const [beneficiaryId, setBeneficiaryId] = React.useState(initial?.beneficiaryPayeeId ?? "");
  const [beneficiaryScope, setBeneficiaryScope] = React.useState<"all_proceeds" | "commission">(
    initial?.beneficiaryScope ?? "all_proceeds"
  );

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
  const [unit, setUnit] = React.useState<UnitKey>("cm");
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
  const [currency, setCurrency] = React.useState<ArtworkFormInput["currency"]>(
    initial?.currency ?? "CAD"
  );
  const [inventory, setInventory] = React.useState(
    initial?.inventoryQty != null ? String(initial.inventoryQty) : "1"
  );
  /** Natural proportions of the lead photo, once the browser has measured it. */
  const [imageAspect, setImageAspect] = React.useState<number | null>(null);

  const [images, setImages] = React.useState<UploadedImage[]>(
    initial?.images ?? []
  );
  const [pending, setPending] = React.useState(false);
  // True while a photo is still uploading to Nextcloud. Without this, a tap
  // on mobile can submit before the PUT finishes and save a draft with no
  // image at all — see MultiImageUploader's onBusyChange.
  const [uploadingImages, setUploadingImages] = React.useState(false);

  function buildInput(): ArtworkFormInput {
    return {
      title,
      descriptionHtml,
      kind,
      yearCreated: numOrNull(year),
      medium: medium.trim() || null,
      style: style.trim() || null,
      subject: subject.trim() || null,
      heightCm: toCm(height, unit),
      widthCm: toCm(width, unit),
      depthCm: toCm(depth, unit),
      certificateOfAuthenticity: coa,
      provenanceNotes: provenance.trim() || null,
      price: Number(price) || 0,
      currency,
      inventoryQty: numOrNull(inventory) ?? 1,
      images: images.map((img) => ({
        url: img.url,
        nextcloudPath: img.path ?? null,
        nextcloudFileId: img.nextcloudFileId ?? null,
        alt: img.alt ?? null,
      })),
      creditMe: allowMakerChoice ? creditMe : undefined,
      creditedArtistUserId: credited?.id ?? null,
      estimateLow: numOrNull(estimateLow),
      estimateHigh: numOrNull(estimateHigh),
      donation: donated
        ? {
            fromUserId: donorUserId,
            fromText: donorUserId ? null : donorText.trim() || null,
            toOrgId: donatedTo || null,
            occurredOn: donatedOn || null,
            note: donationNote.trim() || null,
          }
        : null,
      beneficiaryPayeeId: beneficiaryId || null,
      beneficiaryScope: beneficiaryId ? beneficiaryScope : null,
    };
  }

  /** Re-express what is already typed when the unit changes, rather than
   *  silently reinterpreting "4" as four centimetres. */
  const changeUnit = (next: UnitKey) => {
    const convert = (v: string) => {
      const n = numOrNull(v);
      if (n == null) return v;
      return fromCm(n * UNITS[unit].toCm, next);
    };
    setHeight(convert(height));
    setWidth(convert(width));
    setDepth(convert(depth));
    setUnit(next);
  };

  const leadImage = images[0]?.url ?? null;

  React.useEffect(() => {
    if (!leadImage) {
      setImageAspect(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth && img.naturalHeight) {
        setImageAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.onerror = () => {
      if (!cancelled) setImageAspect(null);
    };
    // A sized variant is enough to measure proportions, and avoids pulling a
    // multi-megabyte master just to read two numbers off it.
    img.src = leadImage.includes("?") ? `${leadImage}&w=256` : `${leadImage}?w=256`;
    return () => {
      cancelled = true;
    };
  }, [leadImage]);

  const heightCm = toCm(height, unit);
  const widthCm = toCm(width, unit);
  const sizeSummary =
    heightCm != null && widthCm != null ? `${heightCm} × ${widthCm} cm` : null;

  /**
   * Tells the artist, before they save, what the gallery will actually do with
   * a photo whose proportions do not match the size they typed — the usual
   * cause being a detail crop rather than a shot of the whole canvas.
   */
  const ratioNote = React.useMemo(() => {
    if (imageAspect == null || heightCm == null || widthCm == null) return null;
    if (!(heightCm > 0) || !(widthCm > 0)) return null;

    const recorded = widthCm / heightCm;
    if (Math.abs(recorded - imageAspect) / recorded <= 0.02) return null;

    const shape = (r: number) =>
      r > 1.02 ? "landscape" : r < 0.98 ? "portrait" : "square";
    return (
      `Your photo is ${shape(imageAspect)} (${imageAspect.toFixed(2)}:1) but the size you entered is ` +
      `${shape(recorded)} (${recorded.toFixed(2)}:1). The gallery will not stretch the picture — it hangs ` +
      `the piece at the photo's shape instead, which makes it look smaller than it is. ` +
      `A photo of the whole canvas, uncropped, is what lets it hang at full size.`
    );
  }, [imageAspect, heightCm, widthCm]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("A title is required.");
    if (price.trim() && !(Number(price) >= 0))
      return toast.error("The price must be a number, or blank for price on request.");
    if (uploadingImages)
      return toast.error("Still uploading a photo — wait for it to finish before saving.");
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

  /** Create, then immediately publish — for someone who already knows this
   *  piece is ready and doesn't want the extra trip through the edit page. */
  async function handleCreateAndPublish() {
    if (!title.trim()) return toast.error("A title is required.");
    if (price.trim() && !(Number(price) >= 0))
      return toast.error("The price must be a number, or blank for price on request.");
    if (uploadingImages)
      return toast.error("Still uploading a photo — wait for it to finish before publishing.");
    setPending(true);
    try {
      const res = await createArtworkAction(buildInput());
      if (!res.ok || !res.id)
        return toast.error(res.error ?? "Failed to create.");
      const published = await publishArtworkAction(res.id);
      if (!published.ok) {
        toast.error(published.error ?? "Created as a draft, but publishing failed.");
        router.push(`/studio/artworks/${res.id}/edit`);
        return;
      }
      toast.success("Artwork published.");
      router.push(`/studio/artworks/${res.id}/edit`);
    } finally {
      setPending(false);
    }
  }

  async function handlePublish() {
    if (!initial?.id) return;
    if (uploadingImages)
      return toast.error("Still uploading a photo — wait for it to finish before publishing.");
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
          onBusyChange={setUploadingImages}
        />
        {images.length === 0 && !uploadingImages && (
          <p className="text-xs text-muted-foreground">
            No photo yet — the listing will show a placeholder until one is added.
          </p>
        )}
      </section>

      {allowMakerChoice && !isEdit && (
        <section className="space-y-2 rounded-lg border border-border p-4">
          <h2 className="font-serif text-xl">Who made it</h2>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={creditMe}
              onChange={(e) => setCreditMe(e.target.checked)}
            />
            <span>
              <span className="font-medium">Credit me as the maker.</span>{" "}
              <span className="text-muted-foreground">
                You are then the payee; the organisation takes a share only under
                an agreement you have accepted. Untick for work the organisation
                owns outright (collective prints, merchandise) — all proceeds are
                then earmarked to the organisation.
              </span>
            </span>
          </label>
        </section>
      )}

      {(allowMakerChoice || credited) && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="font-serif text-xl">Credited artist</h2>
          <p className="text-sm text-muted-foreground">
            Names the artist on the listing without paying them: the store keeps the
            proceeds. For donated work, or work the organisation holds. They can refuse the
            credit from their ArtDirect page.
          </p>
          {credited ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{credited.name}</span>
                {credited.email && <span className="ml-2 text-muted-foreground">{credited.email}</span>}
                {initial?.creditStatus === "rejected" && (
                  <span className="ml-2 text-xs text-destructive">declined the credit</span>
                )}
              </span>
              <button type="button" className="text-xs underline underline-offset-4" onClick={() => setCredited(null)}>
                Remove
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                className={inputCls}
                placeholder="Search by name or email…"
                value={creditQuery}
                onChange={(e) => setCreditQuery(e.target.value)}
              />
              {creditHits.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow">
                  {creditHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          setCredited(p);
                          setCreditQuery("");
                          setCreditHits([]);
                        }}
                      >
                        <span>{p.name}</span>
                        {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={donated} onChange={(e) => setDonated(e.target.checked)} />
          <span>
            <span className="font-medium">This piece was donated.</span>{" "}
            <span className="text-muted-foreground">Record who gave it and to whom; it shows on the listing.</span>
          </span>
        </label>
        {donated && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Donated by</label>
              <input
                className={inputCls}
                placeholder="Name (or pick the credited artist below)"
                value={donorText}
                onChange={(e) => {
                  setDonorText(e.target.value);
                  setDonorUserId(null);
                }}
              />
              {credited && donorUserId !== credited.id && (
                <button
                  type="button"
                  className="mt-1 text-xs underline underline-offset-4"
                  onClick={() => {
                    setDonorUserId(credited.id);
                    setDonorText(credited.name);
                  }}
                >
                  Donated by {credited.name}
                </button>
              )}
            </div>
            <div>
              <label className={labelCls}>Donated to</label>
              <select className={inputCls} value={donatedTo} onChange={(e) => setDonatedTo(e.target.value)}>
                <option value="">—</option>
                {orgOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={donatedOn} onChange={(e) => setDonatedOn(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Note</label>
              <input className={inputCls} value={donationNote} onChange={(e) => setDonationNote(e.target.value)} />
            </div>
          </div>
        )}
      </section>

      {beneficiaries.length > 0 && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="font-serif text-xl">Where the money goes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Beneficiary</label>
              <select className={inputCls} value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)}>
                <option value="">Ordinary sale (store and commission as usual)</option>
                {beneficiaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.kind === "charity" ? " (charity)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {beneficiaryId && (
              <div>
                <label className={labelCls}>How much</label>
                <select
                  className={inputCls}
                  value={beneficiaryScope}
                  onChange={(e) => setBeneficiaryScope(e.target.value as "all_proceeds" | "commission")}
                >
                  <option value="all_proceeds">All proceeds (less card fees)</option>
                  <option value="commission">The commission only</option>
                </select>
              </div>
            )}
          </div>
          {beneficiaryId && beneficiaryScope === "all_proceeds" && (
            <p className="text-xs text-muted-foreground">
              Nothing is paid to the maker or kept as commission; the whole price less processing fees is
              recorded for the beneficiary and paid out by the organisation.
            </p>
          )}
        </section>
      )}

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
            Price <span className="font-normal text-muted-foreground">(blank = price on request)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              className={priceInputCls}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Leave blank to show “price on request”"
            />
            <select
              aria-label="Currency"
              className={currencySelectCls}
              value={currency}
              onChange={(e) =>
                setCurrency(e.target.value as ArtworkFormInput["currency"])
              }
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
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

        <div className="sm:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Dimensions</span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Measured in
              <select
                aria-label="Unit of measurement"
                className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                value={unit}
                onChange={(e) => changeUnit(e.target.value as UnitKey)}
              >
                {(Object.keys(UNITS) as UnitKey[]).map((u) => (
                  <option key={u} value={u}>
                    {UNITS[u].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls} htmlFor="height">
                Height
              </label>
              <input
                id="height"
                type="number"
                step="any"
                className={inputCls}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="width">
                Width
              </label>
              <input
                id="width"
                type="number"
                step="any"
                className={inputCls}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="depth">
                Depth
              </label>
              <input
                id="depth"
                type="number"
                step="any"
                className={inputCls}
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </div>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {sizeSummary
              ? `Stored as ${sizeSummary}. Recording this is what lets the 3D gallery hang the piece at its real size.`
              : "Optional, but the 3D gallery can only hang a piece at its real size once height and width are recorded."}
          </p>

          {ratioNote && (
            <p className="mt-2 rounded-md bg-accent/40 p-2 text-xs text-foreground">
              {ratioNote}
            </p>
          )}
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

        <div className="sm:col-span-2">
          <label className={labelCls}>
            Auction estimate{" "}
            <span className="font-normal text-muted-foreground">(optional; shown as a range on a lot)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              className={inputCls}
              placeholder="Low"
              value={estimateLow}
              onChange={(e) => setEstimateLow(e.target.value)}
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="number"
              min="0"
              step="any"
              className={inputCls}
              placeholder="High"
              value={estimateHigh}
              onChange={(e) => setEstimateHigh(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={pending || uploadingImages}>
          {uploadingImages ? "Uploading photo…" : isEdit ? "Save changes" : "Create draft"}
        </Button>

        {!isEdit && (
          <Button
            type="button"
            variant="outline"
            onClick={handleCreateAndPublish}
            disabled={pending || uploadingImages}
          >
            {uploadingImages ? "Uploading photo…" : "Create & publish"}
          </Button>
        )}

        {isEdit && (
          <>
            <Button type="button" variant="outline" onClick={handlePublish} disabled={pending || uploadingImages}>
              {initial?.status === "available" ? "Re-publish" : "Publish"}
            </Button>
            {initial?.status !== "archived" && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleArchive}
                disabled={pending}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Archive
              </Button>
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
