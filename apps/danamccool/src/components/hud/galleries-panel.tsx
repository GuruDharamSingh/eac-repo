"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  addArtworksAction,
  addPicturesAction,
  createGalleryAction,
  deleteGalleryAction,
  getGalleryForHud,
  listCatalogueForHud,
  listGalleriesForHud,
  saveGalleryItemsAction,
  setGalleryItemOpensAction,
  updateGalleryAction,
  type HudArtwork,
  type HudGallery,
  type HudItem,
} from "@/lib/gallery-actions";
import { changeArtwork } from "@/lib/artwork-actions";

// ============================================================================
// Galleries — her collections, as a HUD.
//
// One component, mounted in the editor's left rail (beside Blocks and
// Outline), on /hub, and on /gallery for editors. Everything it changes is
// the same record, so an edit in one place is an edit everywhere:
//
//   a gallery      title, description, public or not, shown on IFAC or not,
//                  which page it belongs to
//   its items      add from her catalogue, upload into its folder, reorder,
//                  remove — artworks and plain pictures alike
//   an artwork     its title and how it is offered (for sale / portfolio /
//                  hidden), right on its tile — the same change
//                  /manage/artworks makes
//
// `currentPage` (in the editor): the gallery linked to that page opens first,
// and a page without one is offered "make this page a gallery".
// `onChanged`: called after any change, so the editor can refetch the blocks
// on its canvas that show galleries.
// ============================================================================

const MODE_LABEL: Record<HudArtwork["mode"], string> = {
  sale: "For sale",
  portfolio: "Portfolio",
  hidden: "Hidden",
  sold: "Sold",
  reserved: "Reserved",
};

function thumb(url: string | null | undefined) {
  if (!url) return undefined;
  return url.startsWith("/api/media/") && !url.includes("?") ? `${url}?w=256` : url;
}

export function GalleriesPanel({
  currentPage,
  currentTitle,
  onChanged,
  initialOpen,
}: {
  currentPage?: string;
  currentTitle?: string;
  onChanged?: () => void;
  /** A gallery to open straight away (e.g. /hub?gallery=<id>). */
  initialOpen?: string;
}) {
  const [galleries, setGalleries] = useState<HudGallery[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    const res = await listGalleriesForHud();
    if ("error" in res) {
      setError(res.error);
      return [];
    }
    setGalleries(res.galleries);
    return res.galleries;
  }, []);

  useEffect(() => {
    load().then((list) => {
      // In the editor, open this page's gallery straight away.
      const mine = currentPage ? list.find((g) => g.pagePath === currentPage) : null;
      if (mine) setOpenId(mine.id);
    });
  }, [load, currentPage]);

  const changed = useCallback(() => {
    void load();
    onChanged?.();
  }, [load, onChanged]);

  const pageGallery = currentPage ? galleries?.find((g) => g.pagePath === currentPage) : undefined;

  if (openId) {
    return (
      <GalleryDetail
        id={openId}
        onBack={() => {
          setOpenId(null);
          void load();
        }}
        onChanged={changed}
      />
    );
  }

  return (
    <div className="dm-hud dm-hud-stack">
      <div className="dm-hud-spread">
        <h2>Galleries</h2>
        <a className="dm-hud-muted" href="/gallery">
          Galleries index
        </a>
      </div>
      {error ? <p className="dm-hud-error">{error}</p> : null}

      {currentPage && galleries && !pageGallery ? (
        <div className="dm-hud-card">
          <div className="dm-hud-card-body">
            <p style={{ margin: 0 }}>This page is not a gallery.</p>
            <p className="dm-hud-muted" style={{ margin: 0 }}>
              Make it one to manage its works here and list it in the Galleries index.
            </p>
          </div>
          <button
            type="button"
            className="dm-hud-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await createGalleryAction(currentTitle || currentPage.split("/").pop()!.replace(/-/g, " "), {
                  pagePath: currentPage,
                });
                if ("error" in res) return setError(res.error);
                changed();
                setOpenId(res.id);
              })
            }
          >
            Make it a gallery
          </button>
        </div>
      ) : null}

      {galleries === null ? (
        <p className="dm-hud-muted">Loading…</p>
      ) : (
        <ul className="dm-hud-list" data-grid>
          {galleries.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="dm-hud-card"
                style={{ width: "100%", textAlign: "left", minHeight: 0 }}
                data-current={g.pagePath && g.pagePath === currentPage ? "true" : "false"}
                onClick={() => setOpenId(g.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="dm-hud-thumb" src={thumb(g.coverUrl)} alt="" loading="lazy" />
                <span className="dm-hud-card-body">
                  <span className="dm-hud-card-title" style={{ display: "block" }}>
                    {g.title}
                  </span>
                  <span className="dm-hud-row" style={{ marginTop: 2 }}>
                    <span className="dm-hud-chip">{g.itemCount} items</span>
                    {g.pagePath ? <span className="dm-hud-chip" data-tone="accent">/{g.pagePath}</span> : null}
                    {g.isPublic ? null : <span className="dm-hud-chip" data-tone="warn">not in index</span>}
                    {g.showOnIfac ? <span className="dm-hud-chip" data-tone="ok">IFAC</span> : null}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="dm-hud-row"
        onSubmit={(e) => {
          e.preventDefault();
          const t = newTitle.trim();
          if (!t) return;
          start(async () => {
            const res = await createGalleryAction(t);
            if ("error" in res) return setError(res.error);
            setNewTitle("");
            changed();
            setOpenId(res.id);
          });
        }}
      >
        <input
          type="text"
          placeholder="New gallery title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          aria-label="New gallery title"
          style={{ flex: 1, width: "auto" }}
        />
        <button type="submit" disabled={pending || !newTitle.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One gallery
// ---------------------------------------------------------------------------

function GalleryDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ gallery: HudGallery & { folder: string | null }; items: HudItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await getGalleryForHud(id);
    if ("error" in res) return setError(res.error);
    setData({ gallery: res.gallery, items: res.items });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | { ok: true } | { ok: false; error: string }>, done?: string) =>
    start(async () => {
      setError(null);
      const res = (await fn()) as { ok: boolean; error?: string };
      if (!res.ok) return setError(res.error ?? "Could not save.");
      if (done) setNotice(done);
      await load();
      onChanged();
    });

  const saveItems = (items: HudItem[]) =>
    run(() =>
      saveGalleryItemsAction(
        id,
        items.map((i) => ({ id: i.key, url: i.url, title: i.title, ...(i.artwork ? { artworkId: i.artwork.id } : {}) }))
      )
    );

  if (!data) {
    return (
      <div className="dm-hud">
        <button type="button" onClick={onBack}>
          ← All galleries
        </button>
        <p className="dm-hud-muted" style={{ marginTop: 8 }}>
          {error ?? "Loading…"}
        </p>
      </div>
    );
  }

  const { gallery: g, items } = data;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = items.slice();
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setData({ gallery: g, items: next });
    saveItems(next);
  };

  return (
    <div className="dm-hud dm-hud-stack">
      <div className="dm-hud-spread">
        <button type="button" onClick={onBack}>
          ← All galleries
        </button>
        {g.pagePath ? (
          <a href={`/${g.pagePath}`} target="_blank" rel="noopener noreferrer" className="dm-hud-muted">
            View page ↗
          </a>
        ) : null}
      </div>

      <GallerySettings gallery={g} pending={pending} onSave={(patch) => run(() => updateGalleryAction(g.id, patch), "Saved.")} />

      {error ? <p className="dm-hud-error">{error}</p> : null}
      {notice && !error ? <p className="dm-hud-muted">{notice}</p> : null}

      <div className="dm-hud-spread">
        <h3 style={{ margin: 0 }}>
          {items.length} item{items.length === 1 ? "" : "s"}
        </h3>
        <div className="dm-hud-row">
          <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            {adding ? "Done adding" : "+ From catalogue"}
          </button>
          <UploadButton
            gallerySlug={g.slug}
            onUploaded={(url, title) =>
              run(() => addPicturesAction(g.id, [{ url, title }]), "Uploaded.")
            }
          />
        </div>
      </div>

      {adding ? (
        <CataloguePicker
          exclude={new Set(items.map((i) => i.artwork?.id).filter(Boolean) as string[])}
          onAdd={(ids) => run(() => addArtworksAction(g.id, ids), `Added ${ids.length}.`)}
        />
      ) : null}

      {items.length === 0 ? (
        <p className="dm-hud-muted">Nothing here yet — add from the catalogue, or upload.</p>
      ) : (
        <ul className="dm-hud-items">
          {items.map((it, n) => (
            <li key={it.key} className="dm-hud-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(it.url)} alt="" loading="lazy" />
              <div className="dm-hud-item-body">
                {it.artwork ? (
                  <ArtworkEditor artwork={it.artwork} pending={pending} onDone={() => { void load(); onChanged(); }} onError={setError} />
                ) : (
                  <>
                    <input
                      type="text"
                      defaultValue={it.title}
                      aria-label="Caption"
                      placeholder="Caption"
                      onBlur={(e) => {
                        const title = e.target.value.trim();
                        if (title === it.title) return;
                        saveItems(items.map((x) => (x.key === it.key ? { ...x, title } : x)));
                      }}
                    />
                    <span className="dm-hud-chip" style={{ marginTop: 4 }}>
                      Picture
                    </span>
                  </>
                )}
                <OpensSelect
                  value={it.opens}
                  exclude={g.id}
                  disabled={pending}
                  onChange={(opens) => run(() => setGalleryItemOpensAction(g.id, it.key, opens), opens ? "Linked." : "Unlinked.")}
                />
                <div className="dm-hud-item-tools">
                  <button type="button" aria-label="Move earlier" disabled={pending || n === 0} onClick={() => move(n, n - 1)}>
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Move later"
                    disabled={pending || n === items.length - 1}
                    onClick={() => move(n, n + 1)}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    aria-label="Remove from this gallery"
                    title="Remove from this gallery (the file and the artwork stay)"
                    disabled={pending}
                    onClick={() => saveItems(items.filter((x) => x.key !== it.key))}
                    style={{ marginLeft: "auto" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details>
        <summary>Delete this gallery</summary>
        <div>
          <p className="dm-hud-muted">
            The gallery goes; its files and the artworks in it stay. A page showing it will show nothing until it is
            linked to another.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete the gallery “${g.title}”?`)) return;
              start(async () => {
                const res = await deleteGalleryAction(g.id);
                if ("error" in res) return setError(res.error);
                onChanged();
                onBack();
              });
            }}
          >
            Delete gallery
          </button>
        </div>
      </details>
    </div>
  );
}

/**
 * "Opens a gallery" for one picture: in the full-size view, visitors can go
 * into that gallery instead of stepping on through this one. Her galleries,
 * minus the one the picture is in.
 */
export function OpensSelect({
  value,
  exclude,
  disabled,
  onChange,
}: {
  value?: string;
  exclude: string | null;
  disabled?: boolean;
  onChange: (opens: string | null) => void;
}) {
  const [galleries, setGalleries] = useState<HudGallery[] | null>(null);
  useEffect(() => {
    listGalleriesForHud().then((res) => setGalleries("error" in res ? [] : res.galleries));
  }, []);
  return (
    <label className="dm-hud-opens">
      <span>Opens</span>
      <select
        value={value ?? ""}
        disabled={disabled || galleries === null}
        onChange={(e) => onChange(e.target.value || null)}
        title="In the full-size view, visitors can go into this gallery instead of stepping on through this one"
      >
        <option value="">— no nested gallery —</option>
        {(galleries ?? [])
          .filter((x) => x.id !== exclude)
          .map((x) => (
            <option key={x.id} value={x.id}>
              {x.title} ({x.itemCount})
            </option>
          ))}
      </select>
    </label>
  );
}

function GallerySettings({
  gallery: g,
  pending,
  onSave,
}: {
  gallery: HudGallery & { folder: string | null };
  pending: boolean;
  onSave: (patch: Parameters<typeof updateGalleryAction>[1]) => void;
}) {
  const [title, setTitle] = useState(g.title);
  const [description, setDescription] = useState(g.description ?? "");
  const [page, setPage] = useState(g.pagePath ?? "");
  useEffect(() => {
    setTitle(g.title);
    setDescription(g.description ?? "");
    setPage(g.pagePath ?? "");
  }, [g.id, g.title, g.description, g.pagePath]);

  const dirty = title !== g.title || description !== (g.description ?? "") || page !== (g.pagePath ?? "");

  return (
    <div className="dm-hud-stack">
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Gallery title" />
      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="A few words about this gallery (optional)"
        aria-label="Description"
      />
      <label className="dm-hud-muted" style={{ display: "block" }}>
        Its page
        <input
          type="text"
          value={page}
          onChange={(e) => setPage(e.target.value.toLowerCase())}
          placeholder="e.g. figurative — leave empty for none"
          style={{ marginTop: 2 }}
        />
      </label>
      {dirty ? (
        <button
          type="button"
          className="dm-hud-primary"
          disabled={pending}
          onClick={() => onSave({ title, description: description || null, pagePath: page.replace(/^\/+/, "") || null })}
        >
          Save
        </button>
      ) : null}
      <label className="dm-hud-check">
        <input type="checkbox" checked={g.isPublic} disabled={pending} onChange={(e) => onSave({ isPublic: e.target.checked })} />
        Listed in the Galleries index
      </label>
      <label className="dm-hud-check">
        <input
          type="checkbox"
          checked={g.showOnIfac}
          disabled={pending}
          onChange={(e) => onSave({ showOnIfac: e.target.checked })}
        />
        Also show on her IFAC profile
      </label>
      {g.folder ? <p className="dm-hud-muted">Uploads go to her folder: {g.folder}/</p> : null}
    </div>
  );
}

/** An artwork's own record, edited right on its tile. Dana or an owner only. */
function ArtworkEditor({
  artwork,
  pending,
  onDone,
  onError,
}: {
  artwork: HudArtwork;
  pending: boolean;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, start] = useTransition();
  const save = (patch: { title?: string; mode?: string }) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", artwork.id);
      if (patch.title !== undefined) fd.set("title", patch.title);
      if (patch.mode !== undefined) fd.set("mode", patch.mode);
      const res = await changeArtwork(fd);
      if ("error" in res) onError(res.error);
      else onDone();
    });
  const locked = artwork.mode === "sold" || artwork.mode === "reserved";
  return (
    <>
      <input
        type="text"
        defaultValue={artwork.title}
        aria-label="Artwork title"
        onBlur={(e) => {
          const t = e.target.value.trim();
          if (t && t !== artwork.title) save({ title: t });
        }}
      />
      <div className="dm-hud-row" style={{ marginTop: 4 }}>
        {locked ? (
          <span className="dm-hud-chip">{MODE_LABEL[artwork.mode]}</span>
        ) : (
          <select
            value={artwork.mode}
            disabled={pending || busy}
            aria-label="How it is offered"
            onChange={(e) => save({ mode: e.target.value })}
            style={{ width: "auto", flex: 1 }}
          >
            <option value="sale">For sale</option>
            <option value="portfolio">Portfolio only</option>
            <option value="hidden">Hidden</option>
          </select>
        )}
        {!artwork.titleConfirmed ? (
          <span className="dm-hud-chip" data-tone="warn" title="A working title from the move — edit or re-type to confirm">
            working title
          </span>
        ) : null}
      </div>
    </>
  );
}

function CataloguePicker({ exclude, onAdd }: { exclude: Set<string>; onAdd: (ids: string[]) => void }) {
  const [all, setAll] = useState<HudArtwork[] | null>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => {
    listCatalogueForHud().then((res) => setAll("error" in res ? [] : res.artworks));
  }, []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all ?? []).filter((a) => !exclude.has(a.id) && (!q || a.title.toLowerCase().includes(q)));
  }, [all, query, exclude]);

  return (
    <div className="dm-hud-stack" style={{ border: "1px solid var(--hud-line)", borderRadius: 6, padding: 8, background: "#fff" }}>
      <input type="search" placeholder="Search her artworks" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search her artworks" />
      {all === null ? (
        <p className="dm-hud-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="dm-hud-muted">Nothing left to add.</p>
      ) : (
        <ul className="dm-hud-pick">
          {shown.map((a) => {
            const on = chosen.includes(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  title={`${a.title} — ${MODE_LABEL[a.mode]}`}
                  onClick={() => setChosen((c) => (on ? c.filter((x) => x !== a.id) : [...c, a.id]))}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(a.image)} alt="" loading="lazy" />
                  <span>{a.title}</span>
                  <span className="dm-hud-muted">{MODE_LABEL[a.mode]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className="dm-hud-primary"
        disabled={chosen.length === 0}
        onClick={() => {
          onAdd(chosen);
          setChosen([]);
        }}
      >
        Add {chosen.length || ""} to this gallery
      </button>
    </div>
  );
}

function UploadButton({ gallerySlug, onUploaded }: { gallerySlug: string; onUploaded: (url: string, title: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="dm-hud-btn" style={{ position: "relative" }} title={err ?? "Upload into this gallery's folder"}>
      {busy ? "Uploading…" : err ? "Upload failed" : "+ Upload"}
      <input
        type="file"
        accept="image/*"
        disabled={busy}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setErr(null);
          const fd = new FormData();
          fd.set("file", file);
          fd.set("gallery", gallerySlug);
          try {
            const res = await fetch("/api/media/upload", { method: "POST", body: fd });
            const body = (await res.json()) as { url?: string; error?: string };
            if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed");
            onUploaded(body.url, file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}
