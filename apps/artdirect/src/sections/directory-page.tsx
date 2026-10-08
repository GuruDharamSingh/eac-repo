import { STYLE_PROP } from "@elkdonis/page-builder";
import { Section } from "./Section";
import type { SectionLook } from "./look";
import {
  DIRECTORY_SECTIONS,
  sectionDefaults,
  type DirectoryData,
  type DirectorySectionType,
} from "./directory";

// ============================================================================
// The directory home's page definition.
//
// Shaped like Puck's `Data.content` — an ordered list of `{ type, props }`
// with a stable `props.id` — so that when the page is opened to the editor,
// stored page JSON replaces DIRECTORY_PAGE and nothing else changes. Until
// then this constant IS the page: edit it to reorder sections or change a
// section's look.
// ============================================================================

export type SectionEntry = {
  type: DirectorySectionType;
  /** `look` is ArtDirect's type-and-ground set; `blkStyle` the studio's generic Style. */
  props: { id: string; look?: SectionLook; blkStyle?: unknown } & Record<string, unknown>;
};

export const DIRECTORY_PAGE: SectionEntry[] = [
  {
    type: "directory-intro",
    props: { id: "intro", look: { scale: "large" } },
  },
  {
    type: "directory-filters",
    props: { id: "filters", look: { ground: "folder", scale: "small" } },
  },
  {
    type: "directory-listing",
    props: { id: "listing" },
  },
];

/** Renders a page definition against this request's data. */
export function DirectoryPage({ page = DIRECTORY_PAGE, data }: { page?: SectionEntry[]; data: DirectoryData }) {
  return (
    <>
      {page.map((entry) => {
        const def = DIRECTORY_SECTIONS[entry.type];
        // An unknown type in stored JSON is skipped, not a crashed page.
        if (!def) return null;
        const { id, look, [STYLE_PROP]: blkStyle, ...content } = entry.props;
        const Component = def.Component as (p: { props: Record<string, unknown>; data: DirectoryData }) => React.ReactNode;
        return (
          <Section key={id} id={id} look={look} blkStyle={blkStyle} label={def.label}>
            <Component props={{ ...sectionDefaults(entry.type), ...content }} data={data} />
          </Section>
        );
      })}
    </>
  );
}
