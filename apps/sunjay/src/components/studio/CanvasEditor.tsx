"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { savePageAction } from "@/lib/puck/actions";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";

type Rows = Record<string, Record<string, unknown>>;

const KEYS: Record<string, readonly string[]> = { ...RESOLVED_KEYS, "thread-feed": ["items"] };
const holdsData = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v !== "" : typeof v === "object" && v !== null);

/**
 * Rows a data block's resolver fetched, by node id: drawn, never saved. Only the keys the
 * resolver fills, because what is listed here wins over the node's own props when the
 * canvas draws, and a setting or a look kept here would stop answering to the panel.
 * A block that found nothing is left out, and draws its sample, labelled as one.
 */
function resolvedRows(doc: PuckDoc): Rows {
  const out: Rows = {};
  const go = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list as Array<{ type?: string; props?: Record<string, unknown> }>) {
      if (!n?.props || typeof n.props.id !== "string") continue;
      const keys = typeof n.type === "string" && Object.prototype.hasOwnProperty.call(KEYS, n.type) ? KEYS[n.type] : [];
      const rows = Object.fromEntries(keys.filter((k) => k in n.props!).map((k) => [k, n.props![k]]));
      if (Object.values(rows).some(holdsData)) out[n.props.id] = rows;
      for (const v of Object.values(n.props)) if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "props" in x)) go(v);
    }
  };
  go(doc.content);
  return out;
}

/** A template has no page of its own to look at after saving, so the reach of a save is said before it. */
const TEMPLATE_NOTICE: Record<string, string> = {
  "event-detail": "This template draws every event's page. Saving changes all of them right away.",
  "journal-piece": "This template draws every piece of writing's page. Saving changes all of them right away.",
};

/** The editor and its stylesheet load only here, on opening: a visitor's page references neither. */
export function CanvasEditor({ slug, orgId, initial }: { slug: string; orgId: string; initial: PuckDoc }) {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const [{ mountTreePage }, { canvasConfig, canvasContract }, { choosePicture }, puck, , { records }] = await Promise.all([
        import("@elkdonis/direct-edit/puck"),
        import("@/lib/puck/config.client"),
        import("@/components/studio/page-picture-chooser"),
        import("@puckeditor/core"),
        import("@elkdonis/direct-edit/direct-edit.css" as string),
        import("@/components/landing/person-records"),
      ]);
      const metadata = { orgId, slug };
      type Options = Parameters<typeof mountTreePage>[0];
      const filled = await puck.resolveAllData(initial as never, canvasConfig, metadata).catch(() => initial);
      if (cancelled || !host.current) return;
      const title = (initial.root as { props?: { title?: unknown } } | undefined)?.props?.title;
      const editor = mountTreePage({
        host: host.current,
        config: canvasConfig as unknown as Options["config"],
        contract: canvasContract as unknown as Options["contract"],
        doc: initial,
        resolved: resolvedRows(filled as PuckDoc),
        metadata,
        choosePicture,
        // "From what?" for a Featured person, an Opens and a Card's record (2026-11-07).
        records,
        pageName: typeof title === "string" && title.trim() ? title.trim() : `/${slug}`,
        // Puck's editor on the same document, for what the right column cannot draw yet (rows of a list).
        blockEditorHref: `/studio/${slug}`,
        onSave: (d) => savePageAction(slug, d),
        saveNotice: Object.prototype.hasOwnProperty.call(TEMPLATE_NOTICE, slug) ? TEMPLATE_NOTICE[slug] : undefined,
        // A template draws no page of its own: back to the page list.
        onDone: () => router.push(TEMPLATE_SLUGS.has(slug) ? "/manage/builder" : `/${slug}`),
      });
      stop = () => editor.dispose();
    })().catch((err) => {
      console.error("[canvas] open:", err);
      setFailed(true);
    });
    return () => { cancelled = true; stop?.(); };
    // Mount once per page load; the editor owns its state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return <p style={{ padding: "2rem" }}>The editor could not open. Reload the page to try again.</p>;
  return <div ref={host} style={{ minHeight: "100vh" }} />;
}
