"use client";

import { useState } from "react";

// ============================================================================
// The Fields lens, as something to try (docs/open/HOUSE_EDITOR_ONE_2026-11-20/PLAN.md, H3).
//
// A page marks each editable value with data-field and declares it in a small pure-data
// registry: its KIND (text, rich, media, link), a plain-language DESCRIPTION, and, for a
// link, what it LINKS to. In Edit mode every declared value gets a chip; clicking one opens a
// dialog built from its kind. Nothing is saved: this is a model of the experience.
// ============================================================================

type Kind = "text" | "link";
interface Field {
  id: string;
  kind: Kind;
  label: string;
  describe: string;
  value: string;
}

const INITIAL: Field[] = [
  { id: "hero.title", kind: "text", label: "Hero title", describe: "The big line at the top of the home page. Keep it under 60 characters.", value: "A house for the arts" },
  { id: "hero.cta", kind: "link", label: "Hero button link", describe: "Where the hero button goes. Must be a full address or a path on this site.", value: "/workshops" },
  { id: "about.body", kind: "text", label: "About copy", describe: "Two or three sentences about the collective. Shown on the About page and in the footer.", value: "We make room for people who make things." },
  { id: "footer.contact", kind: "link", label: "Contact link", describe: "The Leave a Message link in the footer.", value: "mailto:hello@example.com" },
];

const linkOk = (v: string) => /^(https?:\/\/[^\s]+|\/[^\s]*|mailto:[^\s@]+@[^\s@]+)$/.test(v.trim());

export function FieldsLensDemo() {
  const [fields, setFields] = useState(INITIAL);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const f = (id: string) => fields.find((x) => x.id === id)!;
  const current = open ? f(open) : null;
  const bad = current?.kind === "link" && !linkOk(draft);

  const chip = (id: string) =>
    editing ? (
      <button
        type="button"
        onClick={() => {
          setOpen(id);
          setDraft(f(id).value);
        }}
        style={{ marginLeft: 8, font: "500 11px system-ui", padding: "2px 8px", borderRadius: 99, border: "1px dashed #7aa2ff", background: "transparent", color: "#7aa2ff", cursor: "pointer" }}
      >
        edit {f(id).kind}
      </button>
    ) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 24, alignItems: "start" }}>
      <div style={{ background: "#fff", color: "#111", borderRadius: 10, overflow: "hidden", border: "1px solid #262b36" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "#f3f4f6", font: "13px system-ui" }}>
          <span>{editing ? "You can edit this page" : "A sample page"}</span>
          <button type="button" onClick={() => setEditing((e) => !e)} style={{ font: "500 13px system-ui", padding: "5px 12px", borderRadius: 6, border: "1px solid #1d2129", background: editing ? "#1d4ed8" : "#fff", color: editing ? "#fff" : "#1d2129", cursor: "pointer" }}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <div style={{ padding: "40px 32px" }}>
          <h1 data-field="page:home:hero.title" style={{ fontSize: 34, margin: 0, fontFamily: "Georgia, serif" }}>
            {f("hero.title").value}
            {chip("hero.title")}
          </h1>
          <p style={{ margin: "14px 0" }}>
            <a data-field="page:home:hero.cta" href={f("hero.cta").value} onClick={(e) => e.preventDefault()} style={{ display: "inline-block", padding: "8px 16px", background: "#1d4ed8", color: "#fff", borderRadius: 6, textDecoration: "none" }}>
              Join a workshop
            </a>
            {chip("hero.cta")}
          </p>
          <p data-field="page:about:about.body" style={{ maxWidth: "50ch" }}>
            {f("about.body").value}
            {chip("about.body")}
          </p>
          <footer style={{ marginTop: 28, paddingTop: 12, borderTop: "1px solid #ddd", fontSize: 13 }}>
            <a href={f("footer.contact").value} onClick={(e) => e.preventDefault()} data-field="site:footer:footer.contact">
              Leave a message
            </a>
            {chip("footer.contact")}
          </footer>
        </div>
      </div>

      <aside style={{ background: "#171a21", border: "1px solid #262b36", borderRadius: 10, padding: 14, fontSize: 12 }}>
        <strong>The declared registry</strong>
        <p style={{ color: "#8b93a7", margin: "4px 0 10px" }}>Pure data. Each field says what it is, what it means, and how it is checked.</p>
        {fields.map((x) => (
          <div key={x.id} style={{ borderTop: "1px solid #262b36", padding: "8px 0" }}>
            <code style={{ color: "#7aa2ff" }}>{x.id}</code> <span style={{ color: "#8b93a7" }}>· {x.kind}</span>
            <div>{x.describe}</div>
          </div>
        ))}
        <p style={{ color: "#f0b35a", margin: "10px 0 0" }}>One writer per value: a value stored inside a block is declined here and edited on the canvas.</p>
      </aside>

      {current ? (
        <div role="dialog" aria-label={current.label} style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}>
          <div style={{ background: "#fff", color: "#111", borderRadius: 10, padding: 20, width: 420, font: "14px system-ui" }}>
            <strong>{current.label}</strong>
            <p style={{ color: "#555", margin: "4px 0 10px", fontSize: 13 }}>{current.describe}</p>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: "100%", padding: 8, border: `1px solid ${bad ? "#b91c1c" : "#bbb"}`, borderRadius: 6, boxSizing: "border-box" }} />
            {bad ? <p style={{ color: "#b91c1c", fontSize: 12, margin: "6px 0 0" }}>That is not a link. Use https://..., a path starting with /, or mailto:.</p> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" onClick={() => setOpen(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #bbb", background: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={bad}
                onClick={() => {
                  setFields((all) => all.map((x) => (x.id === current.id ? { ...x, value: draft } : x)));
                  setOpen(null);
                  setToast(`${current.label} changed (sandbox: not saved anywhere)`);
                  setTimeout(() => setToast(""), 2500);
                }}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", cursor: bad ? "not-allowed" : "pointer", opacity: bad ? 0.5 : 1 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "#fff", padding: "8px 14px", borderRadius: 8, zIndex: 80, fontSize: 13 }}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}

