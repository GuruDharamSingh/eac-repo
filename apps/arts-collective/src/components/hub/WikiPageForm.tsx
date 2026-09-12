"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createWikiPageAction, updateWikiPageAction } from "@/lib/wiki-actions";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type WikiParentOption = {
  id: string;
  title: string;
  depth: number;
};

type Props = {
  threadId?: string;
  initialTitle?: string;
  initialBody?: string;
  initialParentId?: string | null;
  parentOptions: WikiParentOption[];
  /** Feeds `[[` autocomplete. Titles resolve server-side either way. */
  wikiPages: { title: string; slug: string }[];
  /** The version being edited, so a save can refuse to clobber a newer one. */
  updatedAt?: string;
  /** Network topics this page may carry, and which it already does. */
  topicChoices?: { id: string; name: string }[];
  initialTopicIds?: string[];
};

export function WikiPageForm({
  threadId,
  initialTitle,
  initialBody,
  initialParentId,
  parentOptions,
  wikiPages,
  updatedAt,
  topicChoices,
  initialTopicIds,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(threadId);

  const [title, setTitle] = React.useState(initialTitle ?? "");
  const [body, setBody] = React.useState(initialBody ?? "");
  const [parentId, setParentId] = React.useState(initialParentId ?? "");
  const [saving, setSaving] = React.useState(false);
  // Moves forward only when a save succeeds, so a refused save can be retried
  // against the version the other person left.
  const [base, setBase] = React.useState(updatedAt);
  const [topicIds, setTopicIds] = React.useState<string[]>(initialTopicIds ?? []);
  const [conflict, setConflict] = React.useState<{ title: string; body: string | null } | null>(
    null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { title, body, parentId: parentId || null };
      const result = isEditing
        ? await updateWikiPageAction(threadId!, {
            ...payload,
            expectedUpdatedAt: base ?? null,
            topicIds,
          })
        : await createWikiPageAction(payload);

      if (result.ok === false) {
        if ("conflict" in result) {
          // Their version is shown, yours stays in the editor untouched.
          setConflict(result.theirs);
          setBase(result.updatedAt);
          toast.error("Someone else saved first — nothing was overwritten.");
          return;
        }
        toast.error(result.error);
        return;
      }
      setConflict(null);

      toast.success(isEditing ? "Page saved." : "Page created.");
      router.push(`/hub/wiki/${result.slug}`);
      router.refresh();
    } catch (err) {
      console.error("[WikiPageForm] save failed:", err);
      toast.error("Save failed — check the browser console for details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {conflict && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-foreground">
            Someone else saved this page while you were writing.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing of yours was lost and nothing of theirs was overwritten.
            Their version is below — fold in whatever you need, then save again.
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Their version{conflict.title !== title ? ` — titled “${conflict.title}”` : ""}
            </summary>
            <div
              className="prose prose-sm mt-2 max-w-none rounded border border-border bg-background p-3 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: conflict.body ?? "<p><em>Empty.</em></p>" }}
            />
          </details>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="wiki-title">Title</Label>
        <Input
          id="wiki-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Page title"
          required
        />
        {isEditing && (
          <p className="text-xs text-muted-foreground">
            Renaming keeps the page's original address, so existing links stay good.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiki-parent">Sits under</Label>
        <select
          id="wiki-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">— Top level —</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {`${"  ".repeat(o.depth)}${o.title}`}
            </option>
          ))}
        </select>
      </div>

      {isEditing && topicChoices && topicChoices.length > 0 && (
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {topicChoices.map((t) => {
              const on = topicIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setTopicIds((ids) =>
                      on ? ids.filter((x) => x !== t.id) : [...ids, t.id]
                    )
                  }
                  className={
                    on
                      ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs text-primary"
                      : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            The same tags the rest of the network uses, so a tag leads
            somewhere beyond the wiki.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Body</Label>
        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder="Write the page…"
          minHeight={320}
          ariaLabel="Wiki page body"
          wikiPages={wikiPages}
        />
        <p className="text-xs text-muted-foreground">
          Type <code className="rounded bg-muted px-1 py-0.5">[[</code> to search
          pages, or write{" "}
          <code className="rounded bg-muted px-1 py-0.5">[[Page Name|shown text]]</code>{" "}
          to set the link text. A link to a page that doesn't exist yet shows as
          unwritten and offers to create it.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save changes" : "Create page"}
        </Button>
      </div>
    </form>
  );
}
