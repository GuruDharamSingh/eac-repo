"use client";

import * as React from "react";
import type { ContentSuggestion } from "../model";

// What the host gives the detail. The UI imports no next/* and no app server
// actions: every write and every hand-off goes through these (cms-ui
// surface rule). Pass 1 entries map to Channel's own server actions; later
// passes route them through the action registry.

export type ContentActResult = { ok: true } | { ok: false; error: string };

export interface ContentActInputs {
  "plan.start": Record<string, never>;
  "plan.save": { bodyMd: string; expectedUpdatedAt: string | null };
  "plan.step": { index: number; done: boolean; text: string | null };
  "suggestion.accept": { suggestion: ContentSuggestion };
  "suggestion.dismiss": { suggestion: ContentSuggestion };
}
export type ContentActEntry = keyof ContentActInputs;

export type ContentLinkComponent = React.ComponentType<{ href: string; className?: string; children?: React.ReactNode }>;

export interface ContentDetailConnectors {
  /** Run a write. After `ok`, the detail calls the surface's `onMutated`. */
  act<E extends ContentActEntry>(entry: E, input: ContentActInputs[E]): Promise<ContentActResult>;
  /** A suggestion chip was clicked: the host opens its quick sheet. */
  openSuggestion?(suggestion: ContentSuggestion, origin: HTMLElement | null): void;
  /** "Adjust" on a waiting suggestion: the host opens its planner. */
  adjustSuggestion?(suggestion: ContentSuggestion, origin: HTMLElement | null): void;
  /** "Switch piece": the host opens its library. */
  switchItem?(fromKey: string): void;
  /** In-app links (Next's Link); a plain <a> when absent. */
  Link?: ContentLinkComponent;
}

export const ConnectorsCtx = React.createContext<ContentDetailConnectors | null>(null);

export function useContentConnectors(): ContentDetailConnectors {
  const c = React.useContext(ConnectorsCtx);
  if (!c) throw new Error("useContentConnectors outside ContentDetail");
  return c;
}

export function AppLink({ href, className, children }: { href: string; className?: string; children?: React.ReactNode }) {
  const { Link } = useContentConnectors();
  if (Link) return <Link href={href} className={className}>{children}</Link>;
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
