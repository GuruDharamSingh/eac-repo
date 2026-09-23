"use client";

import { useEffect, useState } from "react";
import { GalleriesPanel } from "./galleries-panel";
import { PagesPanel } from "./pages-panel";
import { MediaPanel } from "./media-panel";

// The hub's tabs. The tab lives in the address (?tab=) so a link can open a
// particular desk, and Back goes to the previous one.

const TABS = [
  { id: "galleries", label: "Galleries" },
  { id: "pages", label: "Pages" },
  { id: "media", label: "Media" },
  { id: "more", label: "Everything else" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function HubView({ tab, gallery }: { tab?: string; gallery?: string }) {
  const [current, setCurrent] = useState<Tab>(
    (TABS.find((t) => t.id === tab)?.id as Tab) ?? "galleries"
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", current);
    if (current !== "galleries") url.searchParams.delete("gallery");
    window.history.replaceState(null, "", url);
  }, [current]);

  return (
    <article className="content-page content-page--wide" style={{ maxWidth: "72rem" }}>
      <h1 className="page-title">Hub</h1>
      <div className="dm-hud" style={{ padding: 0, background: "transparent", minHeight: 0 }}>
        <nav className="dm-hud-tabs" aria-label="Hub sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={current === t.id} onClick={() => setCurrent(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ borderRadius: 8, overflow: "hidden" }}>
        {current === "galleries" ? <GalleriesPanel initialOpen={gallery} /> : null}
        {current === "pages" ? <PagesPanel /> : null}
        {current === "media" ? <MediaPanel /> : null}
        {current === "more" ? (
          <div className="dm-hud dm-hud-stack">
            <ul className="dm-hud-list" data-grid>
              {[
                ["Writing", "/blog", "Her blog — start a piece, or open one and edit it in place."],
                ["Artwork listings", "/manage/artworks", "For sale, portfolio only, or hidden — and confirm titles."],
                ["Messages", "/manage/messages", "Everything sent through the site's forms."],
                ["Edit pages", "/studio", "The visual editor, page by page."],
                ["Theme", "/studio/theme", "The site's colours and fonts."],
                ["Navigation", "/studio/navigation", "The sidebar's links, in order."],
                ["Galleries index", "/gallery", "What visitors see of her galleries."],
              ].map(([label, href, note]) => (
                <li key={href} className="dm-hud-card">
                  <div className="dm-hud-card-body">
                    <a className="dm-hud-card-title" style={{ display: "block" }} href={href}>
                      {label}
                    </a>
                    <span className="dm-hud-muted">{note}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}
