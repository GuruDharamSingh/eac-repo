"use client";

import * as React from "react";
import { ArticleView } from "../../article/ArticleView";
import { ContentComposer } from "../../compose/ContentComposer";
import { emptyContentAnswers, type ContentFieldContext } from "../../compose/content-fields";
import type { SurfaceAction, SurfaceDescriptor, SurfaceThread } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";
import { toPlainText } from "../format";
import { defaultThreadToAnswers } from "./ComposeSurface";

// ============================================================================
// The writing room.
//
// A blog post is `threads.kind = 'post'` — the same row an "Article" from the
// compose popup makes. What differs is the SURFACE: this one takes writing
// seriously. The words on the left, the page as it will read on the right,
// set by the same reading layer (`ArticleView`, article.css) that renders it
// once published — so the preview is not an approximation, it is the page.
//
// Title and lede are drawn here as big, borderless fields because a writing
// environment should look like a page, not a form; everything that is a
// setting (cover, which page, who can see it) sits behind one closed group at
// the bottom, through the same ContentComposer the popup uses.
//
// Saving is the host's `saveThread`, so a post written here is exactly the
// post /manage would have made. Publishing replaces this layer with the
// post's own surface.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "write" }>;
type View = "write" | "split" | "preview";

export function WriteSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, replace, pop } = useSurface();
  const layer = useLayer();
  const kind = "post" as const;
  const editing = Boolean(descriptor.threadId);

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
    ...(descriptor.prefill ?? {}),
  }));
  const [original, setOriginal] = React.useState<SurfaceThread | null>(null);
  const [loading, setLoading] = React.useState(editing);
  const [saving, setSaving] = React.useState<false | "draft" | "published">(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>();
  const [view, setView] = React.useState<View>(() =>
    typeof window !== "undefined" && window.innerWidth < 1000 ? "write" : "split"
  );
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!descriptor.threadId) return;
    let cancelled = false;
    (async () => {
      const thread = await connectors.loadThread(descriptor.threadId!).catch(() => null);
      if (cancelled) return;
      if (thread) {
        setOriginal(thread);
        const map = connectors.threadToAnswers ?? defaultThreadToAnswers;
        setAnswers({ ...emptyContentAnswers(kind, fieldContext), ...map(thread, { timeZone: connectors.timeZone }) });
      } else {
        setError("Could not load it to edit.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor.threadId]);

  const title = String(answers.title ?? "");
  React.useEffect(() => {
    layer.setMeta({ title: title.trim() || (editing ? "Edit" : "New post"), kind: "post", size: "full" });
  }, [layer, title, editing]);

  function update(fields: Record<string, unknown>) {
    setAnswers((a) => ({ ...a, ...fields }));
    setDirty(true);
  }

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
    const result = await connectors.saveThread({ kind, answers, status, threadId: descriptor.threadId });
    setSaving(false);
    if (result.ok === false) {
      setError(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }
    setDirty(false);
    connectors.onMutated?.();
    replace({
      type: "thread",
      id: result.id,
      preview: {
        title,
        kind,
        coverImageUrl: typeof answers.cover_image_url === "string" ? answers.cover_image_url : null,
      },
    });
  }

  const canSave = Boolean(connectors.saveThread) && !loading;
  const actions: SurfaceAction[] = [
    {
      label: "Simple form",
      quiet: true,
      onClick: () =>
        replace({ type: "compose", kind: "post", threadId: descriptor.threadId, prefill: answers, tier: "full" }),
    },
    { label: "Cancel", quiet: true, onClick: pop, disabled: Boolean(saving) },
    {
      label: saving === "draft" ? "Saving…" : "Save draft",
      onClick: () => save("draft"),
      disabled: !canSave || Boolean(saving),
    },
    {
      label: saving === "published" ? "Publishing…" : original?.status === "published" ? "Update" : "Publish",
      primary: true,
      onClick: () => save("published"),
      disabled: !canSave || Boolean(saving),
    },
  ];

  const status = error
    ? error
    : !connectors.saveThread
      ? "This app cannot save from here"
      : `${words} ${words === 1 ? "word" : "words"} · ${minutes} min read${dirty ? " · unsaved" : ""}`;

  const feedName = fieldContext.feeds?.find((f) => f.slug === answers.feed_slug)?.name ?? connectors.orgName ?? null;

  return (
    <SurfaceFrame
      kind="post"
      title={title.trim() || (editing ? "Edit" : "New post")}
      kicker={editing ? "Writing room · editing" : "Writing room"}
      actions={actions}
      status={status}
      statusTone={error ? "error" : "normal"}
      flush
    >
      {loading ? (
        <div style={{ padding: 22 }}>
          <SurfaceSkeleton block />
        </div>
      ) : (
        <div className="eac-write" data-view={view}>
          <div className="eac-write-bar">
            <div className="eac-seg" role="tablist" aria-label="View">
              {(["write", "split", "preview"] as View[]).map((v) => (
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
                    onChange={(a) => {
                      setAnswers(a);
                      setDirty(true);
                    }}
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
      )}
    </SurfaceFrame>
  );
}
