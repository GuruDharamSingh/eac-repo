"use client";

import { useEffect, useRef, useState } from "react";
import type { PuckDoc, PuckNode } from "@elkdonis/direct-edit/block";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { savePageAction } from "@/lib/puck/actions";
import { BOXED_TYPES, boxifyDoc, boxifyNode, type BoxNode } from "@/lib/puck/boxify";

// ============================================================================
// The page editor (2026-11-11, canvas first): the canvas editor of
// @elkdonis/direct-edit on this site's pages, as on sunjay. The page is a tree of
// boxes, words and pictures; the blocks that draw a record or do something (the
// figure, shelves, services, posts, people, the forum, the course, the contact
// form, readings, chapters) sit in it sealed. A sealed block's settings are in the
// right column; a double-click opens it alone in the popup; "Settings…" opens that
// one block in Puck's editor over the canvas (page-builder openBlockSettings) for
// what the column cannot draw (rows, rich text, the site's own fields). Puck's
// editor on the whole page stays at /studio/<slug>/blocks.
//
// Welcome, Opening, Passage and Glow open as boxes (lib/puck/boxify.ts) and are
// offered in Add as starting layouts, not as sealed blocks. Visitors see no
// change until Save.
// ============================================================================

type Rows = Record<string, Record<string, unknown>>;

const holdsData = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v !== "" : typeof v === "object" && v !== null);

/**
 * Rows a data block's resolver fetched, by node id: drawn, never saved (sunjay's). Only
 * the keys the resolver fills: what is listed here wins over the node's own props when
 * the canvas draws. A block that found nothing is left out and draws its sample.
 */
function resolvedRows(doc: PuckDoc): Rows {
  const out: Rows = {};
  const go = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list as Array<{ type?: string; props?: Record<string, unknown> }>) {
      if (!n?.props || typeof n.props.id !== "string") continue;
      const keys = typeof n.type === "string" && Object.prototype.hasOwnProperty.call(RESOLVED_KEYS, n.type) ? RESOLVED_KEYS[n.type]! : [];
      const rows = Object.fromEntries(keys.filter((k) => k in n.props!).map((k) => [k, n.props![k]]));
      if (Object.values(rows).some(holdsData)) out[n.props.id] = rows;
      for (const v of Object.values(n.props)) if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "props" in x)) go(v);
    }
  };
  go(doc.content);
  return out;
}

/** The templates draw many addresses; a save changes all of them. */
const TEMPLATE_NOTICE: Record<string, string> = {
  service: "This page draws every service's page. Saving changes all of them right away.",
  post: "This page draws every article. Saving changes all of them right away.",
  person: "This page draws every person's page. Saving changes all of them right away.",
};

const PUBLIC_PATH: Record<string, string> = { home: "/", service: "/readings", post: "/writing", person: "/about" };

/** The document with one node's props replaced, slots included. */
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

export function CanvasEditor({ slug, orgId, initial, blockEditorHref, publicPath }: { slug: string; orgId: string; initial: PuckDoc; blockEditorHref?: string; publicPath?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const [{ mountTreePage }, { canvasConfig, canvasContract, puckConfig }, { choosePicture }, puck, , { openBlockSettings }] = await Promise.all([
        import("@elkdonis/direct-edit/puck"),
        import("@/lib/puck/config.client"),
        import("@/components/studio/page-picture-chooser"),
        import("@puckeditor/core"),
        import("@elkdonis/direct-edit/direct-edit.css" as string),
        import("@elkdonis/page-builder"),
      ]);
      type Options = Parameters<typeof mountTreePage>[0];
      type Components = Record<string, { label?: string; defaultProps?: Record<string, unknown>; permissions?: Record<string, unknown> }>;
      const components = canvasConfig.components as unknown as Components;
      // The four word blocks are added as boxes (presets below), never sealed.
      const config = {
        ...canvasConfig,
        components: Object.fromEntries(
          Object.entries(components).map(([type, c]) => [type, BOXED_TYPES.has(type) ? { ...c, permissions: { ...(c.permissions ?? {}), insert: false } } : c]),
        ),
      };
      const presets = [...BOXED_TYPES].map((type) => ({
        id: type,
        label: components[type]?.label ?? type,
        make: () => boxifyNode({ type, props: { ...(components[type]?.defaultProps ?? {}), id: type } } as BoxNode, new Set()) as unknown as PuckNode,
      }));

      const { doc } = boxifyDoc(initial as unknown as { content: unknown[] });
      const metadata = { orgId, slug };
      const filled = await puck.resolveAllData(doc as never, canvasConfig, metadata).catch(() => doc);
      if (cancelled || !host.current) return;
      const title = (initial.root as { props?: { title?: unknown } } | undefined)?.props?.title;
      const editor = mountTreePage({
        host: host.current,
        config: config as unknown as Options["config"],
        contract: canvasContract as unknown as Options["contract"],
        doc: doc as unknown as PuckDoc,
        resolved: resolvedRows(filled as PuckDoc),
        metadata,
        choosePicture,
        presets,
        // Figma basics: Shift+click selects several, top and left handles, snapping while resizing.
        designTools: true,
        // Code tab off: the site's editors are not developers (2026-11-06 decision).
        developer: false,
        pageName: typeof title === "string" && title.trim() ? title.trim() : `/${slug}`,
        blockEditorHref: blockEditorHref ?? `/studio/${slug}/blocks`,
        onSave: (d) => savePageAction(slug, d),
        saveNotice: Object.prototype.hasOwnProperty.call(TEMPLATE_NOTICE, slug) ? TEMPLATE_NOTICE[slug] : undefined,
        onDone: () => window.location.assign(publicPath ?? PUBLIC_PATH[slug] ?? `/${slug}`),
        // Puck on this one block, over the canvas. Its rows are resolved again where the block sits (a figure in a column reads differently).
        async editSettings(node) {
          const props = await openBlockSettings({
            config: puckConfig as never,
            node,
            metadata,
            title: `${components[node.type]?.label ?? node.type}: settings`,
            strip: Object.prototype.hasOwnProperty.call(RESOLVED_KEYS, node.type) ? RESOLVED_KEYS[node.type] : undefined,
          });
          if (!props) return null;
          const next = withProps(editor.doc(), node.props.id, props);
          const rows = await puck
            .resolveAllData(next as never, canvasConfig, metadata)
            .then((d) => resolvedRows(d as PuckDoc)[node.props.id] ?? null)
            .catch(() => null);
          return { props, resolved: rows };
        },
      });
      stop = () => editor.dispose();
    })().catch((err) => {
      console.error("[canvas] open:", err);
      setFailed(true);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
    // Mount once per page load; the editor owns its state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return <p style={{ padding: "2rem" }}>The editor could not open. Reload the page to try again.</p>;
  return <div ref={host} style={{ minHeight: "100vh" }} />;
}
