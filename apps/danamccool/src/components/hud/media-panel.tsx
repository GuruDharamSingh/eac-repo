"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { loadMediaCatalog, type Catalog, type CatalogFile } from "@/lib/hud-actions";
import { addPicturesAction, listGalleriesForHud, type HudGallery } from "@/lib/gallery-actions";
import { writeMediaDrag } from "@elkdonis/cms-ui/files";

// ============================================================================
// Media — every file the site has, and where each one is used.
//
// Two storage roots, one list: her own folder (uploads, gallery folders) and
// the site folder (her old site's media, one folder per old page). Each file
// says which pages, artworks and galleries point at it; unused files are one
// filter away; and anything a page points at that storage no longer has is
// listed first, because that is a picture showing as broken right now.
//
// From here a picture can be put straight into a gallery, and a file's
// address copied for anywhere else.
// ============================================================================

type Show = "all" | "used" | "unused";
type Where = "all" | "mine" | "site";

function thumb(url: string) {
  return `${url}?w=256`;
}

export function MediaPanel() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [galleries, setGalleries] = useState<HudGallery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<Show>("all");
  const [where, setWhere] = useState<Where>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([loadMediaCatalog(), listGalleriesForHud()]).then(([c, g]) => {
      if ("error" in c) setError(c.error);
      else setCatalog(c.catalog);
      if (!("error" in g)) setGalleries(g.galleries);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog?.files ?? []).filter(
      (f) =>
        (where === "all" || f.root === where) &&
        (show === "all" || (show === "used" ? f.used.length > 0 : f.used.length === 0)) &&
        (!q || `${f.folder}/${f.name}`.toLowerCase().includes(q))
    );
  }, [catalog, show, where, query]);

  const folders = useMemo(() => {
    const map = new Map<string, CatalogFile[]>();
    for (const f of filtered) {
      // Her old site's media sits five folders deep; its page folder is the
      // part worth reading.
      const old = f.folder.match(/^Media\/Images\/DANAS FORMAT WEBSITE\/DANASFORMAT(?:IMAGEFILES|TEXTPAGESCONTENT)\/?(.*)$/);
      const key = old
        ? `Old site / ${old[1] || "(top)"}`
        : `${f.root === "mine" ? "My folder" : "Site folder"}${f.folder ? " / " + f.folder : ""}`;
      map.set(key, [...(map.get(key) ?? []), f]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = useMemo(() => {
    const files = catalog?.files ?? [];
    return { all: files.length, used: files.filter((f) => f.used.length).length };
  }, [catalog]);

  return (
    <div className="dm-hud dm-hud-stack">
      <div className="dm-hud-spread">
        <h2>Media</h2>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Reading…" : "Refresh"}
        </button>
      </div>
      {error ? <p className="dm-hud-error">{error}</p> : null}

      {catalog ? (
        <p className="dm-hud-muted">
          {counts.all} files · {counts.used} in use · {counts.all - counts.used} unused
        </p>
      ) : null}

      {catalog && catalog.missing.length > 0 ? (
        <details open>
          <summary style={{ color: "var(--hud-warn)" }}>
            {catalog.missing.length} missing — pointed at, but not in storage
          </summary>
          <div>
            <ul className="dm-hud-files">
              {catalog.missing.map((m) => (
                <li key={m.path}>
                  <span className="dm-hud-file-name">{m.path.split("/").slice(-2).join("/")}</span>
                  <UsedBy used={m.used} />
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      <input type="search" placeholder="Search file or folder names" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search files" />
      <div className="dm-hud-row">
        <select value={where} onChange={(e) => setWhere(e.target.value as Where)} aria-label="Which folder" style={{ width: "auto", flex: 1 }}>
          <option value="all">Both folders</option>
          <option value="mine">My folder</option>
          <option value="site">Site folder</option>
        </select>
        <select value={show} onChange={(e) => setShow(e.target.value as Show)} aria-label="Which files" style={{ width: "auto", flex: 1 }}>
          <option value="all">All files</option>
          <option value="used">In use</option>
          <option value="unused">Unused</option>
        </select>
      </div>

      {loading && !catalog ? <p className="dm-hud-muted">Reading storage…</p> : null}
      {folders.map(([folder, files]) => (
        <details key={folder}>
          <summary>
            {folder} <span className="dm-hud-muted">({files.length})</span>
          </summary>
          <div>
            <ul className="dm-hud-files">
              {files.map((f) => (
                <FileRow key={f.path} file={f} galleries={galleries} onAdded={load} />
              ))}
            </ul>
          </div>
        </details>
      ))}
      {catalog && folders.length === 0 ? <p className="dm-hud-muted">Nothing matches.</p> : null}
    </div>
  );
}

function UsedBy({ used }: { used: CatalogFile["used"] }) {
  if (used.length === 0) return <span className="dm-hud-chip">unused</span>;
  return (
    <span className="dm-hud-row">
      {used.map((u, i) => (
        <a key={i} className="dm-hud-chip" data-tone={u.kind === "page" ? "accent" : u.kind === "artwork" ? "ok" : undefined} href={u.href}>
          {u.kind}: {u.label}
        </a>
      ))}
    </span>
  );
}

function FileRow({ file, galleries, onAdded }: { file: CatalogFile; galleries: HudGallery[]; onAdded: () => void }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <li className="dm-hud-file">
      {file.kind === "image" ? (
        // Draggable: drop it on any picture field in the editor's right panel.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="dm-hud-thumb"
          src={thumb(file.url)}
          alt=""
          loading="lazy"
          draggable
          onDragStart={(e) => writeMediaDrag(e, { url: file.url, name: file.name })}
          title="Drag onto a picture field"
          style={{ cursor: "grab" }}
        />
      ) : (
        <span className="dm-hud-thumb" style={{ display: "grid", placeItems: "center", fontSize: 11 }}>
          {file.name.split(".").pop()?.toUpperCase()}
        </span>
      )}
      <div>
        <a className="dm-hud-file-name" href={file.url} target="_blank" rel="noopener noreferrer">
          {file.name}
        </a>
        <div style={{ marginTop: 3 }}>
          <UsedBy used={file.used} />
        </div>
        <div className="dm-hud-row" style={{ marginTop: 4 }}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(file.url);
              setNote("Address copied.");
            }}
          >
            Copy address
          </button>
          {file.kind === "image" && galleries.length > 0 ? (
            <select
              aria-label="Add to a gallery"
              value=""
              disabled={pending}
              style={{ width: "auto", flex: 1 }}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                start(async () => {
                  const res = await addPicturesAction(id, [{ url: file.url, title: file.name.replace(/\.[^.]+$/, "") }]);
                  setNote("error" in res ? res.error : `Added to ${galleries.find((g) => g.id === id)?.title}.`);
                  onAdded();
                });
              }}
            >
              <option value="">Add to a gallery…</option>
              {galleries.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {note ? <p className="dm-hud-muted" style={{ margin: "4px 0 0" }}>{note}</p> : null}
      </div>
    </li>
  );
}
