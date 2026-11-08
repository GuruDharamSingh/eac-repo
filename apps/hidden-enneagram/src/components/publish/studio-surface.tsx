"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceFrame, useSurface, useSurfaceOptional, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { isStudioMessage } from "./bridge";

// ============================================================================
// "studio:compose": the Studio (/publish) in a popup, over whatever page Ario
// is on (round 4). The /channel pattern (a custom surface in the site's one
// SurfaceHost) carrying the `present.ts` frame idea (a same-origin page in a
// dialog): the Studio cannot be framed from the network, so it is mounted on
// this site and framed here.
//
//   - Publishing inside closes the popup; closing it any way refreshes the page
//     under it once anything was saved (router.refresh on unmount), so a draft shows too.
//   - "Open full screen" is the same address without the frame.
//   - Leaving /publish inside the frame (the Studio's ← to the hub, a "view
//     it" link) closes the popup and goes there in the page itself.
//
// Registered in components/hub/HubSurfaces.tsx under `custom` (via surfaces.tsx); opened with
// openStudio() / useOpenStudio() below.
// ============================================================================

export const STUDIO_SURFACE = "studio:compose";

export type StudioPopupKind = "writing" | "service";

export type StudioPopupOptions = {
  kind?: StudioPopupKind;
  /** Open this piece or service. */
  id?: string | null;
  /** The page a new piece goes on (a feed slug). */
  feed?: string | null;
};

export function studioHref({ kind, id, feed }: StudioPopupOptions = {}): string {
  const q = new URLSearchParams();
  if (kind && kind !== "writing") q.set("kind", kind);
  if (id) q.set("id", id);
  if (feed) q.set("feed", feed);
  const s = q.toString();
  return `/publish${s ? `?${s}` : ""}`;
}

export function studioDescriptor(opts: StudioPopupOptions = {}): Extract<SurfaceDescriptor, { type: "custom" }> {
  return {
    type: "custom",
    key: STUDIO_SURFACE,
    title: opts.kind === "service" ? (opts.id ? "Edit a service" : "A new service") : opts.id ? "Edit writing" : "Write",
    size: "full",
    kind: opts.kind === "service" ? "service" : "post",
    props: { kind: opts.kind ?? "writing", id: opts.id ?? null, feed: opts.feed ?? null },
  };
}

/**
 * Open the Studio popup; without a SurfaceHost (or with a modifier key) it is
 * a plain navigation to /publish, so a door always works.
 */
export function useOpenStudio() {
  const surface = useSurfaceOptional();
  return React.useCallback(
    (opts: StudioPopupOptions = {}, origin?: HTMLElement | null) => {
      if (!surface) {
        window.location.assign(studioHref(opts));
        return;
      }
      const d = studioDescriptor(opts);
      if (surface.stack.length > 0) surface.replace(d);
      else surface.open(d, origin ?? null);
    },
    [surface]
  );
}

function readProps(d: Extract<SurfaceDescriptor, { type: "custom" }>): StudioPopupOptions {
  const p = d.props ?? {};
  return {
    kind: p.kind === "service" ? "service" : "writing",
    id: typeof p.id === "string" ? p.id : null,
    feed: typeof p.feed === "string" ? p.feed : null,
  };
}

export function StudioComposeSurface({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const surface = useSurface();
  const router = useRouter();
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const initial = React.useMemo(() => readProps(descriptor), [descriptor]);
  // The frame's src is fixed at open; the full-screen link follows what is open inside.
  const [src] = React.useState(() => `${studioHref(initial)}${studioHref(initial).includes("?") ? "&" : "?"}framed=1`);
  const [current, setCurrent] = React.useState<StudioPopupOptions>(initial);
  const [loaded, setLoaded] = React.useState(false);
  // Set by the first save or publish inside; only then does closing refresh the page
  // under it. (Not unconditionally: React dev runs an effect cleanup once at mount, and
  // a refresh there re-rendered the host and reloaded the frame mid-typing.)
  const changed = React.useRef(false);

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      if (!isStudioMessage(e.data)) return;
      const m = e.data;
      if (m.type === "saved" || m.type === "published") changed.current = true;
      if (m.type === "saved") setCurrent((c) => ({ ...c, kind: m.kind === "service" ? "service" : "writing", id: m.id }));
      if (m.type === "published" || m.type === "close") surface.close();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [surface]);

  // However it closed, the page underneath re-reads if anything was saved.
  React.useEffect(
    () => () => {
      if (changed.current) router.refresh();
    },
    [router]
  );

  function onLoad() {
    setLoaded(true);
    let loc: Location | null = null;
    try {
      loc = frameRef.current?.contentWindow?.location ?? null;
    } catch {
      return;
    }
    if (!loc || loc.href === "about:blank") return;
    // Sign-in inside the frame comes back to /publish by itself.
    if (loc.pathname === "/publish" || loc.pathname === "/login") return;
    const to = `${loc.pathname}${loc.search}${loc.hash}`;
    surface.close();
    router.push(to);
  }

  return (
    <SurfaceFrame
      kind={descriptor.kind ?? "post"}
      title={descriptor.title ?? "Publish"}
      kicker={
        <>
          Studio ·{" "}
          <a href={studioHref(current)} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
            Open full screen
          </a>
        </>
      }
      flush
    >
      {/* Inline styles: the popup opens over any page, and this file owns no global sheet. */}
      <div className="he-studio-pop" style={{ position: "relative", height: "min(86dvh, 1100px)", minHeight: 420 }}>
        {!loaded ? (
          <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", margin: 0, opacity: 0.7 }}>
            Opening the Studio…
          </p>
        ) : null}
        <iframe
          ref={frameRef}
          src={src}
          title="Studio"
          onLoad={onLoad}
          style={{ display: "block", width: "100%", height: "100%", border: 0, opacity: loaded ? 1 : 0 }}
        />
      </div>
    </SurfaceFrame>
  );
}
