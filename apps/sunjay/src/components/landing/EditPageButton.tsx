"use client";

import { useEffect } from "react";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { registerEditPage } from "@elkdonis/house-editor/entry";

/**
 * Editors get this (the server decides that, and checks again on save). It draws nothing: the one Edit button (the
 * layout's EditEntryMount) offers "Edit page", and this page says how it opens its editor in place.
 */
export function EditPageButton({ tree }: { tree: PuckDoc | null }) {
  useEffect(() => registerEditPage(async () => {
    const { openLandingEditor } = await import("./page-editor-mount");
    await openLandingEditor({ tree });
  }), [tree]);
  return null;
}
