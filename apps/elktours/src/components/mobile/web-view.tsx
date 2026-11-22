"use client";

import { useEffect, useState } from "react";

// ============================================================================
// The shared "web view" (screen 17/18, G6). Most sites refuse to be framed, so the web view is the unfurled card
// (title, picture, host) with a big "Open in browser". One component, used by feed links, place websites, the post
// sheet and forum link cards. `openWebView(url, card?)` asks the sheet host (components/mobile/overlays.tsx) to show it.
// ============================================================================

export interface WebCardData {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  host?: string | null;
}

const EVENT = "m-open-web";

/** Open the web view sheet for a link. `card` is whatever is already known, so no fetch is needed. */
export function openWebView(url: string, card?: WebCardData) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { url, card } }));
}
export const WEB_VIEW_EVENT = EVENT;

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function WebCard({ url, card, compact }: { url: string; card?: WebCardData; compact?: boolean }) {
  const [data, setData] = useState<WebCardData | null>(card?.title ? card : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (card?.title) return;
    let live = true;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no preview"))))
      .then((j: WebCardData) => live && setData(j))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [url, card?.title]);

  const host = data?.host ?? card?.host ?? hostOf(url);
  const title = data?.title ?? (failed ? host : null);
  const image = data?.imageUrl ?? card?.imageUrl ?? null;
  return (
    <div className={compact ? "m-web is-compact" : "m-web"}>
      <div className="m-web-card">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="m-web-img" src={image} alt="" loading="lazy" />
        ) : null}
        <div className="m-web-body">
          <span className="m-kicker m-web-host">{host}</span>
          <span className="m-web-title">{title ?? "Loading the preview"}</span>
          {data?.description ? <span className="m-web-desc">{data.description}</span> : null}
        </div>
      </div>
      {!compact && <p className="m-web-note">Most sites do not allow a preview inside another page, so this opens in your browser.</p>}
      <a className="m-btn m-web-open" href={url} target="_blank" rel="noopener noreferrer">
        Open in browser ↗
      </a>
    </div>
  );
}
