'use client';

import * as React from 'react';
import { RichTextEditor, type WikiPageRef } from '../editor';
import { ArticleView } from '../article/ArticleView';

// ============================================================================
// The desk — where a piece is written, on the page where it will be read.
//
// Same rule as the profile and the gallery pages: you edit the thing in the
// place it lives, not in a console somewhere else. The title, the standfirst
// and the body are set in the reading faces here too, so the length of a
// paragraph on the desk is the length of a paragraph in the article.
//
// No data access and no router: every effect on the world goes through the
// server actions the host binds and passes in. That is what lets this same
// component sit on IFAC, ArtDirect or an org site without knowing which.
//
// Draft is the resting state. Nothing typed here is on anyone's public page
// until Publish is pressed, and Unpublish takes it back without destroying it
// — the piece keeps the date it first appeared.
// ============================================================================

export interface DeskPatch {
  title?: string;
  lede?: string | null;
  bodyHtml?: string;
  coverImageUrl?: string | null;
  status?: 'draft' | 'published';
}

export interface DeskResult {
  ok: boolean;
  error?: string;
  /** The slug after the save — a draft's slug follows its title. */
  slug?: string;
}

export interface WritingDeskProps {
  post: {
    id: string;
    slug: string;
    title: string;
    lede: string | null;
    bodyHtml: string;
    coverImageUrl: string | null;
    status: 'draft' | 'published';
    publishedAt: string | null;
  };
  /** Piece links are `${basePath}/${slug}`; the shelf is `basePath`. No trailing slash. */
  basePath: string;
  onSave: (patch: DeskPatch) => Promise<DeskResult>;
  onDelete?: () => Promise<DeskResult>;
  /**
   * Cover upload. The file is POSTed as multipart `file` alongside `fields`,
   * and the response is expected to carry `{ url }` — which is the shape every
   * app's /api/upload already returns.
   */
  upload?: { endpoint: string; fields?: Record<string, string> };
  /** Enables `[[` autocomplete in the body. */
  wikiPages?: WikiPageRef[];
  /** Named in the preview's byline. The desk never guesses at an author. */
  authorName?: string | null;
}

export function WritingDesk({
  post,
  basePath,
  onSave,
  onDelete,
  upload,
  wikiPages,
  authorName,
}: WritingDeskProps) {
  const base = basePath.replace(/\/$/, '');

  const [title, setTitle] = React.useState(post.title);
  const [lede, setLede] = React.useState(post.lede ?? '');
  const [body, setBody] = React.useState(post.bodyHtml);
  const [cover, setCover] = React.useState(post.coverImageUrl);
  const [status, setStatus] = React.useState(post.status);
  const [slug, setSlug] = React.useState(post.slug);

  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<null | 'save' | 'publish' | 'delete'>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // A little of the writing room, here on the profile.
  //
  // The desk was a single column of fields — correct for a form and wrong for
  // the one thing on this site that is PROSE. Writing is the case where
  // seeing the finished page as you type changes what you write, so the desk
  // borrows the room's split: the words on the left, the piece as it will
  // read on the right, set by the same `ArticleView` that renders it once
  // published. Not the whole room — there is no publish-to-a-feed decision
  // here, because a blog post goes on this page and nowhere else.
  const [view, setView] = React.useState<'write' | 'split' | 'preview'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1000 ? 'write' : 'split'
  );

  // Words and a reading time, the room's own status line. Cheap enough to do
  // on every keystroke: it is a regex over the body, not a parse.
  const words = React.useMemo(() => {
    const text = body.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ');
    const found = text.trim();
    return found ? found.split(/\s+/).filter(Boolean).length : 0;
  }, [body]);
  const minutes = Math.max(1, Math.round(words / 220));

  // A half-written paragraph is the most expensive thing on this page.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function touched<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setDirty(true);
      setNote(null);
    };
  }

  async function save(patch: DeskPatch, kind: 'save' | 'publish') {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      const result = await onSave({
        title,
        lede: lede.trim() || null,
        bodyHtml: body,
        coverImageUrl: cover,
        ...patch,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not save that.');
        return false;
      }
      if (result.slug) setSlug(result.slug);
      if (patch.status) setStatus(patch.status);
      setDirty(false);
      setNote(
        patch.status === 'published'
          ? 'Published. It is on your page now.'
          : patch.status === 'draft'
            ? 'Taken back to a draft. Only you can see it.'
            : 'Saved.'
      );
      return true;
    } catch {
      setError('Could not reach the server.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function uploadCover(file: File | undefined) {
    if (!file || !upload) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      for (const [k, v] of Object.entries(upload.fields ?? {})) form.append(k, v);
      const res = await fetch(upload.endpoint, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setError(data?.error ?? 'That image could not be uploaded.');
        return;
      }
      setCover(data.url as string);
      setDirty(true);
    } catch {
      setError('That image could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    const sure = window.confirm(
      `Delete “${post.title}”? This cannot be undone.`
    );
    if (!sure) return;
    setBusy('delete');
    setError(null);
    try {
      const result = await onDelete();
      if (!result.ok) {
        setError(result.error ?? 'Could not delete that.');
        setBusy(null);
        return;
      }
      setDirty(false);
      window.location.assign(base);
    } catch {
      setError('Could not reach the server.');
      setBusy(null);
    }
  }

  const canPublish = title.trim().length > 0;

  return (
    <div className="eac-desk">
      <div className="eac-desk__bar">
        <span className="eac-desk__status">
          {status === 'published' ? 'Published' : 'Draft'}
          {dirty ? ' · unsaved' : ''}
          {words > 0 && ` · ${words} ${words === 1 ? 'word' : 'words'} · ${minutes} min`}
        </span>

        <span className="eac-desk__seg" role="tablist" aria-label="View">
          {(['write', 'split', 'preview'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`eac-desk__seg-btn${view === v ? ' is-on' : ''}${
                v === 'split' ? ' eac-desk__seg-btn--wide' : ''
              }`}
              onClick={() => setView(v)}
            >
              {v === 'write' ? 'Write' : v === 'split' ? 'Side by side' : 'Preview'}
            </button>
          ))}
        </span>

        <span className="eac-desk__spacer" />

        <a className="eac-desk__btn" href={base}>
          All writing
        </a>

        {status === 'published' && (
          <a className="eac-desk__btn" href={`${base}/${slug}`}>
            View
          </a>
        )}

        <button
          type="button"
          className="eac-desk__btn"
          disabled={busy !== null || !dirty}
          onClick={() => void save({}, 'save')}
        >
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>

        {status === 'published' ? (
          <button
            type="button"
            className="eac-desk__btn"
            disabled={busy !== null}
            onClick={() => void save({ status: 'draft' }, 'publish')}
          >
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            className="eac-desk__btn eac-desk__btn--primary"
            disabled={busy !== null || !canPublish}
            onClick={() => void save({ status: 'published' }, 'publish')}
          >
            {busy === 'publish' ? 'Publishing…' : 'Publish'}
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="eac-desk__btn eac-desk__btn--danger"
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            Delete
          </button>
        )}
      </div>

      <div className="eac-desk__panes" data-view={view}>
      <div className="eac-desk__editor">

      <div className="eac-desk__field">
        <label className="eac-desk__label" htmlFor="eac-desk-title">
          Title
        </label>
        <input
          id="eac-desk-title"
          className="eac-desk__title-input"
          type="text"
          value={title}
          maxLength={200}
          onChange={(e) => touched(setTitle)(e.target.value)}
        />
        {status === 'published' && (
          <p className="eac-desk__note">
            Published at /{slug} — the address stays put when you change the
            title, so a link somebody kept keeps working.
          </p>
        )}
      </div>

      <div className="eac-desk__field">
        <label className="eac-desk__label" htmlFor="eac-desk-lede">
          Standfirst
        </label>
        <textarea
          id="eac-desk-lede"
          className="eac-desk__lede-input"
          rows={2}
          value={lede}
          maxLength={400}
          placeholder="One line under the title. Left blank, the opening of the piece is used."
          onChange={(e) => touched(setLede)(e.target.value)}
        />
      </div>

      {upload && (
        <div className="eac-desk__field">
          <span className="eac-desk__label">Cover</span>
          <div className="eac-desk__cover">
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="eac-desk__cover-preview" src={cover} alt="" />
            )}
            <label className="eac-desk__btn" aria-disabled={uploading}>
              {uploading ? 'Uploading…' : cover ? 'Replace' : 'Add a cover'}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploading}
                onChange={(e) => void uploadCover(e.currentTarget.files?.[0])}
              />
            </label>
            {cover && (
              <button
                type="button"
                className="eac-desk__btn"
                onClick={() => {
                  setCover(null);
                  setDirty(true);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      <div className="eac-desk__field eac-desk__body">
        <label className="eac-desk__label">The piece</label>
        <RichTextEditor
          value={body}
          onChange={touched(setBody)}
          ariaLabel="The piece"
          minHeight={420}
          placeholder="Write…"
          wikiPages={wikiPages}
          sourceThreadId={post.id}
        />
      </div>

      {error && (
        <p className="eac-desk__error" role="alert">
          {error}
        </p>
      )}
      {note && !error && <p className="eac-desk__note">{note}</p>}

      </div>

      {/* The piece as it will read. Same `ArticleView` the published page
          uses, on the same `--read-*` tokens, so this is not an
          approximation of the page — it is the page. */}
      <div className="eac-desk__preview" aria-label="Preview">
        <ArticleView
          title={title.trim() || 'Untitled'}
          lede={lede.trim() || null}
          bodyHtml={body || '<p><em>Start writing and the page appears here.</em></p>'}
          authorName={authorName ?? null}
          publishedAt={post.publishedAt ? new Date(post.publishedAt) : new Date()}
          kindLabel="Writing"
          coverImageUrl={cover}
          readingMinutes={minutes}
        />
      </div>
      </div>
    </div>
  );
}
