"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { SurfaceFrame, SurfacePage } from "../surface";
import "@excalidraw/excalidraw/index.css";

// Excalidraw touches window/document at module load, so it can only exist
// client-side — the same reason the abandoned inner-gathering version used a
// useEffect + dynamic import(). next/dynamic with ssr:false is the pattern
// Excalidraw's own docs recommend for the App Router.
const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), {
  ssr: false,
});

interface WhiteboardScene {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

const SAVE_DEBOUNCE_MS = 1500;

// A `keepalive` request survives the page unloading, but browsers refuse one
// whose body is over 64 KiB. Under this, a save sent as the tab closes is
// kept alive; over it (a board with pasted images), it goes as an ordinary
// request and may not land — the debounced save will usually have run first.
const KEEPALIVE_MAX_BYTES = 60_000;

/**
 * What changes when the drawing changes, and nothing else. Excalidraw calls
 * onChange on every pan, zoom and selection too; comparing this skips those,
 * which would otherwise re-send the whole scene for a scroll.
 */
function sceneSignature(elements: readonly any[], background: unknown, files: unknown): string {
  const els = elements.map((e) => `${e.id}:${e.version}`).join(",");
  const fileIds = files && typeof files === "object" ? Object.keys(files).sort().join(",") : "";
  return `${els}|${String(background ?? "")}|${fileIds}`;
}

/**
 * The org's one shared whiteboard. Loads the saved scene, then autosaves
 * (debounced) on every change — no explicit save button, the same as a
 * living document.
 *
 * Lifted out of apps/amrit-canada when IFAC wanted the same thing, rather
 * than becoming a second copy. The two hard-won fixes below — the top-layer
 * portal and the `[popover]` style reset — are the whole reason this is worth
 * sharing: both are non-obvious, both took a real debugging session, and
 * neither is something a second app should have to rediscover.
 *
 * `@excalidraw/excalidraw` is an OPTIONAL peer of this package. It is a large
 * dependency and most cms-ui consumers never draw anything, so only an app
 * that imports this subpath has to install it. The import below is lazy and
 * client-only, so an app that installs it but never opens the surface does
 * not pay for it either.
 */
export function WhiteboardSurface({
  /** Where the scene is read and written. Defaults to the shared route name. */
  endpoint = "/api/hub/whiteboard",
  title = "Whiteboard",
  kicker = "Shared with everyone in the group",
  variant = "popup",
  pageHref = "/hub/whiteboard",
  backHref = "/hub",
  backLabel = "Back to the hub",
  onSaveError,
}: {
  endpoint?: string;
  title?: string;
  kicker?: string;
  /**
   * `popup` (the default) renders inside the surface dialog. `page` renders
   * the same board as a routed page: full height, no close button, a back
   * link in its place. Each host app's `/hub/whiteboard` route is the page.
   */
  variant?: "popup" | "page";
  /** The popup's "Open as a page" link. `null` hides it (an app with no page). */
  pageHref?: string | null;
  /** Where the page variant's back link goes. */
  backHref?: string;
  backLabel?: string;
  /**
   * Called when an autosave fails. The amrit-local version raised a `sonner`
   * toast directly; cms-ui deliberately depends on no toast library — every
   * app carries its own — so the host passes one in. Unhandled, the failure
   * is logged and the drawing stays on screen, which is the right default:
   * a dropped save is not worth destroying what the person just drew.
   */
  onSaveError?: (error: unknown) => void;
} = {}) {
  const [initialScene, setInitialScene] = useState<WhiteboardScene | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Shown in the foot of both variants, so a refused save is visible even on
  // the page, where the host has no toast wired in.
  const [saveFailed, setSaveFailed] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The scene waiting out the debounce. Held in a ref rather than only in the
  // timer's closure so that closing the popup, leaving the page or following
  // a link can send it at once instead of dropping it with the timer.
  const pendingScene = useRef<WhiteboardScene | null>(null);
  const lastSignature = useRef<string | null>(null);
  const onSaveErrorRef = useRef(onSaveError);
  onSaveErrorRef.current = onSaveError;

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: { scene: WhiteboardScene }) => {
        if (cancelled) return;
        const scene = data.scene ?? { elements: [] };
        lastSignature.current = sceneSignature(
          scene.elements ?? [],
          scene.appState?.viewBackgroundColor,
          scene.files
        );
        setInitialScene(scene);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    (scene: WhiteboardScene, keepalive = false): Promise<void> => {
      const body = JSON.stringify({ scene });
      return fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: keepalive && body.length < KEEPALIVE_MAX_BYTES,
      })
        .then((res) => {
          // fetch resolves on a 403 or 400; without this a refused save was
          // indistinguishable from a good one.
          if (!res.ok) throw new Error(`Whiteboard save failed (${res.status})`);
          setSaveFailed(false);
        })
        .catch((error) => {
          setSaveFailed(true);
          if (onSaveErrorRef.current) onSaveErrorRef.current(error);
          else console.error("[whiteboard] autosave failed:", error);
        });
    },
    [endpoint]
  );

  /** Send the scene still waiting out the debounce, if there is one. */
  const flush = useCallback(
    (keepalive = false): Promise<void> => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const scene = pendingScene.current;
      if (!scene) return Promise.resolve();
      pendingScene.current = null;
      return send(scene, keepalive);
    },
    [send]
  );

  // Closing the popup unmounts this component, and leaving the page fires
  // pagehide; both used to cancel the timer and lose the last 1.5 s of
  // drawing. Both now send it. A hidden tab also flushes, since a phone may
  // discard a backgrounded tab without ever firing pagehide.
  useEffect(() => {
    const onPageHide = () => void flush(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      void flush(true);
    };
  }, [flush]);

  /** Follow a link only once the last strokes are saved. */
  const leaveTo = useCallback(
    async (href: string) => {
      await flush();
      window.location.assign(href);
    },
    [flush]
  );

  // Excalidraw's own Export/Save dialog always portals into `document.body`
  // (its Modal component has no prop to redirect this). Our surface popup is
  // a native <dialog> — the browser's "top layer" — which paints above every
  // ordinary body element regardless of z-index, so that portal renders
  // invisibly behind the whiteboard until the whole surface closes. Moving
  // the node itself would break Excalidraw's own cleanup (it calls
  // `document.body.removeChild` on the exact node it appended, which throws
  // once that node has a different parent). Promoting it into the top layer
  // in place — via the Popover API, without reparenting — puts it back on
  // top, ordered after our already-open dialog, with no such conflict.
  useEffect(() => {
    if (typeof HTMLElement === "undefined" || !("showPopover" in HTMLElement.prototype)) return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            node.parentElement === document.body &&
            node.classList.contains("excalidraw-modal-container") &&
            !node.hasAttribute("popover")
          ) {
            try {
              node.setAttribute("popover", "manual");
              node.showPopover();
            } catch {
              // Unsupported or already showing — it renders behind the
              // surface as before, no worse than without this effect.
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  const handleChange = useCallback(
    // Excalidraw's own element/appState/file types aren't worth importing for
    // storage that only ever round-trips them opaquely — see WhiteboardScene.
    (elements: any, appState: any, files: any) => {
      const list = Array.from(elements as readonly any[]);
      const signature = sceneSignature(list, appState.viewBackgroundColor, files);
      if (signature === lastSignature.current) return;
      lastSignature.current = signature;

      pendingScene.current = {
        elements: list,
        // Only what redrawing the same board needs — not a viewer's cursor
        // position, zoom, or collaborator list.
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
        files,
      };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  const status = saveFailed ? "Couldn\u2019t save the latest change. Your next stroke will try again." : undefined;

  const board = (
    <>
      {/* The browser's default popover styling (a border, padding, a solid
          background) would otherwise show through around Excalidraw's own
          modal — Excalidraw's stylesheet only styles `position`/`z-index`
          on this class, having never expected `[popover]` to be involved. */}
      <style>{`
        .excalidraw-modal-container[popover] {
          /* Excalidraw's own rule on this class is position:absolute, and an
             author class beats the UA's [popover] position:fixed — so the
             promoted node anchored to the top of the DOCUMENT. Scroll the
             hub down to reach the tile (you always have) and its dialog
             opened above the viewport: half cut off on IFAC, wholly off on
             innergathering's longer page. Fixed + inset 0 pins it to the
             viewport; the .Modal inside is absolute inset 0 and fills it. */
          position: fixed;
          inset: 0;
          margin: 0;
          padding: 0;
          border: none;
          width: auto;
          height: auto;
          overflow: visible;
          color: inherit;
          background-color: transparent;
        }
      `}</style>
      {loadError ? (
        <p className="eac-board-note">Couldn&rsquo;t load the whiteboard. Try again.</p>
      ) : initialScene === null ? (
        <p className="eac-board-note">Loading…</p>
      ) : (
        <Excalidraw
          initialData={
            {
              elements: initialScene.elements,
              appState: { ...(initialScene.appState ?? {}), collaborators: new Map() },
              files: initialScene.files,
            } as any
          }
          onChange={handleChange}
        />
      )}
    </>
  );

  if (variant === "page") {
    return (
      <SurfacePage
        kind="neutral"
        title={title}
        kicker={kicker}
        className="eac-whiteboard-page"
        status={status}
        crumb={
          <a
            href={backHref}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              void leaveTo(backHref);
            }}
          >
            ← {backLabel}
          </a>
        }
      >
        <style>{`
          .eac-whiteboard-page { padding: 16px; }
          .eac-whiteboard-page .eac-surface-panel--page .eac-surface-main { padding: 0; }
          .eac-whiteboard-page .eac-whiteboard-canvas {
            /* The page's own head and crumb take about 150px; the board
               gets the rest of the screen rather than the popup's 70%. */
            height: calc(100dvh - 170px);
            min-height: 480px;
          }
        `}</style>
        <div className="eac-whiteboard-canvas">{board}</div>
      </SurfacePage>
    );
  }

  return (
    <SurfaceFrame
      kind="neutral"
      title={title}
      kicker={kicker}
      flush
      status={status}
      statusTone="error"
      actions={
        pageHref
          ? [{ label: "Open as a page", quiet: true, onClick: () => leaveTo(pageHref) }]
          : undefined
      }
    >
      <div style={{ height: "70vh", minHeight: 420 }}>{board}</div>
    </SurfaceFrame>
  );
}
