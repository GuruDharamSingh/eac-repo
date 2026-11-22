import type { ComponentType } from "react";
import type { DesignSystem, ThemeApp } from "@/lib/types";

/** Handed to every idea's component by the gated server page. */
export interface IdeaContext {
  designSystem: DesignSystem;
  themes: ThemeApp[];
}

/**
 * One idea = one file in src/ideas/, exporting a default `Idea`. Add it to the list in
 * ./index.ts. The component is a normal React component (server or client): write the idea
 * as a small page people can try, not a document about it.
 */
export interface Idea {
  slug: string;
  title: string;
  summary: string;
  status: "exploring" | "proposal" | "building" | "shipped" | "parked";
  added: string;
  /** Where the idea came from or how it connects: doc paths, packages. */
  refs?: string[];
  Component: ComponentType<IdeaContext>;
}
