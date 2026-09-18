"use client";

import * as React from "react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import type { ForumWikiEditorProps } from "@elkdonis/forum-ui";

/**
 * The wiki's editor on this host: the shared Tiptap editor writing HTML into
 * the plain form the package renders. The package's own fallback is a
 * textarea, so the wiki edits everywhere; this island is what a host WITH
 * JavaScript adds — `[[` page search, headings, lists, tables, images.
 *
 * The hidden `format=html` field is how the action handler knows the body is
 * already markup rather than paragraphs to wrap.
 */
export function WikiEditorIsland({ name, defaultValue, wikiPages, sourceThreadId }: ForumWikiEditorProps) {
  const [html, setHtml] = React.useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={html} />
      <input type="hidden" name="format" value="html" />
      <RichTextEditor
        value={html}
        onChange={setHtml}
        placeholder="Write the page…"
        minHeight={320}
        ariaLabel="Page body"
        wikiPages={wikiPages}
        sourceThreadId={sourceThreadId}
      />
    </>
  );
}
