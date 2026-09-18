"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { SurfaceFrame } from "../surface";
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
  onSaveError,
}: {
  endpoint?: string;
  title?: string;
  kicker?: string;
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: { scene: WhiteboardScene }) => {
        if (!cancelled) setInitialScene(data.scene);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

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
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const scene: WhiteboardScene = {
          elements: Array.from(elements),
          // Only what redrawing the same board needs — not a viewer's cursor
          // position, zoom, or collaborator list.
          appState: { viewBackgroundColor: appState.viewBackgroundColor },
          files,
        };
        fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene }),
        }).catch((error) => {
          if (onSaveError) onSaveError(error);
          else console.error("[whiteboard] autosave failed:", error);
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [endpoint, onSaveError]
  );

  return (
    <SurfaceFrame kind="neutral" title={title} kicker={kicker} flush>
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
      <div style={{ height: "70vh", minHeight: 420 }}>
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
      </div>
    </SurfaceFrame>
  );
}
