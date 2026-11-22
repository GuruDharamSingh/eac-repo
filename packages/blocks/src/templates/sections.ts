import type { TemplateNode } from "./store";

// ============================================================================
// Sections: a few ordinary blocks, as data, that can be added to a page between
// what is already there (page-builder `sectionsPlugin`). Not a mode, not a lock:
// once added they are the page's own blocks.
//
// This is the SHARED, themed library. An app opts in by passing the list it
// wants to `sectionsPlugin` (all of it, a subset, or its own sections added to
// these); an app that passes nothing sees nothing. Built only from shared
// blocks, so any site that has those blocks in its catalogue can use them
// (sunjay's catalogue has all four used here).
//
// Words that are only there to be replaced read as placeholders on purpose:
// "Section title", "Write here...".
// ============================================================================

export interface Section {
  id: string;
  label: string;
  /** Sections are listed under their group, by purpose. */
  group: string;
  description: string;
  blocks: TemplateNode[];
}

const PLACEHOLDER_PICTURE = (n: number) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#d8d3c4"/>` +
      `<circle cx="${n}" cy="1.2" r="0.6" fill="#b3ab93"/></svg>`
  );

const heading = (subtitle: string): TemplateNode => ({
  type: "section-heading",
  props: { title: "Section title", eyebrow: "", subtitle, level: "h2", align: "start", rule: true },
});

export const SHARED_SECTIONS: Section[] = [
  {
    id: "heading-text",
    label: "Heading and text",
    group: "Words",
    description: "A section title with a paragraph under it.",
    blocks: [
      heading(""),
      {
        type: "prose",
        props: {
          body: "<p>Write here… Say what this part of the page is about, in a few sentences.</p>",
          size: "regular",
          align: "start",
          measure: true,
        },
      },
    ],
  },
  {
    id: "heading-pictures",
    label: "Heading and pictures",
    group: "Pictures",
    description: "A section title over a wall of three pictures with captions.",
    blocks: [
      heading("Write here… a line about these pictures."),
      {
        type: "picture-wall",
        props: {
          pictures: [1, 2, 3].map((n) => ({ src: PLACEHOLDER_PICTURE(n), alt: "", caption: "Caption", href: "", at: "", color: "" })),
          min: 260,
          shape: "photo",
          gap: "regular",
          captionPlace: "below",
          captionShow: "always",
        },
      },
    ],
  },
  {
    id: "heading-list",
    label: "Heading and list",
    group: "Lists",
    description: "A section title over a dated list: years and entries.",
    blocks: [
      heading(""),
      {
        type: "entry-list",
        props: {
          entries: [
            { year: "Year", text: "Write an entry here…", detail: "A detail", href: "" },
            { year: "Year", text: "Write another entry here…", detail: "", href: "" },
            { year: "Year", text: "And another…", detail: "", href: "" },
          ],
          align: "column",
          rules: true,
        },
      },
    ],
  },
];
