"use client";

import { useMemo, useState } from "react";
import type { ProfileOrgMembership } from "@elkdonis/services";
import type { OrgOption } from "@/lib/associated-orgs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CoverImageUpload } from "@/components/hub/CoverImageUpload";

type Draft = {
  userId: string | null;
  orgId: string;
  name: string;
  slug: string;
  roleTitle: string;
  headline: string;
  bio: string;
  city: string;
  region: string;
  country: string;
  avatarUrl: string;
  website: string;
  tagsText: string;
};

function emptyDraft(defaultOrgId: string): Draft {
  return {
    userId: null,
    orgId: defaultOrgId,
    name: "",
    slug: "",
    roleTitle: "",
    headline: "",
    bio: "",
    city: "",
    region: "",
    country: "",
    avatarUrl: "",
    website: "",
    tagsText: "",
  };
}

function rowToDraft(row: ProfileOrgMembership): Draft {
  return {
    userId: row.userId,
    orgId: row.orgId,
    name: row.displayName,
    slug: row.slug ?? "",
    roleTitle: row.roleTitle ?? "",
    headline: row.headline ?? "",
    bio: row.bio ?? "",
    city: row.city ?? "",
    region: row.region ?? "",
    country: row.country ?? "",
    avatarUrl: row.avatarUrl ?? "",
    website: row.socialLinks.find((l) => l.label === "Website")?.url ?? "",
    tagsText: row.tags.join(", "),
  };
}

function draftToPayload(d: Draft) {
  return {
    userId: d.userId ?? undefined,
    currentOrgId: d.userId ? d.orgId : undefined,
    orgId: d.orgId,
    name: d.name,
    slug: d.slug,
    roleTitle: d.roleTitle,
    headline: d.headline,
    bio: d.bio,
    city: d.city,
    region: d.region,
    country: d.country,
    avatarUrl: d.avatarUrl,
    website: d.website,
    tags: d.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
  };
}

export function AssociatedOrgManager({
  initialRows,
  orgs,
}: {
  initialRows: ProfileOrgMembership[];
  orgs: OrgOption[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(orgs[0]?.id ?? ""));
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = draft.userId !== null;

  const orgSlugById = useMemo(() => new Map(orgs.map((o) => [o.id, o.slug])), [orgs]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function startNew() {
    setDraft(emptyDraft(orgs[0]?.id ?? ""));
    setNotice("");
  }

  function startEdit(row: ProfileOrgMembership) {
    setDraft(rowToDraft(row));
    setNotice("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refresh() {
    const res = await fetch("/api/hub/admin/associated-orgs");
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows ?? []);
    }
  }

  async function save() {
    if (!draft.name.trim()) {
      setNotice("Name is required.");
      return;
    }
    if (!draft.orgId) {
      setNotice("Choose an organisation.");
      return;
    }
    setSaving(true);
    setNotice("");
    const res = await fetch("/api/hub/admin/associated-orgs", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftToPayload(draft)),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setNotice(data.error || "Save failed.");
      return;
    }
    setRows(data.rows ?? []);
    setDraft(emptyDraft(orgs[0]?.id ?? ""));
    setNotice(editing ? "Updated." : "Created.");
  }

  async function remove(row: ProfileOrgMembership) {
    if (!confirm(`Remove ${row.displayName} from ${row.orgName}? This cannot be undone.`)) return;
    const res = await fetch(
      `/api/hub/admin/associated-orgs?userId=${encodeURIComponent(row.userId)}&orgId=${encodeURIComponent(row.orgId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await refresh();
      if (draft.userId === row.userId) setDraft(emptyDraft(orgs[0]?.id ?? ""));
      setNotice(`${row.displayName} removed.`);
    } else {
      setNotice("Delete failed.");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <h2 className="font-serif text-xl">
          {editing ? `Editing: ${draft.name || "(unnamed)"}` : "Add an associated organization"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ao-name">Business name</Label>
            <Input id="ao-name" value={draft.name} onChange={(e) => set("name", e.currentTarget.value)} placeholder="Left Bank Gallery" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ao-slug">Slug (URL)</Label>
            <Input id="ao-slug" value={draft.slug} onChange={(e) => set("slug", e.currentTarget.value)} placeholder="auto from name if blank" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ao-org">Organisation</Label>
          <select
            id="ao-org"
            value={draft.orgId}
            onChange={(e) => set("orgId", e.currentTarget.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Which org sponsors this relationship — the associated org can be re-pointed later.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ao-role">Relationship title</Label>
          <Input id="ao-role" value={draft.roleTitle} onChange={(e) => set("roleTitle", e.currentTarget.value)} placeholder="Represented gallery" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ao-headline">Headline (shown on ArtDirect)</Label>
          <Input id="ao-headline" value={draft.headline} onChange={(e) => set("headline", e.currentTarget.value)} placeholder="Contemporary art gallery" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ao-city">City</Label>
            <Input id="ao-city" value={draft.city} onChange={(e) => set("city", e.currentTarget.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ao-region">Region</Label>
            <Input id="ao-region" value={draft.region} onChange={(e) => set("region", e.currentTarget.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ao-country">Country</Label>
            <Input id="ao-country" value={draft.country} onChange={(e) => set("country", e.currentTarget.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ao-website">Website</Label>
          <Input id="ao-website" value={draft.website} onChange={(e) => set("website", e.currentTarget.value)} placeholder="https://…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ao-tags">Tags (comma separated)</Label>
          <Input id="ao-tags" value={draft.tagsText} onChange={(e) => set("tagsText", e.currentTarget.value)} placeholder="gallery, curator" />
        </div>

        <div className="space-y-1.5">
          <Label>Logo</Label>
          <CoverImageUpload
            orgSlug={orgSlugById.get(draft.orgId) ?? ""}
            context="directory"
            value={draft.avatarUrl || undefined}
            onChange={(url) => set("avatarUrl", url ?? "")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ao-bio">Description</Label>
          <Textarea id="ao-bio" rows={5} value={draft.bio} onChange={(e) => set("bio", e.currentTarget.value)} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create"}
          </Button>
          {editing && (
            <Button type="button" variant="secondary" onClick={startNew}>
              Cancel edit
            </Button>
          )}
        </div>
        {notice && <p className="text-sm text-muted-foreground" aria-live="polite">{notice}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Listed ({rows.length})</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Business</th>
                <th className="px-3 py-2 font-medium">Org</th>
                <th className="px-3 py-2 font-medium">Relationship</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.orgId}:${row.userId}`} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    {row.displayName}
                    <br />
                    <span className="text-xs text-muted-foreground">/{row.slug}</span>
                  </td>
                  <td className="px-3 py-2">{row.orgName}</td>
                  <td className="px-3 py-2">{row.roleTitle || <span className="text-muted-foreground">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(row)} className="mr-1.5">
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => remove(row)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-sm text-muted-foreground">
                    None yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
