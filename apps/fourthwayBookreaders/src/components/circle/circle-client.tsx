"use client";

import * as React from "react";
import { BookOpen, ExternalLink, FileText, Maximize2, Video, X } from "lucide-react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { PdfReader } from "./pdf-reader";

/**
 * Small client pieces of the circle page. Everything here only toggles what
 * is shown; the data arrives server-rendered.
 */

/** Previous / This / Next session. Panels are server-rendered and passed in. */
export function CircleTabs({
  tabs,
  initial,
}: {
  tabs: Array<{ id: string; label: string; sub: string | null; panel: React.ReactNode }>;
  initial: string;
}) {
  const [active, setActive] = React.useState(initial);
  return (
    <div className="circle-tabs">
      <div className="circle-tabs__list" role="tablist" aria-label="Sessions">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            className="circle-tabs__tab"
            onClick={() => setActive(t.id)}
          >
            <span className="circle-tabs__label">{t.label}</span>
            {t.sub && <span className="circle-tabs__sub">{t.sub}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={active !== t.id}
          className="circle-tabs__panel"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}

/**
 * The sitting's material. "Read" opens the PDF in a pop-up reader drawn with
 * pdf.js (pdf-reader.tsx) at the page the sitting starts on — on every device,
 * phones included — so nothing navigates away from the page (or the Talk call
 * open on it).
 */
export function MaterialReader({
  items,
}: {
  items: Array<{ unitId: string; label: string; title: string; href: string | null; startPage: number; meta: string | null }>;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const current = items.find((i) => i.unitId === open && i.href);
  const dialog = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (current && !d.open) d.showModal();
    if (!current && d.open) d.close();
  }, [current]);

  return (
    <div className="circle-material">
      <ul className="circle-material__list">
        {items.map((i) => (
          <li key={i.unitId}>
            <span className="circle-material__name">
              <FileText size={14} aria-hidden /> <strong>{i.label}</strong> — {i.title}
            </span>
            {i.meta && <span className="circle-material__meta">{i.meta}</span>}
            {i.href ? (
              <span className="circle-material__actions">
                <button type="button" className="btn btn--small" onClick={() => setOpen(i.unitId)}>
                  <BookOpen size={13} aria-hidden /> {i.startPage > 1 ? `Read from p. ${i.startPage}` : "Read"}
                </button>
              </span>
            ) : (
              <span className="circle-material__meta">no file yet</span>
            )}
          </li>
        ))}
      </ul>
      <dialog ref={dialog} className="pdf-dialog" onClose={() => setOpen(null)} aria-label={current ? `${current.label} reader` : "Reader"}>
        {current && (
          <PdfReader
            url={current.href!}
            title={`${current.label} — ${current.title}`}
            startPage={current.startPage}
            onClose={() => setOpen(null)}
          />
        )}
      </dialog>
    </div>
  );
}

/** The shared rich-text editor as a form field: posts its HTML under `name`. */
export function RichField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [html, setHtml] = React.useState(defaultValue);
  return (
    <>
      <RichTextEditor value={html} onChange={setHtml} toolbar="compact" />
      <input type="hidden" name={name} value={html} />
    </>
  );
}

/**
 * A sitting's links: the circle's Talk room and the session document, as two
 * matching buttons under the reading. Each opens inside the page, full width;
 * with both open they sit side by side (.session-links__frames).
 *
 * `createDocument` is the server-action form to show when the sitting has no
 * document yet. Frames need Nextcloud's frame-ancestors to include this site
 * (Nextcloud app eac_embed); the new-tab links always work.
 */
export function SessionLinks({
  talkUrl,
  documentUrl,
  createDocument,
  only,
}: {
  talkUrl: string | null;
  documentUrl: string | null;
  createDocument: React.ReactNode;
  /** Show just the call or just the document (the page places them apart). */
  only?: "call" | "document";
}) {
  const showCall = only !== "document";
  const showDoc = only !== "call";
  const [call, setCall] = React.useState(false);
  const [doc, setDoc] = React.useState(false);
  const callRef = React.useRef<HTMLIFrameElement>(null);
  const docRef = React.useRef<HTMLIFrameElement>(null);
  const full = (ref: React.RefObject<HTMLIFrameElement | null>) => {
    const el = ref.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="session-links" data-open={call || doc}>
      <div className="session-links__buttons">
        {!showCall ? null : talkUrl ? (
          <div className="session-links__row">
            <button type="button" className="btn session-links__btn" aria-pressed={call} onClick={() => setCall((v) => !v)}>
              <Video size={14} aria-hidden /> {call ? "Leave the Talk room view" : "Join the Talk room"}
            </button>
            <a className="btn btn--small" href={talkUrl} target="_blank" rel="noreferrer" aria-label="Open the Talk room in a new tab">
              <ExternalLink size={13} aria-hidden />
            </a>
          </div>
        ) : (
          <p className="empty">No Talk room yet.</p>
        )}
        {!showDoc ? null : documentUrl ? (
          <div className="session-links__row">
            <button type="button" className="btn session-links__btn" aria-pressed={doc} onClick={() => setDoc((v) => !v)}>
              <FileText size={14} aria-hidden /> {doc ? "Close the document" : "Open the document here"}
            </button>
            <a className="btn btn--small" href={documentUrl} target="_blank" rel="noreferrer" aria-label="Open the document in a new tab">
              <ExternalLink size={13} aria-hidden />
            </a>
          </div>
        ) : (
          createDocument
        )}
      </div>

      <div className="session-links__frames" data-count={(call && talkUrl ? 1 : 0) + (doc && documentUrl ? 1 : 0)}>
      {call && talkUrl && (
        <div className="session-links__frame" data-kind="call">
          <div className="circle-reader__bar">
            <span>Talk room</span>
            <span className="session-links__tools">
              <button type="button" className="btn btn--small" onClick={() => full(callRef)}><Maximize2 size={12} aria-hidden /> Full screen</button>
              <button type="button" className="btn btn--small" onClick={() => setCall(false)} aria-label="Close the call view"><X size={12} /></button>
            </span>
          </div>
          <iframe
            ref={callRef}
            src={talkUrl}
            title="Talk room"
            allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
            allowFullScreen
          />
        </div>
      )}
      {doc && documentUrl && (
        <div className="session-links__frame" data-kind="document">
          <div className="circle-reader__bar">
            <span>Session document</span>
            <span className="session-links__tools">
              <button type="button" className="btn btn--small" onClick={() => full(docRef)}><Maximize2 size={12} aria-hidden /> Full screen</button>
              <button type="button" className="btn btn--small" onClick={() => setDoc(false)} aria-label="Close the document"><X size={12} /></button>
            </span>
          </div>
          <iframe ref={docRef} src={documentUrl} title="Session document" allow="clipboard-write; fullscreen" allowFullScreen />
        </div>
      )}
      </div>
    </div>
  );
}
