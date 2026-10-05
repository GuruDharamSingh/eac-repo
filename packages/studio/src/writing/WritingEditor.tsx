'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { RichTextEditor } from '@elkdonis/cms-ui/editor';
import { ArticleView } from '@elkdonis/cms-ui/article';
import { renderEssayHtml, essayWordCount, essayIsEmpty, type EssayDoc } from '@elkdonis/utils/essay';
import { Canvas } from '../canvas';
import { readMediaDrop, isMediaDrag } from '@elkdonis/cms-ui/files';
import type { StudioPatch, StudioPiece, StudioResult, StudioUpload } from '../types';
import type { ThreadCardAttrs } from '@elkdonis/utils/essay';

// ============================================================================
// The writing editor inside the Studio frame.
//
// One column at a reading measure: cover row, title, standfirst, body. The
// body is either the small rich-text editor (HTML) or, with "Use blocks" on,
// the essay canvas (a document rendered to HTML on the server). Preview
// swaps the column for the same ArticleView that renders the published
// piece; for a canvas body it renders the doc with the same function the
// server uses, so preview and page cannot drift. Saving is automatic: two
// seconds after typing stops, on Ctrl/Cmd-S, and a warning if the tab is
// closed with changes pending. Autosave never changes `status`.
//
// In focus mode (the default since 2026-10-03) the page is a title and a
// body only: the cover and the standfirst are rendered into the side menu's
// Settings section through a portal, so their state stays here, and the
// small editor uses its compact toolbar.
// ============================================================================

export type SaveState = { state: 'saved' | 'dirty' | 'saving' | 'error'; at: string | null };

export interface WritingEditorProps {
  piece: StudioPiece;
  preview: boolean;
  /** "Use blocks": the canvas instead of the small editor. */
  blocks: boolean;
  authorName: string;
  upload?: StudioUpload;
  onSave: (patch: StudioPatch) => Promise<StudioResult<StudioPiece>>;
  onSaved: (piece: StudioPiece) => void;
  onSaveState: (s: SaveState) => void;
  searchThreads: (kind: string, q: string) => Promise<Array<Omit<ThreadCardAttrs, 'view'>>>;
  /** Focus mode: title and body on the page, the rest in `asideSlot`. */
  focus?: boolean;
  /** The side menu's slot for the cover and standfirst in focus mode. */
  asideSlot?: HTMLElement | null;
  /** The body's word count, for the shell's status line. */
  onWords?: (words: number) => void;
}

const AUTOSAVE_MS = 2000;

/** The small editor normalises '' to '<p></p>' on mount; that is not a change worth a row. */
const blankHtml = (h: string) => !h.replace(/<p>(<br\s*\/?>)?<\/p>|\s/g, '');

export function WritingEditor({ piece, preview, blocks, authorName, upload, onSave, onSaved, onSaveState, searchThreads, focus = false, asideSlot = null, onWords }: WritingEditorProps) {
  const [title, setTitle] = React.useState(piece.title);
  const [lede, setLede] = React.useState(piece.lede ?? '');
  const [body, setBody] = React.useState(piece.bodyHtml);
  const [doc, setDoc] = React.useState<EssayDoc | null>(piece.bodyDoc);
  const [cover, setCover] = React.useState(piece.coverImageUrl);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // What the server has. Diffed against the fields on each save so a save
  // carries only what changed, and a no-op save is skipped. The doc is
  // compared by its serialisation: cheap at essay size.
  const server = React.useRef({
    title: piece.title,
    lede: piece.lede ?? '',
    body: piece.bodyHtml,
    doc: piece.bodyDoc ? JSON.stringify(piece.bodyDoc) : '',
    cover: piece.coverImageUrl,
  });
  const dirty = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = React.useRef(false);

  const docKey = doc ? JSON.stringify(doc) : '';

  const flush = React.useCallback(async () => {
    if (inflight.current) return;
    const patch: StudioPatch = {};
    if (title !== server.current.title) patch.title = title;
    if (lede !== server.current.lede) patch.lede = lede || null;
    if (blocks) {
      if (doc && docKey !== server.current.doc && !(server.current.doc === '' && essayIsEmpty(doc))) patch.bodyDoc = doc;
    } else if (body !== server.current.body && !(server.current.body === '' && blankHtml(body))) {
      patch.bodyHtml = body;
    }
    if (cover !== server.current.cover) patch.coverImageUrl = cover;
    if (Object.keys(patch).length === 0) {
      dirty.current = false;
      onSaveState({ state: 'saved', at: null });
      return;
    }
    if (patch.title !== undefined && !patch.title.trim()) {
      // A blank title is not sent: the piece keeps its title ("Untitled" for
      // a new one) until there is a real one to save.
      delete patch.title;
      if (Object.keys(patch).length === 0) {
        onSaveState({ state: 'dirty', at: null });
        return;
      }
    }
    inflight.current = true;
    onSaveState({ state: 'saving', at: null });
    const res = await onSave(patch);
    inflight.current = false;
    if (res.ok === false) {
      onSaveState({ state: 'error', at: null });
      return;
    }
    server.current = {
      title: title.trim() ? res.value.title : title,
      lede: res.value.lede ?? '',
      body: res.value.bodyHtml,
      // What was sent, not what came back: jsonb reorders keys, so the
      // server's copy never compares equal and autosave would loop.
      doc: patch.bodyDoc ? docKey : server.current.doc,
      cover: res.value.coverImageUrl,
    };
    dirty.current = false;
    onSaved(res.value);
    onSaveState({ state: 'saved', at: new Date().toISOString() });
  }, [title, lede, body, doc, docKey, blocks, cover, onSave, onSaved, onSaveState]);

  // Debounced autosave.
  React.useEffect(() => {
    const changed =
      title !== server.current.title ||
      lede !== server.current.lede ||
      (blocks
        ? doc !== null && docKey !== server.current.doc && !(server.current.doc === '' && essayIsEmpty(doc))
        : body !== server.current.body && !(server.current.body === '' && blankHtml(body))) ||
      cover !== server.current.cover;
    if (!changed) return;
    dirty.current = true;
    onSaveState({ state: 'dirty', at: null });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, lede, body, docKey, doc, blocks, cover, flush, onSaveState]);

  // Ctrl/Cmd-S saves now; closing with changes pending asks first.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void flush();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [flush]);

  // Switching pieces unmounts this; anything pending is saved on the way out.
  const flushRef = React.useRef(flush);
  flushRef.current = flush;
  React.useEffect(() => {
    return () => {
      if (dirty.current && !inflight.current) void flushRef.current();
    };
  }, []);

  async function pickCover(file: File) {
    if (!upload) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title || 'cover');
      for (const [k, v] of Object.entries(upload.fields ?? {})) fd.append(k, v);
      const res = await fetch(upload.endpoint, { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      setCover(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const words = React.useMemo(() => {
    if (blocks) return essayWordCount(doc);
    const text = body.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim();
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [body, doc, blocks]);
  const minutes = words >= 440 ? Math.round(words / 220) : null;
  React.useEffect(() => {
    onWords?.(words);
  }, [words, onWords]);

  if (preview) {
    const html = blocks ? renderEssayHtml(doc) : body;
    return (
      <div className="studio-preview">
        <ArticleView
          title={title || 'Untitled'}
          lede={lede || null}
          bodyHtml={html}
          authorName={authorName}
          publishedAt={piece.publishedAt}
          coverImageUrl={cover}
          readingMinutes={minutes}
          layout={piece.layout}
          series={piece.series}
        />
      </div>
    );
  }

  const coverPicker = (label: string, cls: string) => (
    <label className={cls}>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickCover(f);
          e.target.value = '';
        }}
      />
      {uploading ? 'Uploading…' : label}
    </label>
  );

  const coverRow = (
    <div
      className={`studio-coverrow ${cover ? 'has' : ''}`}
      onDragOver={(e) => {
        if (isMediaDrag(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        const hit = readMediaDrop(e);
        if (hit) {
          e.preventDefault();
          setCover(hit.url);
        }
      }}
    >
      {cover ? (
        <>
          <span className="studio-coverrow__thumb" style={{ backgroundImage: `url("${cover}")` }} aria-label="Cover image" />
          <span className="studio-coverrow__t">Cover</span>
          {upload && coverPicker('Replace', 'studio-btn studio-btn--ghost')}
          <button type="button" className="studio-btn studio-btn--ghost" onClick={() => setCover(null)}>
            Remove
          </button>
        </>
      ) : upload ? (
        coverPicker('▣ Add a cover image', 'studio-coverrow__add')
      ) : null}
    </div>
  );

  const standfirst = (
    <textarea
      className="studio-stand"
      value={lede}
      onChange={(e) => setLede(e.target.value)}
      placeholder="Standfirst — one or two sentences under the title"
      aria-label="Standfirst"
      rows={2}
      maxLength={400}
      ref={autoGrow}
    />
  );

  return (
    <div className={`studio-col ${blocks ? 'studio-col--blocks' : ''}`}>
      {!focus && (
        <div className="studio-kicker">
          <span className={`studio-pill studio-pill--${piece.status}`}>{piece.status}</span>
          <span>
            {words} words{minutes ? ` · ${minutes} min` : ''}
          </span>
          {blocks && <span className="studio-pill">blocks</span>}
          {coverRow}
        </div>
      )}
      <textarea
        className="studio-title"
        value={title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
        placeholder="Title"
        aria-label="Title"
        rows={1}
        maxLength={200}
        ref={autoGrow}
      />
      {!focus && standfirst}
      {focus &&
        asideSlot &&
        createPortal(
          <>
            <div className="studio-field">
              <span>Cover</span>
              {coverRow}
            </div>
            <label className="studio-field">
              <span>Standfirst</span>
              {standfirst}
            </label>
          </>,
          asideSlot
        )}
      {uploadError && <p className="studio-err">{uploadError}</p>}
      {blocks ? (
        <Canvas
          doc={doc}
          html={doc ? undefined : body}
          onChange={setDoc}
          upload={upload}
          card={{ search: searchThreads }}
          placeholder={focus ? 'Begin…' : 'Start writing. Add a picture, a pull quote or a card from the bar above.'}
        />
      ) : (
        <RichTextEditor
          value={body}
          onChange={setBody}
          toolbar={focus ? 'compact' : 'full'}
          placeholder={focus ? 'Begin…' : 'Start writing.'}
          minHeight={360}
          ariaLabel="Body"
          className="studio-body"
          sourceThreadId={piece.id || undefined}
        />
      )}
    </div>
  );
}

/** A textarea as tall as its text, so a title reads as a heading and not a box. */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const fit = () => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  fit();
  el.oninput = fit;
}
