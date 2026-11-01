"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Dialog } from "../series/[slug]/manage/panels";
import { SrsNav, safeSrc } from "../series/[slug]/series-template";
import type { AboutContent, AboutSection } from "@/lib/about-content";
import { saveAboutAction } from "./actions";

export function Section({ s, controls, commission }: { s: AboutSection; controls?: React.ReactNode; commission: number }) {
  const media = s.media && safeSrc(s.media.url) ? s.media : null;
  const html = s.html.replace(/\{\{\s*commission\s*\}\}/g, `${commission}%`);
  return (
    <section id={s.id} className={`abt-row${media ? "" : " is-text"}`}>
      <div className="abt-text">
        {s.kicker && <p className="abt-kicker">{s.kicker}</p>}
        <h2 className="srs-h2">{s.title || "Untitled section"}</h2>
        {controls}
        {html ? <div className="abt-prose" dangerouslySetInnerHTML={{ __html: html }} /> : null}
        {s.link && <p className="abt-visit"><a href={s.link.url}>{s.link.label} →</a></p>}
      </div>
      {media && (
        <figure className="abt-media">
          {media.kind === "video" ? (
            <video src={media.url} controls preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt={media.alt ?? ""} loading="lazy" />
          )}
        </figure>
      )}
    </section>
  );
}

export function AboutBody({ content, commission, ledeControl, controls }: { content: AboutContent; commission: number; ledeControl?: React.ReactNode; controls?: (i: number) => React.ReactNode }) {
  return (
    <main className="srs-wrap abt-main">
      <h1 className="abt-h1">About</h1>
      <p className="abt-lede">{content.lede}{ledeControl}</p>
      <div className="abt-rows">
        {content.sections.map((s, i) => <Section key={s.id} s={s} commission={commission} controls={controls?.(i)} />)}
      </div>
    </main>
  );
}

// In-place editing of the About page (2026-10-28) for the site's owners: the
// lede, and each section's kicker, header, text, media beside the text, and
// link; sections can be added, removed and reordered. Everything is one
// document saved whole (lib/about-content.ts).

type Media = AboutSection["media"];

async function upload(file: File): Promise<NonNullable<Media>> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/about/media", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { url?: string; kind?: "image" | "video"; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed.");
  return { url: body.url, kind: body.kind ?? "image" };
}

function MediaField({ value, onChange }: { value: Media; onChange: (m: Media) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const ref = React.useRef<HTMLInputElement>(null);
  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await upload(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="sw-field">
      <span className="sw-label">Media beside the text <span className="sw-muted" style={{ fontWeight: 400 }}>(optional)</span></span>
      {value ? (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {value.kind === "video" ? (
            <video src={value.url} muted controls style={{ width: 220, borderRadius: 6, background: "#000" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt="" style={{ width: 220, height: "auto", borderRadius: 6 }} />
          )}
          <button type="button" className="sw-link is-danger" onClick={() => onChange(null)}>Remove</button>
        </div>
      ) : (
        <>
          <div className="sw-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files?.[0]); }}>
            {busy ? "Uploading…" : <>Drop an image or video here or <button type="button" className="sw-link" onClick={() => ref.current?.click()}>choose a file</button></>}
            <input ref={ref} type="file" accept="image/*,video/mp4,video/webm" className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="sw-input" placeholder="…or paste an image address (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Image address" />
            <button type="button" className="sw-btn is-quiet" disabled={!/^https?:\/\//i.test(url) && !url.startsWith("/")} onClick={() => { onChange({ url: url.trim(), kind: /\.(mp4|webm)(\?|$)/i.test(url) ? "video" : "image" }); setUrl(""); }}>Use</button>
          </div>
        </>
      )}
    </div>
  );
}

function SectionDialog({ section, open, onClose, onSave }: { section: AboutSection; open: boolean; onClose: () => void; onSave: (s: AboutSection) => void }) {
  const [kicker, setKicker] = React.useState(section.kicker ?? "");
  const [title, setTitle] = React.useState(section.title);
  const [html, setHtml] = React.useState(section.html);
  const [media, setMedia] = React.useState<Media>(section.media);
  const [linkUrl, setLinkUrl] = React.useState(section.link?.url ?? "");
  const [linkLabel, setLinkLabel] = React.useState(section.link?.label ?? "");
  React.useEffect(() => {
    if (!open) return;
    setKicker(section.kicker ?? ""); setTitle(section.title); setHtml(section.html); setMedia(section.media);
    setLinkUrl(section.link?.url ?? ""); setLinkLabel(section.link?.label ?? "");
  }, [open, section]);
  return (
    <Dialog open={open} onClose={onClose} title={section.title ? `Edit: ${section.title}` : "New section"}>
      <div className="sw-grid cols-2">
        <div className="sw-field"><label htmlFor="ab-kicker" className="sw-label">Line above the header</label><input id="ab-kicker" className="sw-input" value={kicker} onChange={(e) => setKicker(e.target.value)} placeholder="Presents the auction series" /></div>
        <div className="sw-field"><label htmlFor="ab-title" className="sw-label">Header</label><input id="ab-title" className="sw-input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      </div>
      <div className="sw-field">
        <span className="sw-label">Text</span>
        <RichTextEditor value={html} onChange={setHtml} minHeight={180} ariaLabel="Section text" placeholder="Collect Art's own words about this organisation or subject." />
      </div>
      <MediaField value={media} onChange={setMedia} />
      <div className="sw-grid cols-2">
        <div className="sw-field"><label htmlFor="ab-link" className="sw-label">Link (optional)</label><input id="ab-link" className="sw-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" /></div>
        <div className="sw-field"><label htmlFor="ab-link-label" className="sw-label">Link text</label><input id="ab-link-label" className="sw-input" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Visit ifacgroup.com" /></div>
      </div>
      <div className="sw-dialog-foot">
        <button type="button" className="sw-btn" disabled={!title.trim()}
          onClick={() => onSave({ ...section, kicker: kicker.trim() || null, title: title.trim(), html, media, link: linkUrl.trim() ? { url: linkUrl.trim(), label: linkLabel.trim() || "Visit" } : null })}>
          Save section
        </button>
      </div>
    </Dialog>
  );
}

/** The page for someone who may edit it: the edit bar, the body with controls, the dialogs. */
export function AboutEditor({ content, saved, commission, signedIn, footer }: { content: AboutContent; saved: boolean; commission: number; signedIn: boolean; footer: React.ReactNode }) {
  const router = useRouter();
  const [doc, setDoc] = React.useState<AboutContent>(content);
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [which, setWhich] = React.useState<number | null>(null);
  const [ledeOpen, setLedeOpen] = React.useState(false);
  const [lede, setLede] = React.useState(content.lede);
  React.useEffect(() => { setDoc(content); setLede(content.lede); }, [content]);
  const dirty = JSON.stringify(doc) !== JSON.stringify(content);

  async function save(next: AboutContent) {
    setBusy(true);
    const r = await saveAboutAction(next);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not save.");
    toast.success("Saved.");
    router.refresh();
  }
  const update = (next: AboutContent) => { setDoc(next); void save(next); };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= doc.sections.length) return;
    const s = [...doc.sections];
    [s[i], s[j]] = [s[j]!, s[i]!];
    update({ ...doc, sections: s });
  };
  const remove = (i: number) => {
    if (!window.confirm(`Remove the section "${doc.sections[i]!.title}"?`)) return;
    update({ ...doc, sections: doc.sections.filter((_, k) => k !== i) });
  };
  const add = () => {
    const s: AboutSection = { id: `section-${Date.now()}`, kicker: null, title: "", html: "", media: null, link: null };
    setDoc({ ...doc, sections: [...doc.sections, s] });
    setWhich(doc.sections.length);
  };

  const controls = (i: number): React.ReactNode =>
    editing ? (
      <span className="abt-controls">
        <button type="button" className="srs-edit-chip" onClick={() => setWhich(i)}>Edit</button>
        <button type="button" className="srs-edit-chip" aria-label="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)}>↑</button>
        <button type="button" className="srs-edit-chip" aria-label="Move down" disabled={i === doc.sections.length - 1 || busy} onClick={() => move(i, 1)}>↓</button>
        <button type="button" className="srs-edit-chip" disabled={busy} onClick={() => remove(i)}>Remove</button>
      </span>
    ) : null;
  const ledeControl: React.ReactNode = editing ? <button type="button" className="srs-edit-chip srs-inline-edit" onClick={() => setLedeOpen(true)}>Edit intro</button> : null;
  const current = which !== null ? doc.sections[which] : null;

  return (
    <>
      <div className="srs-editbar sw" style={{ minHeight: 0 }}>
        <div className="srs-editbar-inner srs-wrap">
          <span>
            <strong>{editing ? "Editing the About page" : "You can edit this page"}</strong>
            <span className="sw-muted"> · {saved ? "saved content" : "showing the defaults until first saved"}{dirty ? " · unsaved" : ""}</span>
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {editing && <button type="button" className="sw-btn is-outline" onClick={add}>+ Add section</button>}
            <button type="button" className={editing ? "sw-btn is-quiet" : "sw-btn"} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit page"}</button>
          </span>
        </div>
      </div>
      <SrsNav signedIn={signedIn} current="about" />
      <AboutBody content={doc} commission={commission} ledeControl={ledeControl} controls={controls} />
      {footer}
      {current && (
        <SectionDialog
          section={current}
          open={which !== null}
          onClose={() => { if (!current.title) setDoc({ ...doc, sections: doc.sections.filter((_, k) => k !== which) }); setWhich(null); }}
          onSave={(s) => { update({ ...doc, sections: doc.sections.map((x, k) => (k === which ? s : x)) }); setWhich(null); }}
        />
      )}
      <Dialog open={ledeOpen} onClose={() => setLedeOpen(false)} title="The line under the title">
        <div className="sw-field"><label htmlFor="ab-lede" className="sw-label">Intro</label><input id="ab-lede" className="sw-input" value={lede} onChange={(e) => setLede(e.target.value)} /></div>
        <div className="sw-dialog-foot"><button type="button" className="sw-btn" onClick={() => { update({ ...doc, lede }); setLedeOpen(false); }}>Save</button></div>
      </Dialog>
    </>
  );
}
