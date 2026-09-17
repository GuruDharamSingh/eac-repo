"use client";

import { useState } from "react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { withBase } from "@/lib/base-path";

/**
 * One editor for every block of site copy. A section is a flat record saved
 * whole to org_site_sections through /api/manage/section; the `fields` list
 * says how each key is edited. Adding an editable block to the site is a
 * fields array and an allowlist entry, not a new form.
 */
export type Field =
  | { key: string; label: string; type: "text" | "number" | "url"; hint?: string }
  | { key: string; label: string; type: "textarea"; rows?: number; hint?: string }
  | { key: string; label: string; type: "richtext"; hint?: string }
  | { key: string; label: string; type: "upload"; accept: string; hint?: string }
  | { key: string; label: string; type: "pages"; hint?: string }
  | { key: string; label: string; type: "books"; hint?: string };

type Values = Record<string, unknown>;

/* Pages are typed as plain text: a marker line opens each page, blank lines
   separate paragraphs.   === 47 ===   or   === 47 | Chapter title ===        */
const MARK = /^===\s*(\d+)\s*(?:\|\s*(.*?))?\s*===\s*$/;

function pagesToText(pages: unknown): string {
  if (!Array.isArray(pages)) return "";
  return pages
    .map((p) => {
      const page = p as { number?: number; chapter?: string | null; paragraphs?: string[] };
      const head = `=== ${page.number ?? ""}${page.chapter ? ` | ${page.chapter}` : ""} ===`;
      return `${head}\n\n${(page.paragraphs ?? []).join("\n\n")}`;
    })
    .join("\n\n");
}

function textToPages(text: string) {
  const pages: { number: number; chapter: string | null; paragraphs: string[] }[] = [];
  let current: { number: number; chapter: string | null; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const paragraphs = current.lines.join("\n").split(/\n{2,}/).map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
    if (paragraphs.length) pages.push({ number: current.number, chapter: current.chapter, paragraphs });
  };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(MARK);
    if (m) {
      flush();
      current = { number: Number(m[1]), chapter: m[2]?.trim() || null, lines: [] };
    } else {
      // Text before any marker is page 1 rather than being thrown away.
      if (!current) current = { number: 1, chapter: null, lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  return pages;
}

const booksToText = (items: unknown) =>
  Array.isArray(items)
    ? items.map((b) => { const x = b as Record<string, string | null>; return [x.title, x.author, x.href, x.note].map((v) => v ?? "").join(" | ").replace(/(\s\|\s)+$/, ""); }).join("\n")
    : "";
const textToBooks = (text: string) =>
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [title, author, href, note] = l.split("|").map((s) => s.trim());
    return { title, author: author || null, href: href || null, note: note || null };
  }).filter((b) => b.title);

export function SectionForm({
  sectionKey,
  fields,
  initial,
}: {
  sectionKey: string;
  fields: Field[];
  initial: Values;
}) {
  const [values, setValues] = useState<Values>(() => {
    const v: Values = { ...initial };
    for (const f of fields) {
      if (f.type === "pages") v[f.key] = pagesToText(initial[f.key]);
      if (f.type === "books") v[f.key] = booksToText(initial[f.key]);
    }
    return v;
  });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const set = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setState("idle");
  };

  const upload = async (key: string, file: File) => {
    setUploading(key);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(withBase("/api/upload"), { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setUploading(null);
    if (res?.ok && data?.url) set(key, data.url);
    else setError(data?.error ?? "Upload failed");
  };

  const save = async () => {
    setState("saving");
    setError(null);
    const content: Values = {};
    for (const f of fields) {
      const raw = values[f.key];
      if (f.type === "pages") content[f.key] = textToPages(String(raw ?? ""));
      else if (f.type === "books") content[f.key] = textToBooks(String(raw ?? ""));
      else if (f.type === "number") content[f.key] = raw === "" || raw == null ? null : Number(raw);
      else content[f.key] = typeof raw === "string" ? raw.trim() : (raw ?? null);
    }
    const res = await fetch(withBase("/api/manage/section"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: sectionKey, content }),
    }).catch(() => null);
    if (res?.ok) return setState("saved");
    const data = await res?.json().catch(() => null);
    setError(data?.error ?? "Could not save");
    setState("idle");
  };

  return (
    <div className="card" style={{ display: "grid", gap: 18, maxWidth: 760 }}>
      {fields.map((f) => {
        const value = values[f.key];
        const text = value == null ? "" : String(value);
        return (
          <div key={f.key}>
            <label htmlFor={`f-${f.key}`}><span className="eyebrow">{f.label}</span></label>
            {(f.type === "text" || f.type === "url" || f.type === "number") && (
              <input id={`f-${f.key}`} className="field" type={f.type === "number" ? "number" : "text"} value={text} onChange={(e) => set(f.key, e.target.value)} />
            )}
            {f.type === "textarea" && (
              <textarea id={`f-${f.key}`} className="field" rows={f.rows ?? 4} value={text} onChange={(e) => set(f.key, e.target.value)} />
            )}
            {(f.type === "pages" || f.type === "books") && (
              <textarea id={`f-${f.key}`} className="field" rows={f.type === "pages" ? 22 : 10} value={text} spellCheck={f.type === "pages"} style={{ fontFamily: f.type === "pages" ? "var(--font-book)" : "var(--font-ui)", fontSize: f.type === "pages" ? "1rem" : 12 }} onChange={(e) => set(f.key, e.target.value)} />
            )}
            {f.type === "richtext" && (
              <RichTextEditor value={text} onChange={(html) => set(f.key, html)} toolbar="minimal" minHeight={260} ariaLabel={f.label} />
            )}
            {f.type === "upload" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input id={`f-${f.key}`} className="field" style={{ flex: 1, minWidth: 220 }} value={text} placeholder="/api/media/… or https://…" onChange={(e) => set(f.key, e.target.value)} />
                  <label className="btn" style={{ cursor: "pointer" }}>
                    {uploading === f.key ? "Uploading…" : "Upload"}
                    <input type="file" accept={f.accept} hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(f.key, file); e.target.value = ""; }} />
                  </label>
                  {text && <button type="button" className="btn" onClick={() => set(f.key, "")}>Clear</button>}
                </div>
                {text && f.accept.startsWith("image") && (
                  // The stored value stays canonical; only the preview is prefixed.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(text)} alt="" style={{ maxHeight: 140, maxWidth: "100%", border: "1px solid var(--rule)", borderRadius: 3, justifySelf: "start" }} />
                )}
              </div>
            )}
            {f.hint && <p style={{ margin: "5px 0 0", fontSize: "0.85rem", color: "var(--ink-muted)" }}>{f.hint}</p>}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" className="btn btn--primary" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        {state === "saved" && <span className="eyebrow">Saved — it&rsquo;s live.</span>}
        {error && <span className="eyebrow" style={{ color: "var(--crimson)" }}>{error}</span>}
      </div>
    </div>
  );
}
