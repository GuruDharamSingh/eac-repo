"use client";

import { useMemo, useState } from "react";
import type { AdminDirectoryRow, AssignableMember } from "@/lib/directory-admin";
import { ImageUploadField } from "@/components/image-upload-field";

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

/** Matches the API route's own slugify — used client-side only to name the
 *  Nextcloud upload folder before a not-yet-saved draft has a real slug. */
function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

export function DirectoryManager({
  initialProfiles,
  initialAssignableMembers,
}: {
  initialProfiles: AdminDirectoryRow[];
  initialAssignableMembers: AssignableMember[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [assignableMembers, setAssignableMembers] = useState(initialAssignableMembers);
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
    const res = await fetch("/api/manage/directory");
    if (res.ok) {
      const data = await res.json();
      setProfiles(data.profiles ?? []);
      setAssignableMembers(data.assignableMembers ?? []);
    }
  }

  /**
   * "This unclaimed row is actually this real, signed-up member" — confirmed
   * by the admin rather than requiring the artist to click claim on ArtDirect
   * themself. Merges immediately (see adminAssignProfile).
   */
  async function assignMember(row: AdminDirectoryRow, memberId: string) {
    if (!memberId) return;
    setNotice("");
    const res = await fetch("/api/manage/directory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action: "assign", memberId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || "Could not match this profile.");
      return;
    }
    setProfiles(data.profiles ?? []);
    setAssignableMembers(data.assignableMembers ?? []);
    setNotice(`${row.name} matched to a member account.`);
  }

  async function save() {
    if (!draft.name.trim()) {
      setNotice("Name is required.");
      return;
    }
    setSaving(true);
    setNotice("");
    const payload = draftToPayload(draft);
    const res = await fetch("/api/manage/directory", {
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

  /**
   * Show or hide this entry on the public site — the one thing an admin comes
   * to this table to do most often, so it is one click here rather than a trip
   * through the edit form's Status field. Reversible, and it touches nothing
   * else about the profile.
   */
  async function setListed(row: AdminDirectoryRow, isPublic: boolean) {
    setNotice("");
    const res = await fetch("/api/manage/directory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action: "visibility", isPublic }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || "Could not change what's published.");
      return;
    }
    setProfiles(data.profiles ?? []);
    setNotice(
      isPublic ? `${row.name} is back on the site.` : `${row.name} is no longer listed on the site.`
    );
  }

  async function remove(row: AdminDirectoryRow) {
    if (
      !confirm(
        `Delete ${row.name}'s roster entry?\n\n` +
          `This removes them from IFAC's artists and dealers for good. If the entry is ` +
          `a placeholder nobody has claimed, the placeholder account goes with it; a real ` +
          `member's account and their own content survive.\n\n` +
          `To just take them off the page for now, use "Take off the page" instead.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/manage/directory?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    if (res.ok) {
      await refresh();
      if (draft.id === row.id) setDraft(EMPTY);
      setNotice(`${row.name} deleted.`);
    } else {
      setNotice("Delete failed.");
    }
  }

  return (
    <>
      <p className="small-note" style={{ marginTop: 0 }}>
        Add, edit and publish the roster. Changes appear on the home page and each
        profile page immediately. To change what someone may <em>do</em> in IFAC, or
        to remove them from the group, use <a href="/manage/people">People &amp; access</a>.
      </p>

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
              <label htmlFor="d-role">Display title</label>
              <input id="d-role" value={draft.role} onChange={(e) => set("role", e.currentTarget.value)} placeholder="Artist · Painter" />
              <p className="small-note">
                The public byline shown on their profile — not an access level. To change
                what someone is allowed to do in IFAC, use{" "}
                <a href="/manage/people">People &amp; access</a> instead.
              </p>
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
              <label htmlFor="d-portrait">Portrait</label>
              {draft.portrait_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.portrait_url} alt="" style={{ maxWidth: 120, display: "block", marginBottom: "0.4rem" }} />
              )}
              <ImageUploadField
                memberSlug={draft.slug || slugify(draft.name)}
                onUploaded={(url) => set("portrait_url", url)}
              />
              <input
                id="d-portrait"
                value={draft.portrait_url}
                onChange={(e) => set("portrait_url", e.currentTarget.value)}
                placeholder="or paste a URL directly"
                style={{ marginTop: "0.4rem" }}
              />
            </div>

            <div className="field">
              <label htmlFor="d-bio">Bio — one paragraph per blank line</label>
              <textarea id="d-bio" value={draft.bioText} onChange={(e) => set("bioText", e.currentTarget.value)} rows={5} />
            </div>

            <div className="field">
              <label htmlFor="d-artworks">Artworks — one per line: <code>image-url | Title</code></label>
              <ImageUploadField
                memberSlug={draft.slug || slugify(draft.name)}
                label="Upload an artwork"
                onUploaded={(url, filename) =>
                  set("artworksText", (draft.artworksText ? draft.artworksText + "\n" : "") + `${url} | ${filename.replace(/\.[^.]+$/, "")}`)
                }
              />
              <textarea id="d-artworks" value={draft.artworksText} onChange={(e) => set("artworksText", e.currentTarget.value)} rows={6} placeholder="/api/media/EAC_Network/users/slug/Media/Images/painting.jpg | Sunrise Study" style={{ marginTop: "0.4rem" }} />
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

          <RosterTable
            title={`Artists (${artists.length})`}
            rows={artists}
            onEdit={startEdit}
            onDelete={remove}
            onSetListed={setListed}
            editingId={draft.id}
            assignableMembers={assignableMembers}
            onAssign={assignMember}
          />
          <div style={{ height: "1rem" }} />
          <RosterTable
            title={`Dealers (${dealers.length})`}
            rows={dealers}
            onEdit={startEdit}
            onDelete={remove}
            onSetListed={setListed}
            editingId={draft.id}
            assignableMembers={assignableMembers}
            onAssign={assignMember}
          />
        </section>
      </div>
    </>
  );
}

function RosterTable({
  title,
  rows,
  onEdit,
  onDelete,
  onSetListed,
  editingId,
  assignableMembers,
  onAssign,
}: {
  title: string;
  rows: AdminDirectoryRow[];
  onEdit: (row: AdminDirectoryRow) => void;
  onDelete: (row: AdminDirectoryRow) => void;
  onSetListed: (row: AdminDirectoryRow, isPublic: boolean) => void;
  editingId: string | null;
  assignableMembers: AssignableMember[];
  onAssign: (row: AdminDirectoryRow, memberId: string) => void;
}) {
  return (
    <div className="table-wrap">
      <h3 style={{ color: "#ff8c00", marginBottom: "0.4rem" }}>{title}</h3>
      <table>
        <thead>
          <tr><th>Name</th><th>Works</th><th>Status</th><th>Claim</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={row.id === editingId ? { outline: "1px solid #20d7ff" } : undefined}>
              <td>
                {row.name}<br />
                <span className="small-note">/{row.kind}s/{row.slug}</span>
              </td>
              <td>{row.artworks.length}</td>
              <td>
                <span
                  className="manage-flag"
                  data-tone={row.status === "published" ? "live" : "hidden"}
                >
                  {row.status === "published" ? "On the site" : "Hidden"}
                </span>
                <div className="manage-row-actions" style={{ marginTop: "0.4rem" }}>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => onSetListed(row, row.status !== "published")}
                  >
                    {row.status === "published" ? "Take off the page" : "Put on the page"}
                  </button>
                </div>
              </td>
              <td>
                {row.claimStatus === "claimed" ? (
                  <span className="small-note">✓ Claimed</span>
                ) : (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const memberId = e.currentTarget.value;
                      if (memberId && confirm(`Confirm this profile is ${row.name}'s account? This merges them permanently.`)) {
                        onAssign(row, memberId);
                      }
                      e.currentTarget.value = "";
                    }}
                    title="Confirm which signed-up member this profile actually is — same effect as them claiming it themself on ArtDirect."
                  >
                    <option value="">
                      {row.claimStatus === "pending" ? "Pending claim — or match…" : "Match to a member…"}
                    </option>
                    {assignableMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName || m.email}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                <div className="manage-row-actions">
                <button className="button-secondary" type="button" onClick={() => onEdit(row)}>Edit</button>
                <a
                  className="button-secondary"
                  href={`${process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "http://localhost:3013"}/${row.slug}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  title="Bio, photo, links and portfolio are edited on the artist's own ArtDirect page — this console only controls role and publish status here."
                >
                  Edit on ArtDirect ↗
                </a>
                {/* Deleting removes the roster ENTRY. For a placeholder nobody
                    has claimed the account goes too; a real member's account
                    survives and only their listing here ends. "Take off the
                    page" above is the reversible version, and is what you want
                    nine times in ten. */}
                <button
                  className="button-secondary manage-danger"
                  type="button"
                  onClick={() => onDelete(row)}
                >
                  Delete entry
                </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} className="small-note">None yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
