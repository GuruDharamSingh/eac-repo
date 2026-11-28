"use client";

import * as React from "react";
import { SurfaceProvider } from "../surface/SurfaceProvider";
import type { SurfaceConnectors } from "../surface/types";
import { OfferEnvProvider } from "./env";
import { OfferLayer } from "./OfferLayer";
import { StackNavDriver, StackNavHolder } from "./stack";
import { OFFER_FONTS_HREF } from "./fonts";
import { OFFER_KEY, type OfferDescriptor } from "./descriptor";
import type { SurfaceActions, SurfaceSiteData } from "./types";

export interface OfferSurfaceRootProps {
  data: SurfaceSiteData;
  actions: SurfaceActions;
  /** Where "sign in" links go. Hidden when omitted. */
  signInHref?: string;
  /** Read and write `?surface=`. Default true. */
  syncUrl?: boolean;
  children: React.ReactNode;
}

/**
 * Client root for a single-page site: the look scope (font template, tint,
 * phone head mark), the site data and actions, and the surface stack with the
 * offer layers registered. Put the page inside it; the dialog renders as the
 * provider's sibling, so it sits inside the same scope.
 *
 *   <OfferSurfaceRoot data={data} actions={actions}>
 *     <OfferProfilePage data={data} />
 *   </OfferSurfaceRoot>
 */
export function OfferSurfaceRoot({ data, actions, signInHref, syncUrl = true, children }: OfferSurfaceRootProps) {
  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      viewer: { signedIn: Boolean(data.viewer?.signedIn), displayName: data.viewer?.name ?? null, canCompose: false },
      orgName: data.site.name,
      // The offer layers read the site data, not threads; the stack never asks for one.
      loadThread: async () => null,
      custom: {
        [OFFER_KEY]: ({ descriptor }: { descriptor: OfferDescriptor }) => <OfferLayer descriptor={descriptor} />,
      },
    }),
    [data.viewer?.signedIn, data.viewer?.name, data.site.name]
  );

  return (
    <>
      {/* React 19 hoists these into <head> and loads the stylesheet once, however many roots render. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={OFFER_FONTS_HREF} precedence="default" />
    <div className="eac-offer osf-root" data-ft={data.look.font} data-tint={data.look.tint ? "on" : "off"} data-mark={data.look.mark} data-sheet={data.look.sheet === "level" ? "level" : "natural"}>
      <OfferEnvProvider data={data} actions={actions} signInHref={signInHref}>
      <StackNavHolder>
        <SurfaceProvider connectors={connectors} syncUrl={syncUrl}>
          <StackNavDriver />
          {children}
        </SurfaceProvider>
      </StackNavHolder>
      </OfferEnvProvider>
    </div>
    </>
  );
}
