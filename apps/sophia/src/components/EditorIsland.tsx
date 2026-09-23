"use client";

import * as React from "react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import type { LmsEditorProps } from "@elkdonis/lms-ui";

/**
 * The studio's body editor on this host: the network's one shared Tiptap
 * editor, writing HTML into the hidden field the package's plain form posts.
 * Without it the package falls back to a textarea, so the studio still works
 * with JavaScript off. Learner pages never load this.
 */
export function EditorIsland({ name, defaultValue, ariaLabel }: LmsEditorProps) {
  const [html, setHtml] = React.useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={html} />
      <RichTextEditor value={html} onChange={setHtml} placeholder="Write…" minHeight={280} ariaLabel={ariaLabel} />
    </>
  );
}
