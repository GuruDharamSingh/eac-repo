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
};

export function WikiPageForm({
  threadId,
  initialTitle,
  initialBody,
  initialParentId,
  parentOptions,
  wikiPages,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(threadId);

  const [title, setTitle] = React.useState(initialTitle ?? "");
  const [body, setBody] = React.useState(initialBody ?? "");
  const [parentId, setParentId] = React.useState(initialParentId ?? "");
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { title, body, parentId: parentId || null };
      const result = isEditing
        ? await updateWikiPageAction(threadId!, payload)
        : await createWikiPageAction(payload);

      if (result.ok === false) {
        toast.error(result.error);
        return;
      }

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
