"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardFieldControl, type WizardFieldSpec } from "@elkdonis/cms-ui/wizard";
import { CoverField, MediaPicker, type CoverFrame, type CoverValue } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import "./week-editor.css";

type MaterialKind = "image" | "video" | "audio" | "document";

export interface WeekEditable {
  title: string | null;
  subtitle?: string | null;
  summary: string | null;
  /** The rich write-up (sanitised on write); null for weeks written as plain text. */
  bodyHtml?: string | null;
  coverImageUrl: string | null;
  coverFrame?: CoverFrame | null;
  /** A picture, a video file or a YouTube/Vimeo link (2026-10-18). */
  coverKind?: "image" | "video" | "embed";
  coverPosterUrl?: string | null;
  materials: Array<{ id: string; name: string; url: string; kind: MaterialKind; external?: boolean }>;
}

interface Person {
  userId: string;
  displayName: string;
}

/*
 * Field specs for the shared control (cms-ui `WizardFieldControl`), so the
 * labels, inputs and hints are the ones /hub/compose renders. The write-up
 * is rich text (cms-ui RichTextEditor, 2026-10-13); the server sanitises it
 * and keeps a plain copy in `summary` for mail.
 */
const TITLE_FIELD: WizardFieldSpec = { name: "week-title", label: "Title", input: "text", placeholder: "What this week is called" };
const SUBTITLE_FIELD: WizardFieldSpec = {
  name: "week-subtitle",
  label: "Subtitle or short summary (optional)",
  input: "text",
  placeholder: "One line under the title",
};

/** TipTap's empty document. */
function emptyHtml(html: string): boolean {
  return html.replace(/<p>(\s|<br\s*\/?>)*<\/p>/gi, "").trim() === "";
}

/** A plain write-up as paragraphs, for weeks written before the rich editor. */
function textToHtml(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t
    .split(/\n\s*\n/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const UPLOAD_ENDPOINT = "/api/media/upload";
const LIBRARY_ENDPOINT = "/api/media/library";

function kindOf(url: string): MaterialKind {
  const lower = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/.test(lower)) return "image";
  if (/youtube|youtu\.be|vimeo|\.(mp4|mov|webm)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|m4a|wav)(\?|$)/.test(lower)) return "audio";
  return "document";
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The week's own fields, edited where they sit. Shown only to organisers
 * and that week's host or co-host.
 *
 * Layout (2026-10-10) follows the session editor of the series mockup,
 * variant A (`docs/open/series-mockups-2026-10-10/02-series-timeline.html`):
 * a head with the session and its date and the neighbouring weeks; two wells,
 * people and words on the left, cover and materials on the right; a foot with
 * Save. Fields use the /hub/compose controls (cms-ui `WizardFieldControl`,
 * `.eac-field`/`.eac-input`) and uploads the hub's `MediaPicker`, re-tokenised
 * for the dark page in week-editor.css.
 *
 * Saves go through `/api/hub/series` (POST): one call per changed host slot
 * (`role`, `userId`), then the week's fields. The route repeats every check.
 * Uploads go to `/api/media/upload` with this week's `threadId` and
 * `occurrenceAt`, which the route uses to admit the week's host. The library
 * tab is offered to organisers only: `/api/media/library` is editor-only.
 */
export function WeekEditor({
  seriesId,
  occurrenceAt,
  initial,
  heading,
  canPlan = false,
  host = null,
  coHost = null,
  candidates = [],
  children,
}: {
  seriesId: string;
  occurrenceAt: string;
  initial: WeekEditable;
  /** "Session N", the date and time, and links to the weeks either side. */
  heading?: { number: number; when: string; prevHref?: string | null; nextHref?: string | null };
  /** An organiser: may assign hosts and browse the org's media library. */
  canPlan?: boolean;
  host?: Person | null;
  coHost?: Person | null;
  /** Who may be assigned (organisers only; empty otherwise). */
  candidates?: Person[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initial.title ?? "");
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? "");
  const [body, setBody] = useState(initial.bodyHtml ?? textToHtml(initial.summary));
  // The editor rewrites markup as it loads; only an edit the person made is sent.
  const [bodyTouched, setBodyTouched] = useState(false);
  const [cover, setCover] = useState<CoverValue | null>(
    initial.coverImageUrl
      ? (initial.coverKind ?? "image") === "image"
        ? { url: initial.coverImageUrl, kind: "image", frame: initial.coverFrame ?? null }
        : { url: initial.coverImageUrl, kind: initial.coverKind!, posterUrl: initial.coverPosterUrl ?? null }
      : null
  );
  const [materials, setMaterials] = useState(initial.materials);
  const [hostId, setHostId] = useState(host?.userId ?? "");
  const [coHostId, setCoHostId] = useState(coHost?.userId ?? "");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <>
        <div className="ifs-week__edit-bar">
          <button type="button" className="ifs-btn ifs-btn--small" onClick={() => setEditing(true)}>Edit this week</button>
        </div>
        {children}
      </>
    );
  }

  const n = heading?.number;
  const uploadFields = { threadId: seriesId, occurrenceAt };

  // Everyone who can be chosen, plus whoever holds the slot now (an
  // organiser may have assigned someone who has since left the list).
  const people = [...candidates];
  for (const p of [host, coHost]) if (p && !people.some((c) => c.userId === p.userId)) people.push(p);
  const roleField = (name: string, label: string): WizardFieldSpec => ({
    name,
    label,
    input: "select",
    placeholder: "Nobody yet",
    options: people.map((p) => ({ value: p.userId, label: p.displayName })),
  });

  function addMaterial(url: string, name?: string, external = false) {
    const clean = url.trim();
    if (!clean) return;
    const fallback = decodeURIComponent(clean.split("/").pop()?.split("?")[0] ?? "") || clean.replace(/^https?:\/\//, "");
    setMaterials((m) => [...m, { id: newId(), name: (name ?? "").trim() || fallback.slice(0, 80), url: clean, kind: kindOf(clean), external }]);
  }

  async function post(payload: Record<string, unknown>): Promise<string | null> {
    const res = await fetch("/api/hub/series", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: seriesId, occurrenceAt, ...payload }),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return body.error ?? "Could not save.";
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (canPlan) {
        if (hostId !== (host?.userId ?? "")) {
          const e = await post({ role: "host", userId: hostId || null });
          if (e) return setError(e);
        }
        if (coHostId !== (coHost?.userId ?? "")) {
          const e = await post({ role: "co-host", userId: coHostId || null });
          if (e) return setError(e);
        }
      }
      const e = await post({
        title,
        subtitle,
        ...(bodyTouched ? { bodyHtml: body } : {}),
        coverImageUrl: cover?.url ?? "",
        coverFrame: cover?.kind === "image" ? cover.frame ?? null : null,
        coverKind: cover?.kind ?? "image",
        coverPosterUrl: cover && cover.kind !== "image" ? cover.posterUrl ?? null : null,
        materials,
      });
      if (e) return setError(e);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ifs-week__compose">
      <div className="ifs-week__compose-head">
        <h2>{n ? `Session ${n}` : "This week"}</h2>
        {heading?.when && <p>{heading.when}</p>}
        {(heading?.prevHref || heading?.nextHref) && (
          <nav className="ifs-week__compose-step" aria-label="Other weeks">
            {heading.prevHref && <a className="ifs-btn ifs-btn--small" href={heading.prevHref}>‹ Previous</a>}
            {heading.nextHref && <a className="ifs-btn ifs-btn--small" href={heading.nextHref}>Next ›</a>}
          </nav>
        )}
      </div>

      <div className="ifs-week__compose-body">
        <div className="ifs-week__compose-well">
          {canPlan ? (
            <div className="eac-field-row">
              <WizardFieldControl field={roleField("week-host", "Host")} value={hostId || null} onChange={(v) => setHostId(String(v ?? ""))} />
              <WizardFieldControl field={roleField("week-cohost", "Co-host")} value={coHostId || null} onChange={(v) => setCoHostId(String(v ?? ""))} />
            </div>
          ) : (
            <div className="ifs-week__compose-roles">
              <div className="eac-field-row">
                <div className="eac-field" data-field="week-host">
                  <span className="eac-field-label">Host</span>
                  <p className="ifs-week__compose-value">{host?.displayName ?? "Nobody yet"}</p>
                </div>
                <div className="eac-field" data-field="week-cohost">
                  <span className="eac-field-label">Co-host</span>
                  <p className="ifs-week__compose-value">{coHost?.displayName ?? "Nobody yet"}</p>
                </div>
              </div>
              <p className="eac-field-hint">An organiser assigns hosts.</p>
            </div>
          )}
          <WizardFieldControl field={TITLE_FIELD} value={title} onChange={(v) => setTitle(String(v ?? ""))} />
          <WizardFieldControl field={SUBTITLE_FIELD} value={subtitle} onChange={(v) => setSubtitle(String(v ?? ""))} />
          <div className="eac-field" data-field="week-body">
            <span className="eac-field-label">Write-up</span>
            <RichTextEditor
              value={body}
              onChange={(html) => {
                setBodyTouched(true);
                setBody(emptyHtml(html) ? "" : html);
              }}
              toolbar="minimal"
              minHeight={220}
              ariaLabel="Write-up"
              placeholder="What you'll do, what to bring, what to look at before…"
            />
            <p className="eac-field-hint">Headings, lists, bold and links show on the page. Emails carry it as plain text.</p>
          </div>
        </div>

        <div className="ifs-week__compose-well">
          {/* `.eac-field` around each picker and input: the --fld-* colours
              exist only inside one. */}
          <div className="eac-field" data-field="week-cover">
            <span className="eac-field-label">Cover</span>
            <CoverField
              name="week-editor-cover"
              cover={cover}
              onChange={setCover}
              uploadEndpoint={UPLOAD_ENDPOINT}
              libraryEndpoint={canPlan ? LIBRARY_ENDPOINT : undefined}
              uploadFields={uploadFields}
              shape={{ label: "Session card and this page (wide)", aspect: 16 / 9 }}
              hint="A picture, a video file or a YouTube/Vimeo link. A video plays silently on a loop."
              overlay={
                <span className="ifs-week__compose-overlay">
                  <b>{title || "Untitled week"}</b>
                  {subtitle && <span>{subtitle}</span>}
                </span>
              }
            />
          </div>

          <div className="eac-field" data-field="materials">
            <span className="eac-field-label">Materials</span>
            {materials.length > 0 ? (
              <ul className="eac-resources-list">
                {materials.map((m) => (
                  <li key={m.id} className="eac-resource">
                    <div className="eac-resource-row">
                      <span className="ifs-week__compose-kind">{m.external ? (m.kind === "document" ? "link" : m.kind) : m.kind}</span>
                      <span className="ifs-week__compose-name" title={m.name}>{m.name}</span>
                      <button type="button" className="ifs-week__compose-remove" onClick={() => setMaterials((x) => x.filter((y) => y.id !== m.id))} aria-label={`Remove ${m.name}`}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="eac-field-hint">Nothing attached yet: a reading, a picture, a recording.</p>
            )}
            <div className="ifs-week__compose-addlink">
              <input className="eac-input" type="url" inputMode="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https:// a page, a recording, a document" aria-label="Link address" />
              <button
                type="button"
                className="ifs-btn ifs-btn--small"
                disabled={!linkUrl.trim()}
                onClick={() => {
                  addMaterial(linkUrl, undefined, true);
                  setLinkUrl("");
                }}
              >
                Add link
              </button>
            </div>
            {uploading ? (
              <MediaPicker
                value=""
                onChange={(url) => {
                  if (url) {
                    addMaterial(url);
                    setUploading(false);
                  }
                }}
                uploadEndpoint={UPLOAD_ENDPOINT}
                libraryEndpoint={canPlan ? LIBRARY_ENDPOINT : undefined}
                uploadFields={uploadFields}
                label="Upload a file"
                hint="A PDF, a document, a picture, a recording."
                accept="*/*"
              />
            ) : null}
            <button type="button" className="ifs-btn ifs-btn--small ifs-week__compose-upload" onClick={() => setUploading((u) => !u)} aria-expanded={uploading}>
              {uploading ? "Close upload" : "Upload a file"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="eac-compose-problem" role="alert">{error}</p>}
      <div className="ifs-week__compose-foot">
        <button type="button" className="ifs-week__compose-cancel" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
        <button type="button" className="ifs-btn ifs-btn--small ifs-btn--primary" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : n ? `Save session ${n}` : "Save"}
        </button>
      </div>
    </div>
  );
}
