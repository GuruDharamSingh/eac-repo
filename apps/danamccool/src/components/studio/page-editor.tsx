"use client";

import { useCallback, useMemo } from "react";
import { useGetPuck, type Data, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "@elkdonis/page-builder";
import { siteConfig } from "@/config/site";
import { puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";
import { PagesPanel } from "@/components/hud/pages-panel";
import { GalleriesPanel } from "@/components/hud/galleries-panel";
import { MediaPanel } from "@/components/hud/media-panel";
import { MenuTab, ThemeTab, useCanvasTheme } from "@/components/studio/editor-tabs";

/**
 * The editor, with this site's catalogue, its save action — and its HUD.
 *
 * Five tabs join Puck's own Blocks and Outline in the left rail: Pages (move
 * between pages), Galleries (her collections and the artworks in them), Media
 * (every file, and where it is used) — the same components /hub shows, see
 * components/hud — and Menu and Theme, the site-wide navigation and look,
 * previewed on the canvas itself (components/studio/editor-tabs).
 */

/** Blocks whose content comes from galleries or artworks — refetched after a HUD change. */
const DATA_BLOCKS = new Set(["dm-artwork-wall", "dm-plate", "dm-image-set", "dm-circle-text", "dm-gallery-grid"]);

function collectIds(node: unknown, out: string[]) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectIds(n, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  const item = node as { type?: string; props?: Record<string, unknown> };
  if (item.type && DATA_BLOCKS.has(item.type) && typeof item.props?.id === "string") out.push(item.props.id);
  // Slots hold blocks inside a block's props.
  if (item.props) for (const v of Object.values(item.props)) if (Array.isArray(v)) collectIds(v, out);
}

/** Rendered inside Puck, so it can reach the editor to refetch the canvas. */
function GalleriesTab({ slug, title }: { slug: string; title?: string }) {
  const getPuck = useGetPuck();
  const refresh = useCallback(() => {
    const puck = getPuck();
    const ids: string[] = [];
    collectIds(puck.appState.data.content, ids);
    ids.forEach((id) => puck.resolveDataById(id, "force"));
  }, [getPuck]);
  return <GalleriesPanel currentPage={slug} currentTitle={title} onChanged={refresh} />;
}

const icon = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export function PageEditor({ slug, initial }: { slug: string; initial: Data }) {
  const title = (initial.root as { props?: { title?: string } } | undefined)?.props?.title;
  const href = slug === "home" ? "/" : `/${slug}`;
  useCanvasTheme();
  const plugins = useMemo<Plugin[]>(
    () => [
      {
        name: "dm-pages",
        label: "Pages",
        icon: icon("M4 4h10l6 6v10H4zM14 4v6h6"),
        render: () => <PagesPanel current={slug} />,
      },
      {
        name: "dm-galleries",
        label: "Galleries",
        icon: icon("M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6"),
        render: () => <GalleriesTab slug={slug} title={title} />,
      },
      {
        name: "dm-media",
        label: "Media",
        icon: icon("M4 7h5l2-3h9v16H4zM12 11a3 3 0 100 6 3 3 0 000-6"),
        render: () => <MediaPanel />,
      },
      {
        name: "dm-menu",
        label: "Menu",
        icon: icon("M4 6h16M4 12h16M4 18h10"),
        render: () => <MenuTab current={{ label: title?.trim() || slug.split("/").pop()!.replace(/-/g, " "), href }} />,
      },
      {
        name: "dm-theme",
        label: "Theme",
        icon: icon("M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.6 0-.9-.7-1.4-.7-2.3 0-1 .8-1.6 1.8-1.6H17a4 4 0 004-4c0-4.7-4-8.5-9-8.5zM7.5 12.5h.01M9.5 8h.01M14.5 8h.01"),
        render: () => <ThemeTab />,
      },
    ],
    [slug, title, href]
  );

  return (
    <PuckEditor
      slug={slug}
      initial={initial}
      config={puckConfig}
      orgId={siteConfig.orgId}
      onPublish={savePageAction}
      plugins={plugins}
      title={slug === "home" ? "/ (home)" : `/${slug}`}
    />
  );
}
