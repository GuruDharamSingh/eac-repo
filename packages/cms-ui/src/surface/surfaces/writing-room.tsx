"use client";

import * as React from "react";
import { ArticleView } from "../../article/ArticleView";
import { ContentComposer } from "../../compose/ContentComposer";
import { emptyContentAnswers, type ContentFieldContext } from "../../compose/content-fields";
import type { SurfaceThread } from "../types";
import { useSurface } from "../context";
import { toPlainText } from "../format";
import { defaultThreadToAnswers } from "./ComposeSurface";

// ============================================================================
// The writing room, without the room.
//
// `WriteSurface` was the whole feature — state, saving, the split editor AND
// the dialog frame around it — which meant the one authoring surface with a
// live preview could only ever exist inside a popup. That is the wrong home
// for it: it is the longest form on the site, and a modal backdrop is one
// stray click from discarding it. The compose PAGE wanted the same room.
//
// So the room is here and the frame is the host's. `useWritingRoom` owns
// everything that is not chrome — answers, loading an existing post, word
// count, validation, saving — and hands back the pieces a masthead and a foot
// are built from. `WritingRoomBody` is the editor and the preview.
//
// Two hosts, one room: the popup (WriteSurface) and the page
// (/hub/compose?kind=post).
// ============================================================================

export type WritingView = "write" | "split" | "preview";

export interface WritingRoomOptions {
  threadId?: string;
  prefill?: Record<string, unknown>;
  /** Where to go once it saves. The popup replaces its layer; a page navigates. */
  onSaved: (result: { id: string; href?: string | null }, answers: Record<string, unknown>) => void;
}

export function useWritingRoom({ threadId, prefill, onSaved }: WritingRoomOptions) {
  const { connectors } = useSurface();
  const kind = "post" as const;
  const editing = Boolean(threadId);

  const fieldContext = React.useMemo<ContentFieldContext>(
    () => ({
      feeds: connectors.compose?.feeds,
      canShareToNetwork: connectors.compose?.canShareToNetwork,
      canCreateDocument: connectors.compose?.canCreateDocument,
    }),
    [connectors.compose]
  );

  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => ({
    ...emptyContentAnswers(kind, fieldContext),
    ...(prefill ?? {}),
  }));
  const [original, setOriginal] = React.useState<SurfaceThread | null>(null);
  const [loading, setLoading] = React.useState(editing);
  const [saving, setSaving] = React.useState<false | "draft" | "published">(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>();
  const [view, setView] = React.useState<WritingView>(() =>
    typeof window !== "undefined" && window.innerWidth < 1000 ? "write" : "split"
  );
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    (async () => {
      const thread = await connectors.loadThread(threadId).catch(() => null);
      if (cancelled) return;
      if (thread) {
        setOriginal(thread);
        const map = connectors.threadToAnswers ?? defaultThreadToAnswers;
        setAnswers({
          ...emptyContentAnswers(kind, fieldContext),
          ...map(thread, { timeZone: connectors.timeZone }),
        });
      } else {
        setError("Could not load it to edit.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const title = String(answers.title ?? "");

  /** Merge a few fields — what the title and body inputs do. */
  const update = React.useCallback((fields: Record<string, unknown>) => {
    setAnswers((a) => ({ ...a, ...fields }));
    setDirty(true);
  }, []);

  /** Replace the whole set — what ContentComposer hands back. */
  const replaceAnswers = React.useCallback((next: Record<string, unknown>) => {
    setAnswers(next);
    setDirty(true);
  }, []);

  const bodyHtml = String(answers.body ?? "");
  const words = React.useMemo(() => {
    const text = toPlainText(bodyHtml, 1_000_000);
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [bodyHtml]);
  const minutes = Math.max(1, Math.round(words / 220));

  async function save(status: "draft" | "published") {
    if (!connectors.saveThread) return;
    setError(null);
    const invalid: Record<string, string[]> = {};
    if (!title.trim()) invalid.title = ["Give it a title"];
    if (fieldContext.feeds?.length && !String(answers.feed_slug ?? "").trim()) {
      invalid.feed_slug = ["Choose which page this goes on"];
    }
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid);
      setError(Object.values(invalid)[0][0]);
      return;
    }
    setFieldErrors(undefined);
    setSaving(status);
    const result = await connectors.saveThread({ kind, answers, status, threadId });
    setSaving(false);
    // `!result.ok` does not narrow in this repo — compare explicitly.
    if (result.ok === false) {
      setError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }
    setDirty(false);
    connectors.onMutated?.();
    onSaved({ id: result.id, href: result.href }, answers);
  }

  const feedName =
    fieldContext.feeds?.find((f) => f.slug === answers.feed_slug)?.name ??
    connectors.orgName ??
    null;

  return {
    kind,
    editing,
    answers,
    update,
    replaceAnswers,
    original,
    loading,
    saving,
    error,
    fieldErrors,
    view,
    setView,
    dirty,
    title,
    words,
    minutes,
    feedName,
    save,
    canSave: Boolean(connectors.saveThread) && !loading,
    fieldContext,
    connectors,
    /** The masthead line, identical in both hosts. */
    status: error
      ? error
      : !connectors.saveThread
        ? "This app cannot save from here"
        : `${words} ${words === 1 ? "word" : "words"} · ${minutes} min read${dirty ? " · unsaved" : ""}`,
  };
}

export type WritingRoom = ReturnType<typeof useWritingRoom>;

/** The editor, the preview, and the control that switches between them. */
export function WritingRoomBody({ room }: { room: WritingRoom }) {
  const {
    view,
    setView,
    feedName,
    answers,
    update,
    replaceAnswers,
    connectors,
    fieldContext,
    fieldErrors,
    original,
    kind,
    title,
    minutes,
  } = room;
  const bodyHtml = String(answers.body ?? "");

  return (
      <div className="eac-write" data-view={view}>
        <div className="eac-write-bar">
          <div className="eac-seg" role="tablist" aria-label="View">
            {(["write", "split", "preview"] as WritingView[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`eac-seg-btn${view === v ? " is-on" : ""}${v === "split" ? " eac-seg-btn--wide-only" : ""}`}
                onClick={() => setView(v)}
              >
                {v === "write" ? "Write" : v === "split" ? "Side by side" : "Preview"}
              </button>
            ))}
          </div>
          <span className="eac-surface-record">
            {feedName ? `Publishing to ${feedName}` : "Not filed yet"}
          </span>
        </div>

        <div className="eac-write-panes">
          <div className="eac-write-editor" hidden={view === "preview"}>
            <textarea
              className="eac-write-title"
              placeholder="Title"
              rows={1}
              value={title}
              aria-label="Title"
              onChange={(e) => update({ title: e.target.value.replace(/\n/g, " ") })}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
            {fieldErrors?.title && <p className="eac-field-error">{fieldErrors.title.join(". ")}</p>}
            <textarea
              className="eac-write-lede"
              placeholder="A line or two that stands under the title. Optional."
              rows={2}
              value={String(answers.excerpt ?? "")}
              aria-label="Lede"
              onChange={(e) => update({ excerpt: e.target.value })}
            />
            <div className="eac-write-body">
              {connectors.composeSlots?.body ? (
                connectors.composeSlots.body({
                  value: bodyHtml,
                  onChange: (html) => update({ body: html }),
                  // The writing room is the full-page surface; it wants the
                  // whole toolbar, not the popup's short one.
                  tier: "full",
                })
              ) : (
                <textarea
                  className="eac-input eac-input--textarea"
                  rows={16}
                  placeholder="Start writing…"
                  value={bodyHtml}
                  onChange={(e) => update({ body: e.target.value })}
                />
              )}
            </div>

            <details className="eac-group eac-group--optional eac-write-settings">
              <summary>
                <span className="eac-group-name">Cover, page and visibility</span>
                <span className="eac-group-blurb">Where it is published, who sees it, the image on top.</span>
              </summary>
              <div className="eac-group-fields">
                <ContentComposer
                  kind={kind}
                  context={fieldContext}
                  answers={answers}
                  // `update` merges and marks dirty; the composer hands back
                  // the whole answer set, so replace rather than merge into it.
                  onChange={replaceAnswers}
                  fieldErrors={fieldErrors}
                  slots={{ media: connectors.composeSlots?.media }}
                  groups={["media", "placement", "integrations"]}
                />
              </div>
            </details>
          </div>

          <div className="eac-write-preview" hidden={view === "write"} aria-label="Preview">
            <ArticleView
              title={title.trim() || "Untitled"}
              lede={String(answers.excerpt ?? "") || null}
              bodyHtml={bodyHtml || "<p><em>Start writing and the page appears here.</em></p>"}
              authorName={connectors.viewer.displayName ?? original?.author?.name ?? null}
              publishedAt={original?.publishedAt ?? new Date()}
              kindLabel="Writing"
              org={feedName ? { name: feedName } : null}
              coverImageUrl={typeof answers.cover_image_url === "string" && answers.cover_image_url ? answers.cover_image_url : null}
              readingMinutes={minutes}
              reading={connectors.readingVoice}
            />
          </div>
        </div>
      </div>
  );
}
