"use client";

import { useMemo, useState } from "react";
import type { AdminDirectoryRow } from "@/lib/directory-admin";

type Draft = {
  id: string | null;
  slug: string;
  kind: "artist" | "dealer";
  name: string;
  role: string;
  status: "draft" | "published";
  email: string;
  website: string;
  portrait_url: string;
  bioText: string;
  artworksText: string;
  linksText: string;
  sort_order: number | null;
};

const EMPTY: Draft = {
  id: null,
  slug: "",
  kind: "artist",
  name: "",
  role: "",
  status: "published",
  email: "",
  website: "",
  portrait_url: "",
  bioText: "",
  artworksText: "",
  linksText: "",
  sort_order: null,
};

function rowToDraft(row: AdminDirectoryRow): Draft {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    role: row.role ?? "",
    status: row.status,
    email: row.email ?? "",
    website: row.website ?? "",
    portrait_url: row.portrait_url ?? "",
    bioText: row.bio.join("\n\n"),
    artworksText: row.artworks.map((w) => `${w.filename} | ${w.title}`).join("\n"),
    linksText: row.links.map((l) => `${l.label} | ${l.href}`).join("\n"),
    sort_order: row.sort_order,
  };
}

function parsePiped(text: string): { a: string; b: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx === -1) return { a: line, b: "" };
      return { a: line.slice(0, idx).trim(), b: line.slice(idx + 1).trim() };
    });
}

function draftToPayload(d: Draft) {
  const bio = d.bioText.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const artworks = parsePiped(d.artworksText).map(({ a, b }) => ({ filename: a, title: b }));
  const links = parsePiped(d.linksText).map(({ a, b }) => ({ label: a, href: b }));
  return {
    id: d.id ?? undefined,
    slug: d.slug,
    kind: d.kind,
    name: d.name,
    role: d.role,
    status: d.status,
    email: d.email,
    website: d.website,
    portrait_url: d.portrait_url,
    bio,
    artworks,
    links,
    sort_order: d.sort_order ?? undefined,
  };
}

export function DirectoryManager({ initialProfiles }: { initialProfiles: AdminDirectoryRow[] }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const artists = useMemo(() => profiles.filter((p) => p.kind === "artist"), [profiles]);
  const dealers = useMemo(() => profiles.filter((p) => p.kind === "dealer"), [profiles]);
  const editing = draft.id !== null;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function startNew(kind: "artist" | "dealer") {
    setDraft({ ...EMPTY, kind });
    setNotice("");
  }

  function startEdit(row: AdminDirectoryRow) {
    setDraft(rowToDraft(row));
    setNotice("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refresh() {
    const res = await fetch("/api/admin/directory");
    if (res.ok) {
      const data = await res.json();
      setProfiles(data.profiles ?? []);
    }
  }

  async function save() {
    if (!draft.name.trim()) {
      setNotice("Name is required.");
      return;
    }
    setSaving(true);
    setNotice("");
    const payload = draftToPayload(draft);
    const res = await fetch("/api/admin/directory", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setNotice(data.error || "Save failed.");
      return;
    }
    await refresh();
    setDraft(EMPTY);
    setNotice(editing ? "Profile updated." : "Profile created.");
  }

  async function remove(row: AdminDirectoryRow) {
    if (!confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/directory?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
      if (draft.id === row.id) setDraft(EMPTY);
      setNotice(`${row.name} deleted.`);
    } else {
      setNotice("Delete failed.");
    }
  }

  return (
    <div className="admin-shell">
      <div className="page-heading">
        <p className="kicker">IFAC admin</p>
        <h1>Directory — artists &amp; dealers</h1>
        <p className="body-copy">
          Add, edit, and publish the roster. Changes appear on the home page and each profile page immediately.{" "}
          <a className="profile-back" href="/admin">← Back to admin</a>
        </p>
      </div>

      <div className="admin-grid">
        <section className="admin-panel">
          <h2>{editing ? `Editing: ${draft.name || "(unnamed)"}` : "Add a profile"}</h2>
          <div className="section-editor">
            <div className="field-grid">
              <div className="field">
                <label htmlFor="d-name">Name</label>
                <input id="d-name" value={draft.name} onChange={(e) => set("name", e.currentTarget.value)} placeholder="Jane Doe" />
              </div>
              <div className="field">
                <label htmlFor="d-slug">Slug (URL)</label>
                <input id="d-slug" value={draft.slug} onChange={(e) => set("slug", e.currentTarget.value)} placeholder="auto from name if blank" />
              </div>
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="d-kind">Kind</label>
                <select id="d-kind" value={draft.kind} onChange={(e) => set("kind", e.currentTarget.value as Draft["kind"])}>
                  <option value="artist">Artist</option>
                  <option value="dealer">Dealer</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="d-status">Status</label>
                <select id="d-status" value={draft.status} onChange={(e) => set("status", e.currentTarget.value as Draft["status"])}>
                  <option value="published">Published</option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="d-role">Role</label>
              <input id="d-role" value={draft.role} onChange={(e) => set("role", e.currentTarget.value)} placeholder="Artist · Painter" />
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="d-email">Contact email</label>
                <input id="d-email" value={draft.email} onChange={(e) => set("email", e.currentTarget.value)} placeholder="artist@example.com" />
              </div>
              <div className="field">
                <label htmlFor="d-website">Website</label>
                <input id="d-website" value={draft.website} onChange={(e) => set("website", e.currentTarget.value)} placeholder="https://…" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="d-portrait">Portrait image URL</label>
              <input id="d-portrait" value={draft.portrait_url} onChange={(e) => set("portrait_url", e.currentTarget.value)} placeholder="/ifac/artists/slug/photo.jpg or https://…" />
            </div>

            <div className="field">
              <label htmlFor="d-bio">Bio — one paragraph per blank line</label>
              <textarea id="d-bio" value={draft.bioText} onChange={(e) => set("bioText", e.currentTarget.value)} rows={5} />
            </div>

            <div className="field">
              <label htmlFor="d-artworks">Artworks — one per line: <code>image-url | Title</code></label>
              <textarea id="d-artworks" value={draft.artworksText} onChange={(e) => set("artworksText", e.currentTarget.value)} rows={6} placeholder="/ifac/artists/slug/painting.jpg | Sunrise Study" />
            </div>

            <div className="field">
              <label htmlFor="d-links">Links — one per line: <code>Label | https://…</code></label>
              <textarea id="d-links" value={draft.linksText} onChange={(e) => set("linksText", e.currentTarget.value)} rows={3} placeholder="Instagram | https://instagram.com/…" />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="button" type="button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create profile"}
              </button>
              {editing && (
                <button className="button-secondary" type="button" onClick={() => { setDraft(EMPTY); setNotice(""); }}>
                  Cancel edit
                </button>
              )}
            </div>
            <div className="form-status" aria-live="polite">{notice}</div>
          </div>
        </section>

        <section className="table-panel">
          <h2>Roster</h2>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <button className="button-secondary" type="button" onClick={() => startNew("artist")}>+ New artist</button>
            <button className="button-secondary" type="button" onClick={() => startNew("dealer")}>+ New dealer</button>
          </div>

          <RosterTable title={`Artists (${artists.length})`} rows={artists} onEdit={startEdit} onDelete={remove} editingId={draft.id} />
          <div style={{ height: "1rem" }} />
          <RosterTable title={`Dealers (${dealers.length})`} rows={dealers} onEdit={startEdit} onDelete={remove} editingId={draft.id} />
        </section>
      </div>
    </div>
  );
}

function RosterTable({
  title,
  rows,
  onEdit,
  onDelete,
  editingId,
}: {
  title: string;
  rows: AdminDirectoryRow[];
  onEdit: (row: AdminDirectoryRow) => void;
  onDelete: (row: AdminDirectoryRow) => void;
  editingId: string | null;
}) {
  return (
    <div className="table-wrap">
      <h3 style={{ color: "#ff8c00", marginBottom: "0.4rem" }}>{title}</h3>
      <table>
        <thead>
          <tr><th>Name</th><th>Works</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={row.id === editingId ? { outline: "1px solid #20d7ff" } : undefined}>
              <td>
                {row.name}<br />
                <span className="small-note">/{row.kind}s/{row.slug}</span>
              </td>
              <td>{row.artworks.length}</td>
              <td>{row.status === "published" ? "Live" : "Draft"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="button-secondary" type="button" onClick={() => onEdit(row)} style={{ marginRight: "0.4rem" }}>Edit</button>
                <button className="button-secondary" type="button" onClick={() => onDelete(row)}>Delete</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={4} className="small-note">None yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
