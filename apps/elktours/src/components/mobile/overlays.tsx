"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlaceBody } from "./place-body";
import { Sheet } from "./sheet";
import { useIsMobile } from "./use-is-mobile";
import { WEB_VIEW_EVENT, WebCard, hostOf, openWebView, type WebCardData } from "./web-view";
import { placeSheetAction, postSheetAction } from "@/lib/puck/mobile-overlay-actions";
import type { PlaceSheetData, PostSheetData } from "@/blocks/mobile/types";
import "./overlays.css";

// ============================================================================
// The phone's public sheets (G5/G6): place sheet (13), post preview (16) and web view (17). Mounted once in
// MobileShell. The place and post sheets are driven by the URL (`?place=<slug or id>`, `?post=<id>`), so any
// screen opens one with a plain link, a reload keeps it, and Back closes it. The web view is opened by
// openWebView(url) or by tapping a forum link card (the server-drawn forum cannot call it).
// ============================================================================

export function MobileOverlays() {
  const mobile = useIsMobile();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const place = params.get("place");
  const post = params.get("post");
  const [web, setWeb] = useState<{ url: string; card?: WebCardData } | null>(null);

  const closeParam = useCallback(
    (key: string) => {
      const next = new URLSearchParams(params.toString());
      next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  useEffect(() => {
    if (!mobile) return;
    const open = (e: Event) => {
      const d = (e as CustomEvent<{ url: string; card?: WebCardData }>).detail;
      if (d?.url) setWeb(d);
    };
    // Forum link cards are server-drawn anchors: take them into the web view on a phone.
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as Element | null)?.closest?.("a.gf-linkcard, a[data-m-web]") as HTMLAnchorElement | null;
      if (!a?.href) return;
      e.preventDefault();
      setWeb({
        url: a.href,
        card: {
          title: a.querySelector("strong")?.textContent ?? null,
          description: a.querySelector("small")?.textContent ?? null,
          imageUrl: a.querySelector("img")?.getAttribute("src") ?? null,
          host: hostOf(a.href),
        },
      });
    };
    window.addEventListener(WEB_VIEW_EVENT, open);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener(WEB_VIEW_EVENT, open);
      document.removeEventListener("click", click);
    };
  }, [mobile]);

  if (!mobile) return null;
  return (
    <>
      {place ? <PlaceSheet key={place} id={place} onClose={() => closeParam("place")} pathname={pathname} /> : null}
      {post ? <PostSheet key={post} id={post} onClose={() => closeParam("post")} pathname={pathname} /> : null}
      <Sheet open={!!web} onOpenChange={(o) => !o && setWeb(null)} tall title="Web page">
        {web ? (
          <div className="m-ov">
            <p className="m-kicker">Web page</p>
            <WebCard url={web.url} card={web.card} />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function useLoaded<T>(load: () => Promise<T | null>): { data: T | null; done: boolean } {
  const [state, setState] = useState<{ data: T | null; done: boolean }>({ data: null, done: false });
  useEffect(() => {
    let live = true;
    load()
      .then((d) => live && setState({ data: d, done: true }))
      .catch(() => live && setState({ data: null, done: true }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

/* ---- 13 Place sheet ---------------------------------------------------------------------------------------------- */

function PlaceSheet({ id, onClose, pathname }: { id: string; onClose: () => void; pathname: string }) {
  const { data: p, done } = useLoaded<PlaceSheetData>(() => placeSheetAction(id));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} tall title={p?.name ?? "Place"}>
      <div className="m-ov">
        {!p ? (
          <p className="m-ov-quiet">{done ? "We could not find that place." : "Loading"}</p>
        ) : (
          <>
            <PlaceBody p={p} pathname={pathname} />
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ---- 16 Post preview --------------------------------------------------------------------------------------------- */

function PostSheet({ id, onClose, pathname }: { id: string; onClose: () => void; pathname: string }) {
  const { data: p, done } = useLoaded<PostSheetData>(() => postSheetAction(id));
  const back = `${pathname}?post=${id}`;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} tall title={p?.title ?? "Post"}>
      <div className="m-ov m-ov-post">
        {!p ? (
          <p className="m-ov-quiet">{done ? "We could not find that post." : "Loading"}</p>
        ) : (
          <>
            <div className="m-ov-author">
              <span className="m-ov-initial">{p.initial}</span>
              <span><b>{p.author}</b> <span className="m-ov-quiet">· {p.whenLabel}</span></span>
            </div>
            <h2 className="m-ov-title">{p.title}</h2>
            {p.bodyHtml ? <div className="m-ov-body" dangerouslySetInnerHTML={{ __html: p.bodyHtml }} /> : null}
            {p.link ? <WebCard url={p.link.url} card={{ title: p.link.title, description: p.link.description, imageUrl: p.link.imageUrl, host: p.link.host }} compact /> : null}
            <div className="m-ov-commenthead">
              <span className="m-kicker">{p.replyCount} {p.replyCount === 1 ? "comment" : "comments"}</span>
              <Link href={p.forumHref} className="m-ov-forum">In the forum ›</Link>
            </div>
            {p.replies.length === 0 ? <p className="m-ov-quiet">No comments yet.</p> : null}
            <ul className="m-ov-replies">
              {p.replies.map((r) => (
                <li key={r.id} className="m-ov-reply">
                  <span className="m-ov-initial is-small">{r.initial}</span>
                  <div>
                    <b>{r.author}</b> <span className="m-ov-quiet">· {r.whenLabel}</span>
                    <div className="m-ov-body" dangerouslySetInnerHTML={{ __html: r.html }} />
                  </div>
                </li>
              ))}
            </ul>
            {p.canComment ? (
              <form method="post" action="/api/forum/reply" className="m-ov-commentbox">
                <input type="hidden" name="thread" value={p.id} />
                <input type="hidden" name="slug" value={p.slug} />
                <input type="hidden" name="back" value={back} />
                <textarea name="text" required rows={2} placeholder="Write a comment" aria-label="Comment" />
                <button type="submit" className="m-ov-send">Send</button>
              </form>
            ) : (
              <p className="m-ov-quiet">
                <Link href={`/login?next=${encodeURIComponent(back)}`} className="m-ov-forum">Sign in to comment</Link>
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

