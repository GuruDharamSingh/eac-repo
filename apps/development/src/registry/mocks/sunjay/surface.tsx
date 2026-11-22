"use client";

import * as React from "react";
import { SurfaceProvider, useSurfaceOptional, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import "@elkdonis/cms-ui/surface.css";
import "@elkdonis/cms-ui/hub.css";
import "@elkdonis/cms-ui/hubsite.css";
import "./sunjay-mock.css";

const NONE: SurfaceConnectors = {
  viewer: { signedIn: false, canCompose: false },
  loadThread: async () => null,
};

/** The same bare provider Sunjay's own views fall back to (EnsureSurface): a face opens an empty popup, nothing is fetched. */
export function Surface({ children }: { children: React.ReactNode }) {
  const existing = useSurfaceOptional();
  if (existing) return <>{children}</>;
  return (
    <SurfaceProvider connectors={NONE} syncUrl={false}>
      {children}
    </SurfaceProvider>
  );
}

export function Heading({ text, rule = false }: { text?: string; rule?: boolean }) {
  if (!text) return null;
  return (
    <>
      <h2 className="mb-4 font-serif text-2xl">{text}</h2>
      {rule ? <hr className="saffron-divider max-w-[12rem]" /> : null}
    </>
  );
}
