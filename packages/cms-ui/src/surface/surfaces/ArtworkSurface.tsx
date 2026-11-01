"use client";

import * as React from "react";
import type { SurfaceArtworkInput } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";

// ============================================================================
// Add a work — several, without leaving.
//
// The short form a collector asks first: a photo, title, medium, year, size,
// kind, price, a few lines. The rail on the left is the QUEUE: every piece
// started in this sitting, with its state. "Add another" saves the current
// piece as a draft first (so nothing typed is lost if the tab closes), then
// clears the form; "Publish all" saves the current piece and publishes every
// draft in the queue. Dimensions beyond height × width, editions, provenance
// and more photos are on the work's page in Studio afterwards.
//
// The host's `connectors.artwork` does every write through commerce
// (`createArtwork` / `updateArtwork` / `publishArtwork`): this surface never
// knows about stores or tables. A person with no store is offered the
// one-click store from the journey connector when the host has it.
//
// Center redesign, 2026-10-18 (mock-up H).
// ============================================================================

type Piece = {
  key: number;
  id: string | null;
  state: "editing" | "draft" | "published";
  fields: SurfaceArtworkInput;
};

const EMPTY: SurfaceArtworkInput = {
  title: "",
  imageUrl: "",
  medium: "",
  yearCreated: "",
  heightCm: "",
  widthCm: "",
  kind: "original",
  price: "",
  descriptionHtml: "",
};

const KINDS = [
  { value: "original", label: "Original — one of one" },
  { value: "limited_edition", label: "Limited edition" },
  { value: "open_edition", label: "Open edition / print" },
] as const;

let nextKey = 1;

export function ArtworkSurface() {
  const { connectors, pop } = useSurface();
  const layer = useLayer();
  const api = connectors.artwork;
  const media = connectors.composeSlots?.media;

  const [gate, setGate] = React.useState<Awaited<ReturnType<NonNullable<typeof api>["checkStore"]>> | null>(null);
  const [pieces, setPieces] = React.useState<Piece[]>([{ key: nextKey++, id: null, state: "editing", fields: EMPTY }]);
  const [current, setCurrent] = React.useState(0);
  const [busy, setBusy] = React.useState<"draft" | "publish" | "store" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"normal" | "error">("normal");

  React.useEffect(() => {
    layer.setMeta({ title: "Add a work", kind: "product", size: "wide" });
  }, [layer]);

  const checkStore = React.useCallback(() => {
    if (!api) return;
    api
      .checkStore()
      .then(setGate)
      .catch(() => setGate({ ok: false }));
  }, [api]);
  React.useEffect(() => {
    checkStore();
  }, [checkStore]);

  const piece = pieces[current];
  const set = <K extends keyof SurfaceArtworkInput>(k: K, v: SurfaceArtworkInput[K]) =>
    setPieces((ps) => ps.map((p, i) => (i === current ? { ...p, state: p.state === "published" ? p.state : "editing", fields: { ...p.fields, [k]: v } } : p)));

  function fail(msg: string) {
    setTone("error");
    setNotice(msg);
  }
  function say(msg: string) {
    setTone("normal");
    setNotice(msg);
  }

  /** Save the piece at `index` as a draft; returns its id or null when there is nothing to save. */
  async function saveAt(index: number): Promise<string | null | false> {
    const p = pieces[index];
    if (!api || !p) return null;
    const f = p.fields;
    const blank = !f.title.trim() && !f.imageUrl.trim();
    if (blank) return null;
    if (f.title.trim().length < 2) {
      fail("Give the piece a title first.");
      return false;
    }
    const r = await api.saveDraft(f, p.id).catch(() => ({ ok: false as const, error: "Could not save that piece." }));
    if (r.ok === false) {
      fail(r.error);
      return false;
    }
    setPieces((ps) => ps.map((x, i) => (i === index ? { ...x, id: r.id, state: x.state === "published" ? "published" : "draft" } : x)));
    return r.id;
  }

  async function addAnother() {
    setBusy("draft");
    setNotice(null);
    const saved = await saveAt(current);
    setBusy(null);
    if (saved === false) return;
    const key = nextKey++;
    setPieces((ps) => [...ps, { key, id: null, state: "editing", fields: EMPTY }]);
    setCurrent(pieces.length);
    if (saved) say("Saved as a draft. Next one.");
  }

  async function saveDrafts() {
    setBusy("draft");
    setNotice(null);
    const saved = await saveAt(current);
    setBusy(null);
    if (saved === false) return;
    say(saved ? "Saved as a draft." : "Nothing to save yet.");
    connectors.onMutated?.();
  }

  async function publishAll() {
    if (!api) return;
    setBusy("publish");
    setNotice(null);
    const saved = await saveAt(current);
    if (saved === false) return setBusy(null);
    const ids = pieces
      .map((p, i) => (i === current ? saved || p.id : p.id))
      .filter((id, i): id is string => Boolean(id) && pieces[i].state !== "published");
    if (ids.length === 0) {
      setBusy(null);
      return fail("Nothing to publish yet: add a title and a photo.");
    }
    const r = await api.publish(ids).catch(() => ({ ok: false as const, error: "Could not publish." }));
    setBusy(null);
    if (r.ok === false) return fail(r.error);
    setPieces((ps) => ps.map((p) => (p.id && ids.includes(p.id) ? { ...p, state: "published" } : p)));
    say(`Published ${ids.length} ${ids.length === 1 ? "work" : "works"}.`);
    connectors.onMutated?.();
  }

  async function openStore() {
    const j = connectors.journey;
    if (!j) return;
    setBusy("store");
    const r = await j.publishStore().catch(() => ({ ok: false as const, error: "Could not open a store." }));
    setBusy(null);
    if (r.ok === false) return fail(r.error);
    checkStore();
    connectors.onMutated?.();
  }

  if (!api) {
    return (
      <SurfaceFrame kind="product" title="Add a work" kicker="Selling art">
        <p className="eac-surface-empty">This site does not catalogue work. Use the marketplace studio.</p>
      </SurfaceFrame>
    );
  }
  if (!gate) {
    return (
      <SurfaceFrame kind="product" title="Add a work" kicker="Selling art">
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }
  if (!gate.ok) {
    return (
      <SurfaceFrame kind="product" title="Add a work" kicker="Selling art">
        <div className="eac-artwork-gate">
          {gate.reason === "store-pending" ? (
            <p>Your store is waiting for review. You can catalogue work once it is open.</p>
          ) : gate.canOpenStore && connectors.journey ? (
            <>
              <p>You have no store yet. One click opens one on the marketplace under your name; the collective keeps 5% of each sale.</p>
              <button type="button" className="eac-btn eac-btn--primary" disabled={busy === "store"} onClick={openStore}>
                {busy === "store" ? "…" : "Open your store"}
              </button>
            </>
          ) : (
            <p>A store is for members of the collective. Join an organisation first, then come back here.</p>
          )}
          {notice && <p className="eac-artwork-notice" data-tone={tone}>{notice}</p>}
        </div>
      </SurfaceFrame>
    );
  }

  const published = pieces.filter((p) => p.state === "published").length;
  const rail = (
    <div className="eac-artwork-rail">
      <div className="eac-artwork-rail-head">
        <span className="eac-artwork-rail-kicker">Selling art · step 1</span>
        <span className="eac-artwork-rail-title">This sitting</span>
      </div>
      <ol className="eac-artwork-queue">
        {pieces.map((p, i) => (
          <li key={p.key}>
            <button type="button" className="eac-artwork-queue-item" data-current={i === current || undefined} data-state={p.state} onClick={() => setCurrent(i)}>
              {p.fields.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.fields.imageUrl} alt="" />
              ) : (
                <span className="eac-artwork-queue-blank" aria-hidden />
              )}
              <span className="eac-artwork-queue-text">
                <span>{p.fields.title.trim() || "Untitled"}</span>
                <em>{p.state === "published" ? "published" : p.state === "draft" ? "draft" : i === current ? "editing" : "unsaved"}</em>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="eac-artwork-add" disabled={busy !== null} onClick={addAnother}>
        + Add another work
      </button>
      <p className="eac-artwork-rail-note">
        Each piece is saved as a draft when you start the next one. Editions, provenance and more photos are on the work&rsquo;s page in Studio afterwards.
      </p>
      {published > 0 && <p className="eac-artwork-rail-note">{published} published this sitting.</p>}
    </div>
  );

  const f = piece.fields;
  const readOnly = piece.state === "published";

  return (
    <SurfaceFrame
      kind="product"
      title="Add a work"
      kicker="Selling art"
      rail={rail}
      status={notice}
      statusTone={tone}
      actions={[
        { label: "Done", quiet: true, onClick: () => pop() },
        { label: busy === "draft" ? "…" : "Save as draft", onClick: saveDrafts, disabled: busy !== null || readOnly },
        { label: busy === "publish" ? "…" : "Publish all", primary: true, onClick: publishAll, disabled: busy !== null },
      ]}
    >
      <div className="eac-artwork-form" aria-live="polite">
        <div className="eac-artwork-photo">
          {media ? (
            media({
              value: f.imageUrl || undefined,
              onChange: (url: unknown) => set("imageUrl", typeof url === "string" ? url : ""),
              label: "Photo",
              hint: "The main photograph, straight on.",
            })
          ) : (
            <label className="eac-artwork-field">
              <span>Photo URL</span>
              <input value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://" readOnly={readOnly} />
            </label>
          )}
        </div>
        <div className="eac-artwork-fields">
          <label className="eac-artwork-field eac-artwork-field--wide">
            <span>Title</span>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Untitled" readOnly={readOnly} />
          </label>
          <label className="eac-artwork-field">
            <span>Medium</span>
            <input value={f.medium} onChange={(e) => set("medium", e.target.value)} placeholder="Oil on linen" readOnly={readOnly} />
          </label>
          <label className="eac-artwork-field">
            <span>Year</span>
            <input value={f.yearCreated} onChange={(e) => set("yearCreated", e.target.value)} inputMode="numeric" placeholder="2026" readOnly={readOnly} />
          </label>
          <label className="eac-artwork-field">
            <span>Height (cm)</span>
            <input value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} inputMode="decimal" readOnly={readOnly} />
          </label>
          <label className="eac-artwork-field">
            <span>Width (cm)</span>
            <input value={f.widthCm} onChange={(e) => set("widthCm", e.target.value)} inputMode="decimal" readOnly={readOnly} />
          </label>
          <label className="eac-artwork-field">
            <span>Kind</span>
            <select value={f.kind} onChange={(e) => set("kind", e.target.value as SurfaceArtworkInput["kind"])} disabled={readOnly}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="eac-artwork-field">
            <span>Price</span>
            <input value={f.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" placeholder="blank = price on request" readOnly={readOnly} />
          </label>
          <label className="eac-artwork-field eac-artwork-field--wide">
            <span>About the work</span>
            <textarea value={f.descriptionHtml} onChange={(e) => set("descriptionHtml", e.target.value)} placeholder="A few lines a collector would want to read." readOnly={readOnly} />
          </label>
        </div>
      </div>
    </SurfaceFrame>
  );
}
