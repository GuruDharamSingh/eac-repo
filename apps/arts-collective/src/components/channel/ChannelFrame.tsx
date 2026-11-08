"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceProvider, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import type { ChannelModel, Suggestion } from "@/lib/channel/model";
import { ChannelNav, type NavActive } from "./ChannelNav";
import { PieceSurface } from "./PieceSurface";
import { LibrarySurface } from "./Library";
import { QuickSheet } from "./QuickSheet";
import { AdjustSheet } from "./AdjustSheet";
import type { QuickSpec } from "./quick-spec";
import { DataCtx, useChannel, type ChannelData } from "./context";

export { CHANNEL_BASE, useChannel, suggestionInput } from "./context";

// ============================================================================
// The Channel frame: the long left column (ChannelNav) beside the page, and
// the surface stack Channel's pop-ups open in.
//
// The pop-ups are host-registered `custom` surfaces (like OrgConsoleHost's
// console bands), so the shared package gains no Channel vocabulary:
//   channel:piece    the piece pop-up (3a) and its Plan tab (3c)
//   channel:library  the content library, stacked over the piece (3b)
//   channel:quick    the quick sheet (2c), a right-hand sheet
// Custom surfaces are not written to `?surface=`, so this host keeps its own
// `?piece=<key>&tab=plan` in the address: a reload reopens the piece.
//
// The data context wraps the SurfaceProvider: the dialog renders beside the
// page, not inside it, and its surfaces read the same model.
// ============================================================================

export function ChannelFrame({ model, active, outletTab, children }: { model: ChannelModel; active: NavActive; outletTab?: string | null; children: React.ReactNode }) {
  const router = useRouter();
  const scopeOrg = model.scope.kind === "org" ? model.scope.orgId : null;
  const byKey = React.useMemo(() => new Map(model.pieces.map((p) => [p.key, p])), [model.pieces]);
  const byIdentity = React.useMemo(() => new Map(model.identities.map((i) => [i.id, i])), [model.identities]);

  const href = React.useCallback(
    (path: string, params: Record<string, string | null | undefined> = {}) => {
      const q = new URLSearchParams();
      if (scopeOrg) q.set("org", scopeOrg);
      for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
      const s = q.toString();
      return `${path}${s ? `?${s}` : ""}`;
    },
    [scopeOrg]
  );

  const data = React.useMemo<ChannelData>(
    () => ({ model, scopeOrg, href, piece: (k) => byKey.get(k), identity: (id) => (id ? byIdentity.get(id) : undefined) }),
    [model, scopeOrg, href, byKey, byIdentity]
  );

  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      // Channel opens only its own custom surfaces; it loads no threads.
      viewer: { signedIn: true, canCompose: false, displayName: model.viewer.name },
      loadThread: async () => null,
      custom: {
        "channel:piece": ({ descriptor }) => (
          <PieceSurface pieceKey={String(descriptor.props?.pieceKey ?? "")} initialTab={descriptor.props?.tab === "plan" ? "plan" : "overview"} />
        ),
        "channel:library": ({ descriptor }) => (
          <LibrarySurface fromKey={(descriptor.props?.fromKey as string | undefined) ?? null} onPick={descriptor.props?.onPick as ((key: string) => void) | undefined} />
        ),
        "channel:quick": ({ descriptor }) => <QuickSheet spec={descriptor.props?.spec as QuickSpec} />,
        "channel:adjust": ({ descriptor }) => <AdjustSheet suggestion={descriptor.props?.suggestion as Suggestion} />,
      },
      onMutated: () => router.refresh(),
    }),
    [router, model.viewer.name]
  );

  return (
    <DataCtx.Provider value={data}>
      <SurfaceProvider connectors={connectors}>
        <Inner active={active} outletTab={outletTab ?? null}>
          {children}
        </Inner>
      </SurfaceProvider>
    </DataCtx.Provider>
  );
}

function Inner({ active, outletTab, children }: { active: NavActive; outletTab: string | null; children: React.ReactNode }) {
  const { model, piece, openPiece, surface } = useChannel();

  // Open ?piece=<key> on load.
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const u = new URL(window.location.href);
    const key = u.searchParams.get("piece");
    if (key && piece(key)) openPiece(key, null, u.searchParams.get("tab") === "plan" ? "plan" : "overview");
  }, [piece, openPiece]);

  // Mirror the top piece layer into ?piece=; strip it once the stack closes.
  const top = surface.stack[surface.stack.length - 1];
  const topPiece = top?.descriptor.type === "custom" && top.descriptor.key === "channel:piece" ? String(top.descriptor.props?.pieceKey ?? "") : null;
  const depth = surface.stack.length;
  React.useEffect(() => {
    const sync = () => {
      const u = new URL(window.location.href);
      const before = u.search;
      if (topPiece) u.searchParams.set("piece", topPiece);
      else if (depth === 0) {
        u.searchParams.delete("piece");
        u.searchParams.delete("tab");
      }
      if (u.search !== before) window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
    };
    // After the provider's own history write (on close, after its history.back()).
    const t = window.setTimeout(sync, depth === 0 ? 150 : 0);
    return () => window.clearTimeout(t);
  }, [topPiece, depth]);

  return (
    <div className="chn-frame">
      <ChannelNav active={active} outletTab={outletTab} />
      <main className="chn-main" id="chn-main">
        {!model.ready && (
          <p className="chn-banner" role="status">
            Planning is not switched on yet: plans, to-dos, routines and scheduled drafts need migration 252. What is already published is shown.
          </p>
        )}
        {model.notice && (
          <p className="chn-banner" role="status">
            {model.notice}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
