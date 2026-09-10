/**
 * The catalogue of components that can appear inside authored content.
 *
 * This is the single source of truth for what an embeddable component is
 * called and what it accepts. It lives next to the renderer on purpose: adding
 * a component should mean editing one registry, not hunting down every place
 * that needs to know about it.
 *
 * Three consumers, all reading the same table:
 *   - renderSilexHtmlWithEmbeds (embeds.tsx) turns markers into React
 *   - a content compiler turns authored tags into markers
 *   - the Silex editor builds its live-slot blocks from it
 *
 * Deliberately free of React and of any Node built-in, so a compiler or a
 * client-side picker can import it without pulling the renderer in behind it.
 *
 * The rows live in `components.data.json` rather than inline, because the Silex
 * editor cannot import TypeScript: its client config is served to the browser as
 * a plain file and fetches the catalogue over HTTP (the connector serves the
 * same JSON at /eac-components.json). Keeping the data in JSON means the editor
 * and the renderer read one file instead of two lists that drift — which they
 * had: the catalogue declared 12 components, the editor offered 8.
 */

import componentData from "./components.data.json";

export type EmbedPropKind = "string" | "number" | "list";

export type EmbedProp = {
  /** Attribute suffix: `limit` becomes data-limit. */
  name: string;
  kind: EmbedPropKind;
  description: string;
};

export type EmbedComponent = {
  /** Value of data-eac-component, and the authored tag name in lower case. */
  id: string;
  /** Tag an author writes, e.g. <Rsvp />. */
  tag: string;
  label: string;
  description: string;
  props: EmbedProp[];
  /**
   * Whether an untrusted author (any member) may place this component.
   * Everything currently in the catalogue is read-only or already
   * permission-gated at render time, so all are safe; the flag exists so that
   * adding a privileged component later is a deliberate act.
   */
  memberSafe: boolean;
};

export const EMBED_COMPONENTS: EmbedComponent[] = componentData as EmbedComponent[];

const BY_TAG = new Map(
  EMBED_COMPONENTS.map((c) => [c.tag.toLowerCase(), c])
);
const BY_ID = new Map(EMBED_COMPONENTS.map((c) => [c.id, c]));

export function findComponentByTag(tag: string): EmbedComponent | null {
  return BY_TAG.get(tag.trim().toLowerCase()) ?? null;
}

export function findComponentById(id: string): EmbedComponent | null {
  return BY_ID.get(id.trim().toLowerCase()) ?? null;
}

/** Attribute values are escaped, so authored text can never break out. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Turn an authored component and its props into the marker that
 * renderSilexHtmlWithEmbeds understands.
 *
 * Unknown components return null rather than emitting a marker — an author's
 * typo should disappear, never become a mystery empty block. Unknown props are
 * dropped for the same reason: only what the registry declares gets through,
 * which is what keeps authored content from smuggling arbitrary attributes
 * into the rendered page.
 */
export function componentToEmbedMarker(
  tag: string,
  props: Record<string, string | number | undefined> = {}
): string | null {
  const component = findComponentByTag(tag);
  if (!component) return null;

  const attrs: string[] = [`data-eac-component="${component.id}"`];

  for (const prop of component.props) {
    const raw = props[prop.name];
    if (raw === undefined || raw === null || raw === "") continue;
    attrs.push(`data-${prop.name}="${escapeAttr(String(raw))}"`);
  }

  return `<eac-embed ${attrs.join(" ")}></eac-embed>`;
}
