"use client";

import { FieldLabel, useGetPuck } from "@puckeditor/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaBrowser } from "@elkdonis/cms-ui/files";
import {
  addPicturesAction,
  copyPicturesToGalleryAction,
  createSubGalleryAction,
  galleryForPageAction,
  getGalleryForHud,
  listGalleriesForHud,
  removeGalleryPicturesAction,
  setGalleryItemOpensAction,
  updateGalleryAction,
  updateGalleryItemTextAction,
  type HudGallery,
  type HudItem,
} from "@/lib/gallery-actions";

// ============================================================================
// "Pictures" — the Gallery grid block's own panel, in the editor's right column.
//
// Three parts, top to bottom:
//
//   Add pictures    browse the site's and Dana's Nextcloud folders (the same
//                   browser as every picture field) and add a batch at once.
//   Sub-galleries   galleries that one picture of this one OPENS. Make a new
//                   one here — name it, choose its pictures, pick the cover
//                   that stays in this gallery — or change what is in one.
//   Pictures        every picture as a card: the picture, its title and its
//                   caption, edited in place.
//
// Everything is written to the GALLERY as it happens (not on Publish): the
// words and groupings belong to the pictures, and every page showing the
// gallery gets them. The canvas refetches the block after each change.
//
// An artwork's title is the artwork's — changed where its listing is — so it
// is shown, not edited, here. Its caption is this gallery's.
// ============================================================================

const SOURCES = [
  { key: "site", label: "Site images", endpoint: "/api/media/library" },
  { key: "mine", label: "Dana's images", endpoint: "/api/media/library/mine" },
];

function thumb(url: string, w = 256) {
  return url.startsWith("/api/media/") ? `${url}?w=${w}` : url;
}

type Note = { text: string; error?: boolean } | null;

/**
 * The pictures as the grid shows them — row by row, left to right — rather
 * than in storage order, which after any rearranging matches nothing she sees.
 * Pictures never placed by hand keep their stored order, after the rest.
 */
function inGridOrder(items: HudItem[]): HudItem[] {
  const far = Number.MAX_SAFE_INTEGER;
  return items
    .map((it, n) => ({ it, n }))
    .sort((a, b) => (a.it.y ?? far) - (b.it.y ?? far) || (a.it.x ?? far) - (b.it.x ?? far) || a.n - b.n)
    .map(({ it }) => it);
}

export function GalleryPicturesField({ field }: { field?: { label?: string } }) {
  const getPuck = useGetPuck();
  const [galleryId, setGalleryId] = useState<string | null | undefined>(undefined);
  const [galleryTitle, setGalleryTitle] = useState("");
  const [items, setItems] = useState<HudItem[] | null>(null);
  const [galleries, setGalleries] = useState<HudGallery[]>([]);
  const [note, setNote] = useState<Note>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<"add" | "new" | null>(null);

  const refreshCanvas = useCallback(() => {
    const id = (getPuck().selectedItem?.props as { id?: string } | undefined)?.id;
    if (id) getPuck().resolveDataById(id, "force");
  }, [getPuck]);

  const reload = useCallback(async (id: string) => {
    const [g, all] = await Promise.all([getGalleryForHud(id), listGalleriesForHud()]);
    if ("error" in g) return setNote({ text: g.error, error: true });
    setItems(inGridOrder(g.items));
    setGalleryTitle(g.gallery.title);
    if (!("error" in all)) setGalleries(all.galleries);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const chosen = (getPuck().selectedItem?.props as { gallery?: string } | undefined)?.gallery;
      let id: string | null = chosen || null;
      if (!id) {
        const slug = decodeURIComponent(window.location.pathname.replace(/^\/studio\/?/, "")) || "home";
        const res = await galleryForPageAction(slug);
        if ("error" in res) return live && setNote({ text: res.error, error: true });
        id = res.id;
      }
      if (!live) return;
      setGalleryId(id);
      if (id) await reload(id);
    })();
    return () => {
      live = false;
    };
  }, [getPuck, reload]);

  /** After any write: reload the list, redraw the canvas, say what happened. */
  const after = useCallback(
    async (res: { ok: boolean; error?: string } | { ok: false; error: string }, text: string) => {
      if ("error" in res && res.error) return setNote({ text: res.error, error: true });
      setNote({ text });
      if (galleryId) await reload(galleryId);
      refreshCanvas();
    },
    [galleryId, reload, refreshCanvas]
  );

  const saveText = useCallback(
    async (item: HudItem, patch: { title?: string; subtitle?: string }) => {
      if (!galleryId) return;
      const res = await updateGalleryItemTextAction(galleryId, item.key, patch);
      if ("error" in res) return setNote({ text: res.error, error: true });
      setItems((list) => (list ?? []).map((i) => (i.key === item.key ? { ...i, ...patch } : i)));
      setNote({ text: "Saved." });
      refreshCanvas();
    },
    [galleryId, refreshCanvas]
  );

  const byId = useMemo(() => new Map(galleries.map((g) => [g.id, g])), [galleries]);
  const subs = useMemo(() => (items ?? []).filter((i) => i.opens), [items]);

  const shown = (items ?? []).filter((i) => {
    const q = query.trim().toLowerCase();
    return !q || `${i.title} ${i.subtitle ?? ""} ${i.url}`.toLowerCase().includes(q);
  });

  return (
    <FieldLabel label={field?.label ?? "Pictures"} el="div">
      <div className="dm-gp">
        {note ? (
          <p className="dm-gp-note" data-error={note.error ? "true" : undefined} role="status">
            {note.text}
          </p>
        ) : null}

        {galleryId === null ? (
          <p className="dm-gp-muted">
            No gallery is linked to this page. Choose one above, or make this page a gallery in the Galleries tab.
          </p>
        ) : items === null ? (
          <p className="dm-gp-muted">Loading…</p>
        ) : (
          <>
            <p className="dm-gp-muted">
              {items.length} pictures in <strong>{galleryTitle}</strong>. Order, size and framing are arranged on the published page
              while signed in.
            </p>

            {/* ---- Add pictures ---- */}
            <div className="dm-gp-actions">
              <button type="button" aria-expanded={open === "add"} onClick={() => setOpen(open === "add" ? null : "add")}>
                + Add pictures
              </button>
              <button type="button" aria-expanded={open === "new"} onClick={() => setOpen(open === "new" ? null : "new")}>
                + New sub-gallery
              </button>
            </div>
            {open === "add" && galleryId ? (
              <AddPictures
                onAdd={async (files) => {
                  const res = await addPicturesAction(
                    galleryId,
                    files.map((f) => ({ url: f.url, title: f.name.replace(/\.[^.]+$/, "") }))
                  );
                  await after(res, "error" in res ? "" : `Added ${res.added} picture${res.added === 1 ? "" : "s"}.`);
                  setOpen(null);
                }}
              />
            ) : null}
            {open === "new" && galleryId ? (
              <NewSubGallery
                parentId={galleryId}
                parentTitle={galleryTitle}
                items={items}
                galleries={galleries}
                onDone={async (res, text) => {
                  await after(res, text);
                  if (res.ok) setOpen(null);
                }}
              />
            ) : null}

            {/* ---- Sub-galleries ---- */}
            <section className="dm-gp-section">
              <h4>Sub-galleries</h4>
              {subs.length === 0 ? (
                <p className="dm-gp-muted">
                  None yet. A sub-gallery is a set of pictures one picture here opens: in the slideshow, visitors can step into it.
                </p>
              ) : (
                <ul className="dm-gp-subs">
                  {subs.map((cover) => (
                    <SubGalleryRow
                      key={cover.key}
                      parentId={galleryId!}
                      parentItems={items}
                      cover={cover}
                      gallery={byId.get(cover.opens!)}
                      onChanged={after}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* ---- Pictures ---- */}
            <section className="dm-gp-section">
              <h4>Pictures, titles and captions</h4>
              <input
                type="search"
                placeholder="Find a picture"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Find a picture"
                className="dm-gp-input"
              />
              <ul className="dm-gp-cards">
                {shown.map((it) => (
                  <PictureCard
                    key={it.key}
                    item={it}
                    opensTitle={it.opens ? byId.get(it.opens)?.title : undefined}
                    onText={(patch) => void saveText(it, patch)}
                    onRemove={async () => {
                      if (!galleryId) return;
                      if (!window.confirm(`Take “${it.title || "this picture"}” out of ${galleryTitle}? The file stays in storage.`)) return;
                      const res = await removeGalleryPicturesAction(galleryId, [it.key]);
                      await after(res, "Taken out of the gallery.");
                    }}
                  />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </FieldLabel>
  );
}

// ---------------------------------------------------------------------------

function PictureCard({
  item,
  opensTitle,
  onText,
  onRemove,
}: {
  item: HudItem;
  opensTitle?: string;
  onText: (patch: { title?: string; subtitle?: string }) => void;
  onRemove: () => void;
}) {
  return (
    <li className="dm-gp-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb(item.url, 320)} alt="" loading="lazy" className="dm-gp-card-img" />
      <div className="dm-gp-card-fields">
        {item.artwork ? (
          <p className="dm-gp-artwork" title="An artwork's title is changed in Artwork listings">
            <em>{item.title}</em> <span>· artwork</span>
          </p>
        ) : (
          <label>
            <span>Title</span>
            <input
              type="text"
              className="dm-gp-input"
              defaultValue={item.title}
              placeholder="Title"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== item.title) onText({ title: v });
              }}
            />
          </label>
        )}
        <label>
          <span>Caption</span>
          <textarea
            className="dm-gp-input"
            rows={2}
            defaultValue={item.subtitle ?? ""}
            placeholder="Shown under the picture — medium, year, a line about it"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (item.subtitle ?? "")) onText({ subtitle: v });
            }}
          />
        </label>
        <div className="dm-gp-card-foot">
          {opensTitle ? <span className="dm-gp-chip">opens “{opensTitle}”</span> : <span />}
          <button type="button" className="dm-gp-link" onClick={onRemove}>
            Take out
          </button>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

/** Browse the site's and Dana's folders; choose several; add them. */
function AddPictures({ onAdd }: { onAdd: (files: Array<{ url: string; name: string }>) => Promise<void> }) {
  const [source, setSource] = useState(SOURCES[0]!.key);
  const [picked, setPicked] = useState<Array<{ url: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const endpoint = SOURCES.find((s) => s.key === source)!.endpoint;
  return (
    <div className="dm-gp-panel eac-picker">
      <div className="eac-picker-tabs" role="tablist">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={source === s.key}
            className={source === s.key ? "is-active" : undefined}
            onClick={() => setSource(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <MediaBrowser
        key={endpoint}
        endpoint={endpoint}
        picked={picked.map((p) => p.url)}
        onToggle={(item) =>
          setPicked((list) => (list.some((p) => p.url === item.url) ? list.filter((p) => p.url !== item.url) : [...list, item]))
        }
      />
      <div className="dm-gp-actions">
        <button
          type="button"
          className="dm-gp-primary"
          disabled={!picked.length || busy}
          onClick={async () => {
            setBusy(true);
            await onAdd(picked);
            setBusy(false);
            setPicked([]);
          }}
        >
          {busy ? "Adding…" : `Add ${picked.length || ""} to this gallery`}
        </button>
        {picked.length ? (
          <button type="button" onClick={() => setPicked([])}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Choose some of this gallery's pictures, in the order clicked. */
function ChooseFrom({
  items,
  chosen,
  cover,
  onToggle,
  onCover,
}: {
  items: HudItem[];
  chosen: string[];
  cover?: string;
  onToggle: (key: string) => void;
  onCover?: (key: string) => void;
}) {
  const [q, setQ] = useState("");
  const shown = items.filter((i) => !q.trim() || `${i.title} ${i.subtitle ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="dm-gp-choose">
      <input type="search" className="dm-gp-input" placeholder="Find a picture" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a picture" />
      <ul className="dm-gp-grid">
        {shown.map((i) => {
          const on = chosen.includes(i.key);
          return (
            <li key={i.key}>
              <button type="button" aria-pressed={on} onClick={() => onToggle(i.key)} title={i.title} className={on ? "is-on" : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(i.url, 200)} alt="" loading="lazy" />
                {on ? <span className="dm-gp-check">{cover === i.key ? "cover" : "✓"}</span> : null}
              </button>
              {on && onCover && cover !== i.key ? (
                <button type="button" className="dm-gp-link" onClick={() => onCover(i.key)}>
                  make cover
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NewSubGallery({
  parentId,
  parentTitle,
  items,
  galleries,
  onDone,
}: {
  parentId: string;
  parentTitle: string;
  items: HudItem[];
  galleries: HudGallery[];
  onDone: (res: { ok: boolean; error?: string }, text: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [cover, setCover] = useState<string | undefined>();
  const [files, setFiles] = useState<Array<{ url: string; name: string }>>([]);
  const [fromStorage, setFromStorage] = useState(false);
  const [move, setMove] = useState(false);
  const [existing, setExisting] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (key: string) =>
    setChosen((list) => {
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
      if (!next.includes(cover ?? "")) setCover(next[0]);
      return next;
    });
  const coverKey = cover ?? chosen[0];
  const total = chosen.length + files.length;

  return (
    <div className="dm-gp-panel">
      <div className="dm-gp-actions" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "new"} className={mode === "new" ? "is-active" : undefined} onClick={() => setMode("new")}>
          Make a new one
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "existing"}
          className={mode === "existing" ? "is-active" : undefined}
          onClick={() => setMode("existing")}
        >
          Use a gallery she has
        </button>
      </div>

      {mode === "new" ? (
        <>
          <label className="dm-gp-field">
            <span>Name</span>
            <input type="text" className="dm-gp-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Medicine Buddha studies" />
          </label>
          <p className="dm-gp-muted">
            Choose its pictures from {parentTitle}. The <strong>cover</strong> stays here and opens the sub-gallery
            {chosen.length ? "" : " — the first you choose, unless you pick another"}.
          </p>
          <ChooseFrom items={items} chosen={chosen} cover={coverKey} onToggle={toggle} onCover={setCover} />
          <button type="button" className="dm-gp-link" aria-expanded={fromStorage} onClick={() => setFromStorage((v) => !v)}>
            {fromStorage ? "Hide the folders" : `Also add pictures from the folders${files.length ? ` (${files.length} chosen)` : ""}`}
          </button>
          {fromStorage ? (
            <div className="eac-picker">
              <MediaBrowser
                endpoint={SOURCES[0]!.endpoint}
                picked={files.map((f) => f.url)}
                onToggle={(item) =>
                  setFiles((list) => (list.some((f) => f.url === item.url) ? list.filter((f) => f.url !== item.url) : [...list, item]))
                }
              />
            </div>
          ) : null}
          <label className="dm-gp-check-row">
            <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} />
            <span>Take the chosen pictures out of {parentTitle} (the cover stays)</span>
          </label>
          <button
            type="button"
            className="dm-gp-primary"
            disabled={busy || !title.trim() || total === 0}
            onClick={async () => {
              setBusy(true);
              const res = await createSubGalleryAction(parentId, { title, keys: chosen, files, coverKey, move });
              setBusy(false);
              await onDone(res, res.ok ? `Made “${title.trim()}” with ${total} picture${total === 1 ? "" : "s"}.` : "");
            }}
          >
            {busy ? "Making…" : `Make the sub-gallery${total ? ` (${total})` : ""}`}
          </button>
        </>
      ) : (
        <>
          <label className="dm-gp-field">
            <span>Gallery</span>
            <select className="dm-gp-input" value={existing} onChange={(e) => setExisting(e.target.value)}>
              <option value="">Choose one…</option>
              {galleries
                .filter((g) => g.id !== parentId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.itemCount})
                  </option>
                ))}
            </select>
          </label>
          <p className="dm-gp-muted">Choose the picture here that opens it.</p>
          <ChooseFrom items={items} chosen={cover ? [cover] : []} cover={cover} onToggle={(k) => setCover(k === cover ? undefined : k)} />
          <button
            type="button"
            className="dm-gp-primary"
            disabled={busy || !existing || !cover}
            onClick={async () => {
              setBusy(true);
              const res = await setGalleryItemOpensAction(parentId, cover!, existing);
              setBusy(false);
              await onDone(res, res.ok ? "Linked." : "");
            }}
          >
            Link it
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SubGalleryRow({
  parentId,
  parentItems,
  cover,
  gallery,
  onChanged,
}: {
  parentId: string;
  parentItems: HudItem[];
  cover: HudItem;
  gallery?: HudGallery;
  onChanged: (res: { ok: boolean; error?: string }, text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [subItems, setSubItems] = useState<HudItem[] | null>(null);
  const [adding, setAdding] = useState<string[]>([]);
  const subId = cover.opens!;

  const load = useCallback(async () => {
    const g = await getGalleryForHud(subId);
    setSubItems("error" in g ? [] : inGridOrder(g.items));
  }, [subId]);

  useEffect(() => {
    if (open && subItems === null) void load();
  }, [open, subItems, load]);

  const inSub = new Set((subItems ?? []).map((i) => i.url));

  return (
    <li className="dm-gp-sub">
      <div className="dm-gp-sub-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(cover.url, 160)} alt="" loading="lazy" />
        <div>
          <strong>{gallery?.title ?? "A gallery"}</strong>
          <span className="dm-gp-muted">
            {gallery ? `${gallery.itemCount} pictures · ` : ""}opened by “{cover.title || "a picture"}”
          </span>
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Pictures"}
        </button>
      </div>

      {open ? (
        <div className="dm-gp-panel">
          <label className="dm-gp-field">
            <span>Name</span>
            <input
              type="text"
              className="dm-gp-input"
              defaultValue={gallery?.title ?? ""}
              onBlur={async (e) => {
                const v = e.target.value.trim();
                if (v && v !== gallery?.title) await onChanged(await updateGalleryAction(subId, { title: v }), "Renamed.");
              }}
            />
          </label>
          {subItems === null ? (
            <p className="dm-gp-muted">Loading…</p>
          ) : (
            <ul className="dm-gp-grid">
              {subItems.map((i) => (
                <li key={i.key}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(i.url, 200)} alt="" loading="lazy" title={i.title} />
                  <button
                    type="button"
                    className="dm-gp-link"
                    onClick={async () => {
                      await onChanged(await removeGalleryPicturesAction(subId, [i.key]), "Taken out of the sub-gallery.");
                      await load();
                    }}
                  >
                    take out
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="dm-gp-muted">Add more from this gallery:</p>
          <ChooseFrom
            items={parentItems.filter((i) => !inSub.has(i.url) && i.key !== cover.key)}
            chosen={adding}
            onToggle={(k) => setAdding((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]))}
          />
          <div className="dm-gp-actions">
            <button
              type="button"
              className="dm-gp-primary"
              disabled={!adding.length}
              onClick={async () => {
                const res = await copyPicturesToGalleryAction(subId, parentId, adding);
                setAdding([]);
                await onChanged(res, "error" in res ? "" : `Added ${res.added}.`);
                await load();
              }}
            >
              Add {adding.length || ""} to it
            </button>
            <button
              type="button"
              className="dm-gp-link"
              onClick={async () => {
                if (!window.confirm("Stop this picture opening the sub-gallery? The sub-gallery itself is kept.")) return;
                await onChanged(await setGalleryItemOpensAction(parentId, cover.key, null), "Unlinked.");
              }}
            >
              Unlink
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
