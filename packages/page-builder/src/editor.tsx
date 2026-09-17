"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Puck, type Config, type Data } from "@puckeditor/core";
// The declared public specifier, not the deep dist path — both resolve today,
// only one is a promise.
import "@puckeditor/core/puck.css";

/**
 * The editor.
 *
 * Puck supplies the parts — a drawer of blocks, the canvas, the selected
 * block's fields, an outline, a viewport switcher — and this wires them to a
 * site's catalogue and its storage. The stock chrome is used deliberately:
 * Puck also exposes a composition API (`<Puck>` children + `usePuck`) for
 * building our own interface around the same engine, but that route also means
 * re-implementing the viewport/zoom canvas, which is NOT exported. Worth doing
 * when the chrome matters; not worth doing before the catalogue is worth
 * looking at.
 *
 * Publishing is an injected server action rather than anything this component
 * knows how to do. A client component is not an authorisation boundary, so the
 * role check belongs in the action, on the server, where it cannot be skipped
 * by anyone who can open dev tools.
 */
export interface PuckEditorProps {
  slug: string;
  initial: Data;
  config: Config;
  /** Ambient context for blocks and resolvers. `orgId` and `slug` are added. */
  metadata?: Record<string, unknown>;
  onPublish: (slug: string, data: Data) => Promise<{ ok: boolean; error?: string }>;
  orgId: string;
}

export function PuckEditor({
  slug,
  initial,
  config,
  metadata,
  onPublish,
  orgId,
}: PuckEditorProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // A ref rather than state: two fast clicks would both read the same `false`
  // from a state value captured at render, and publish twice. The stock header
  // never passes `loading` to its own button, so it will not stop this for us.
  const publishing = useRef(false);

  /**
   * Warn before closing with unsaved work.
   *
   * Puck keeps every edit in memory until Publish. Without this, twenty
   * minutes of arranging a page is lost by closing the tab, with no prompt —
   * which is the single worst thing a page builder can do to someone.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const publish = useCallback(
    async (data: Data) => {
      if (publishing.current) return;
      publishing.current = true;
      setStatus("Saving…");

      const res = await onPublish(slug, data);
      publishing.current = false;

      if (res.ok) {
        setDirty(false);
        setStatus("Published");
      } else {
        // Keep `dirty` true on failure: the work is still only in this tab, so
        // the leave-warning must stay armed.
        setStatus(res.error ?? "Could not save");
      }
    },
    [slug, onPublish]
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <Puck
        // Puck reads `data` ONCE, in a useState initialiser — it is an
        // uncontrolled component. Keying on the slug is what makes moving
        // between pages load the right one instead of silently keeping the
        // first page's content.
        key={slug}
        config={config}
        data={initial}
        // The sanctioned channel for ambient context. Unlike `data`, metadata
        // updates live, and it reaches every block as `props.puck.metadata`
        // and every resolver — which is how a data-driven block learns which
        // org and page it is on.
        metadata={{ ...metadata, orgId, slug }}
        onChange={() => setDirty(true)}
        onPublish={publish}
        headerTitle={`/p/${slug}`}
        headerPath={status ?? (dirty ? "Unsaved changes" : undefined)}
      />
    </div>
  );
}
