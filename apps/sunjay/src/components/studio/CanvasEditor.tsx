"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { savePageAction } from "@/lib/puck/actions";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";

// ============================================================================
// The page editor (canvas first, 2026-11-14, as hidden-enneagram on 2026-11-11):
// direct-edit's canvas on this site's pages, at /studio/<slug>. Blocks that draw a
// record sit in it sealed; their declared settings are in the right column, a
// double-click opens one alone in the block popup, and "Settings…" opens that one
// block in Puck's editor over the canvas (page-builder openBlockSettings) for what
// the column cannot draw (rows of a list, rich text, this site's pickers).
//
// Inception: the Puck sheet carries the parts plugin, so a block's parts can be
// clicked into there and "Edit look" opens direct-edit's popup over the sheet; the
// popup also offers "Settings…". Each layer stacks on the last and hands back to
// the one under it. Puck's editor on the whole page is /studio/<slug>/blocks.
// ============================================================================

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

/** The document with one node's props replaced, slots included (hidden-enneagram's). */
function withProps(doc: PuckDoc, id: string, props: Record<string, unknown>): PuckDoc {
  const go = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((n: { type?: string; props?: Record<string, unknown> }) => {
          if (!n?.props) return n;
          if (n.props.id === id) return { ...n, props: { ...props, id } };
          let next = n.props;
          for (const [k, v] of Object.entries(n.props)) if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "props" in x)) next = { ...next, [k]: go(v) };
          return next === n.props ? n : { ...n, props: next };
        })
      : list;
  return { ...doc, content: go(doc.content) } as PuckDoc;
}

/** A template has no page of its own to look at after saving, so the reach of a save is said before it. */
const TEMPLATE_NOTICE: Record<string, string> = {
  "event-detail": "This template draws every event's page. Saving changes all of them right away.",
  "journal-piece": "This template draws every piece of writing's page. Saving changes all of them right away.",
};

/** The editor and its stylesheet load only here, on opening: a visitor's page references neither. */
export function CanvasEditor({ slug, orgId, initial, blockEditorHref, record }: { slug: string; orgId: string; initial: PuckDoc; blockEditorHref?: string; record?: { threadId?: string; piece?: string } }) {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const [de, { canvasConfig, canvasContract, puckConfig }, { choosePicture }, puck, , { records }, { openBlockSettings, partsPlugin }, morph] = await Promise.all([
        import("@elkdonis/direct-edit/puck"),
        import("@/lib/puck/config.client"),
        import("@/components/studio/page-picture-chooser"),
        import("@puckeditor/core"),
        import("@elkdonis/direct-edit/direct-edit.css" as string),
        import("@/components/landing/person-records"),
        import("@elkdonis/page-builder"),
        import("@elkdonis/direct-edit/puck/morph"),
      ]);
      const { mountTreePage, mountLookPanel, openStudioPopup } = de;
      type Options = Parameters<typeof mountTreePage>[0];
      type Components = Record<string, { label?: string }>;
      const components = canvasConfig.components as unknown as Components;
      // A template opened on one record draws that gathering, post or piece (app/studio/[slug]/record.ts).
      const metadata = { orgId, slug, ...(record ?? {}) };
      const filled = await puck.resolveAllData(initial as never, canvasConfig, metadata).catch(() => initial);
      if (cancelled || !host.current) return;
      const title = (initial.root as { props?: { title?: unknown } } | undefined)?.props?.title;

      // The Puck sheet's plugins, made once: a block's parts in Puck's right column (the canvas's look panel), and
      // "Edit look" opening direct-edit's popup over the sheet, handed back into it. `developer` stays off.
      const sheetPlugins = [
        partsPlugin({
          contract: canvasContract,
          look: { partLookOf: morph.partLookOf, setPartLook: morph.setPartLook, partSafeDecls: morph.partSafeDecls },
          panel: mountLookPanel,
          developer: false,
          handBack: true,
          popup: (ctx) => openStudioPopup({ config: canvasConfig as never, contract: canvasContract as never, records }, ctx),
        }),
      ];

      let editor: ReturnType<typeof mountTreePage> | null = null;
      editor = mountTreePage({
        host: host.current,
        config: canvasConfig as unknown as Options["config"],
        contract: canvasContract as unknown as Options["contract"],
        doc: initial,
        resolved: resolvedRows(filled as PuckDoc),
        metadata,
        choosePicture,
        // "From what?" for a Featured person, an Opens and a Card's record (2026-11-07).
        records,
        // Code tab off: the site's editors are not developers (2026-11-06 decision).
        developer: false,
        // Figma basics (round 2, 2026-11-14, as hidden-enneagram): Shift+click selects several, top and left handles, snapping while resizing.
        designTools: true,
        pageName: typeof title === "string" && title.trim() ? title.trim() : `/${slug}`,
        // Puck's editor on the whole page; "Settings…" below takes this link's place in the right column.
        blockEditorHref: blockEditorHref ?? `/studio/${slug}/blocks`,
        onSave: (d) => savePageAction(slug, d),
        saveNotice: Object.prototype.hasOwnProperty.call(TEMPLATE_NOTICE, slug) ? TEMPLATE_NOTICE[slug] : undefined,
        // A template draws no page of its own: back to the page list.
        onDone: () => router.push(TEMPLATE_SLUGS.has(slug) ? "/manage/builder" : `/${slug}`),
        // Settings… also in the block popup and on a part, each layer over the last (2026-11-14).
        inception: true,
        // Puck on this one block, over the canvas or the popup. Its rows are resolved again where the block sits.
        async editSettings(node) {
          const props = await openBlockSettings({
            config: puckConfig as never,
            node,
            metadata,
            title: `${components[node.type]?.label ?? node.type}: settings`,
            strip: Object.prototype.hasOwnProperty.call(KEYS, node.type) ? KEYS[node.type] : undefined,
            plugins: sheetPlugins,
            // Esc cancels while the sheet is on top: Esc walks back down the layers to the canvas.
            escape: true,
          });
          if (!props) return null;
          const page = editor ? editor.doc() : initial;
          const rows = await puck
            .resolveAllData(withProps(page, node.props.id, props) as never, canvasConfig, metadata)
            .then((d) => resolvedRows(d as PuckDoc)[node.props.id] ?? null)
            .catch(() => null);
          return { props, resolved: rows };
        },
      });
      stop = () => editor?.dispose();
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
