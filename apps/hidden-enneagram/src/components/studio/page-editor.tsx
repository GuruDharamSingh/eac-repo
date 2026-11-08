"use client";

import { useMemo } from "react";
import type { Data, Plugin } from "@puckeditor/core";
import { PuckEditor, partsPlugin } from "@elkdonis/page-builder";
import { partLookOf, partSafeDecls, setPartLook } from "@elkdonis/direct-edit/puck/morph";
import { mountLookPanel, openStudioPopup } from "@elkdonis/direct-edit/puck";
// The look panel's own sheet (every rule is prefixed de-). Editor only: this
// file is reached from /studio, never from a visitor's route.
import "@elkdonis/direct-edit/direct-edit.css";
import { canvasConfig, canvasContract, puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";

/**
 * The look layer (katie's and sunjay's): click into a block and change the
 * look of the parts it declares, stored as the node's `morph` (one undo
 * history with Puck's own edits) and drawn by MorphMark on the canvas and the
 * published page alike. "Edit look" in a block's action bar, or a double-click,
 * opens it alone in the block popup, drawn with the published-shape config
 * (canvasConfig). `developer: false` keeps the Code tab and Detach off.
 * Module scope: Puck rebuilds its whole UI when a plugin changes identity.
 */
const PARTS = partsPlugin({
  contract: canvasContract,
  look: { partLookOf, setPartLook, partSafeDecls },
  panel: mountLookPanel,
  developer: false,
  popup: (ctx) => openStudioPopup({ config: canvasConfig, contract: canvasContract }, ctx),
});

const TITLES: Record<string, string> = {
  home: "Landing (/)",
  enneagram: "The Enneagram (/enneagram)",
  readings: "Readings (/readings)",
  about: "About (/about)",
  service: "A service page (/services/…)",
  music: "Music (/music)",
};

export type StudioPageLink = { slug: string; label: string };

/**
 * Round 3: the page switcher, a "Pages" tab in the left rail. Each is a plain
 * link to /studio/<slug> (Puck keys on the slug, so the next page loads
 * fresh); unpublished changes stay behind, as with any navigation.
 */
function pagesPlugin(pages: StudioPageLink[], current: string): Plugin {
  return {
    name: "he-pages",
    label: "Pages",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="3" y="2" width="10" height="12" rx="1.5" />
        <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
      </svg>
    ),
    render: () => (
      <nav aria-label="Pages" data-he-pages="" style={{ display: "grid", gap: 2, padding: 12, font: "500 13px/1.3 system-ui, sans-serif" }}>
        {pages.map((p) => (
          <a
            key={p.slug}
            href={`/studio/${p.slug}`}
            aria-current={p.slug === current ? "page" : undefined}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              textDecoration: "none",
              color: p.slug === current ? "#fff" : "inherit",
              background: p.slug === current ? "#1d2129" : "transparent",
            }}
          >
            {p.label}
          </a>
        ))}
        <a href="/studio" style={{ padding: "8px 10px", marginTop: 6, color: "inherit", opacity: 0.7 }}>
          All pages, a new page, a reading →
        </a>
      </nav>
    ),
  };
}

/** The editor with this site's catalogue and save action bound to it. */
export function PageEditor({ slug, orgId, initial, pages = [] }: { slug: string; orgId: string; initial: Data; pages?: StudioPageLink[] }) {
  const key = JSON.stringify(pages);
  // Stable per page load: Puck rebuilds its UI when a plugin changes identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plugins = useMemo(() => [PARTS, pagesPlugin(pages, slug)], [key, slug]);
  return (
    <PuckEditor
      slug={slug}
      initial={initial}
      config={puckConfig}
      orgId={orgId}
      onPublish={savePageAction}
      plugins={plugins}
      title={TITLES[slug] ?? `/${slug}`}
    />
  );
}
