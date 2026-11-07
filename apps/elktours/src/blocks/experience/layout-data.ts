/**
 * The experience page layout as a Puck document (`{ root, content }`): blocks
 * and their settings only, never an experience's own words. An experience's
 * `metadata.page` holds one when someone designed that page; otherwise the
 * site default (`site_config` `puck:experience-detail`), else the one below.
 * Client-safe (no database).
 */
export interface ExperienceLayoutItem {
  type: string;
  props: { id: string } & Record<string, unknown>;
}

export interface ExperienceLayoutData {
  root: { props: Record<string, unknown> };
  content: ExperienceLayoutItem[];
}

export const EXPERIENCE_LAYOUT_KEY = "puck:experience-detail";

export const EXPERIENCE_BLOCK_TYPES = [
  "ExperienceHero",
  "ExperienceIntro",
  "ExperienceMain",
  "ExperienceGallery",
  "ExperienceMore",
  "ExperienceText",
] as const;

/** What every experience shows until someone designs the layout. */
export const DEFAULT_EXPERIENCE_LAYOUT: ExperienceLayoutData = {
  root: { props: {} },
  content: [
    { type: "ExperienceHero", props: { id: "ExperienceHero-default", size: "wide" } },
    { type: "ExperienceIntro", props: { id: "ExperienceIntro-default", showFacts: true } },
    {
      type: "ExperienceMain",
      props: { id: "ExperienceMain-default", showHighlights: true, showPeople: true, showInquiry: true, inquiryHeading: "Ask about it" },
    },
    { type: "ExperienceGallery", props: { id: "ExperienceGallery-default", heading: "Pictures" } },
    { type: "ExperienceMore", props: { id: "ExperienceMore-default", heading: "More experiences", count: 3 } },
  ],
};

/** A stored document, checked: unknown block types are dropped; a document with nothing usable is null. */
export function readExperienceLayout(v: unknown): ExperienceLayoutData | null {
  const d = v as { content?: unknown; root?: unknown } | null;
  if (!d || typeof d !== "object" || !Array.isArray(d.content)) return null;
  const known = new Set<string>(EXPERIENCE_BLOCK_TYPES);
  const content = d.content.filter(
    (c): c is ExperienceLayoutItem =>
      !!c && typeof c === "object" && known.has((c as ExperienceLayoutItem).type) &&
      !!(c as ExperienceLayoutItem).props && typeof (c as ExperienceLayoutItem).props.id === "string"
  );
  if (content.length === 0) return null;
  const root = d.root && typeof d.root === "object" && (d.root as { props?: unknown }).props
    ? (d.root as ExperienceLayoutData["root"])
    : { props: {} };
  return { root, content };
}
