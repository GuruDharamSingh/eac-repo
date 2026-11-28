"use client";

import * as React from "react";
import type { SurfaceActions, SurfaceOffer, SurfaceProfile, SurfaceSiteData } from "./types";

// What every layer and page piece reads: the site's data, the host's actions,
// and the follow flags the visitor has changed since the page loaded.

export interface OfferEnv {
  data: SurfaceSiteData;
  actions: SurfaceActions;
  /** Where "sign in" goes; the link is hidden when absent. */
  signInHref?: string;
  isFollowing: (profileId: string) => boolean;
  setFollowing: (profileId: string, value: boolean) => void;
  findOffer: (key: string | undefined) => SurfaceOffer | undefined;
  findProfile: (id: string | undefined) => SurfaceProfile | undefined;
  /** The visitor became signed in on this page (the `join` layer): every layer then reads them as signed in. */
  setViewer: (viewer: NonNullable<SurfaceSiteData["viewer"]>) => void;
  /** Which layer (its id) pushed `join` and wants to complete its action when the visitor is back. See layers-join.tsx. */
  joinFor: React.MutableRefObject<number | null>;
}

const EnvCtx = React.createContext<OfferEnv | null>(null);

export function OfferEnvProvider({
  data,
  actions,
  signInHref,
  children,
}: {
  data: SurfaceSiteData;
  actions: SurfaceActions;
  signInHref?: string;
  children: React.ReactNode;
}) {
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [viewerNow, setViewerNow] = React.useState<SurfaceSiteData["viewer"] | undefined>(undefined);
  const joinFor = React.useRef<number | null>(null);

  const value = React.useMemo<OfferEnv>(() => {
    const profileOf = (id: string | undefined) =>
      id ? (id === data.owner.id ? data.owner : data.people[id]) : undefined;
    const live: SurfaceSiteData = viewerNow ? { ...data, viewer: viewerNow } : data;
    return {
      data: live,
      actions,
      signInHref,
      isFollowing: (id) => (id in flags ? flags[id]! : Boolean(profileOf(id)?.following)),
      setFollowing: (id, v) => setFlags((f) => ({ ...f, [id]: v })),
      findOffer: (key) => {
        if (!key) return undefined;
        if (data.featured?.key === key) return data.featured;
        return data.offers.find((o) => o.key === key);
      },
      findProfile: profileOf,
      setViewer: (v) => setViewerNow(v),
      joinFor,
    };
  }, [data, actions, signInHref, flags, viewerNow]);

  return <EnvCtx.Provider value={value}>{children}</EnvCtx.Provider>;
}

export function useOfferEnv(): OfferEnv {
  const v = React.useContext(EnvCtx);
  if (!v) throw new Error("useOfferEnv must be used inside <OfferSurfaceRoot>");
  return v;
}
