"use client";

import { useEffect } from "react";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { registerEditPage } from "@elkdonis/house-editor/entry";

/**
 * Owners and guides get this; the server decides that, and checks again on save. It draws nothing: the one Edit button
 * (the layout's EditEntryMount) offers "Edit page", and this page says how it opens its editor in place.
 */
export function EditPageButton({ tree, resolved, version, orgId }: { tree: PuckDoc | null; /** What stored Featured people drew, by node id. */ resolved?: Record<string, Record<string, unknown>>; /** The stored page's version, for the stale-save guard. */ version?: string; orgId?: string }) {
  useEffect(() => registerEditPage(async () => {
    const { openLandingEditor } = await import("./page-editor-mount");
    await openLandingEditor({ tree, resolved, version, orgId });
  }), [tree, resolved, version, orgId]);
  return null;
}
