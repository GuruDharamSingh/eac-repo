import type { PageTemplate, TemplateNode } from "./store";

// ============================================================================
// Starting documents for a person's two ArtDirect pages (2026-09-26).
//
// Data only, like ./store.ts: block types and props, no ids. `templateDocument`
// gives every node a fresh id when a document is first made from one, because
// two nodes sharing an id break Puck's selection and drag, and because the
// published page's resolver cache is keyed by block id.
//
//   PROFILE_TEMPLATE      today's frame page (PersonPage, `standard` layout)
//                         as blocks: name and role; the card beside featured
//                         work; then galleries, writing, posts, events, store
//                         and "Member of", in the plain page's order. Every
//                         part reads the person's own data, so the document
//                         shows their page the moment it is opened.
//   SPOTLIGHT_TEMPLATE    "Single spotlight": one offering, large — picture,
//                         title, short pitch, one button. The offering is
//                         chosen in the editor; until then the block asks for one.
// ============================================================================

export const PROFILE_TEMPLATE: PageTemplate = {
  id: "person-profile",
  name: "Your page",
  description: "Your page as it is now: your card beside your featured work, then your galleries, writing, posts, events and store.",
  swatch: { ground: "#020202", ink: "#e8e3e4", accent: "#9c40d8" },
  cards: "Person page",
  content: [
    { type: "person-header", props: { showRole: true } },
    {
      type: "person-columns",
      props: {
        sidePosition: "start",
        side: [
          { type: "person-card", props: { showName: false, showPortrait: true, showBio: true, showLinks: true } },
        ],
        main: [{ type: "person-portfolio", props: { emptyMessage: "Work coming soon." } }],
      },
    },
    { type: "person-galleries", props: { heading: "Galleries" } },
    { type: "person-writing", props: { heading: "Writing", limit: 4 } },
    { type: "person-threads", props: { source: "posts", heading: "" } },
    { type: "person-threads", props: { source: "events", heading: "" } },
    { type: "person-store", props: { heading: "Store", blurb: "", density: "normal" } },
    { type: "person-memberships", props: { heading: "Member of" } },
  ],
};

export const SPOTLIGHT_TEMPLATE: PageTemplate = {
  id: "single-spotlight",
  name: "Single spotlight",
  description: "One offering, large: its picture, its title, a short pitch and one button to buy, book, RSVP or read.",
  swatch: { ground: "#020202", ink: "#e8e3e4", accent: "#20d7ff" },
  cards: "Spotlight",
  content: [
    {
      type: "offering-spotlight",
      props: {
        record: "",
        kicker: "",
        title: "",
        pitch: "",
        image: "",
        buttonLabel: "",
        href: "",
        picture: "start",
      },
    },
  ],
};

/** The featured page's promotion templates. One to start with. */
export const FEATURED_TEMPLATES: PageTemplate[] = [SPOTLIGHT_TEMPLATE];

function freshId(type: string): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${type}-${rand}`;
}

type DocNode = { type: string; props: Record<string, unknown> };

function instantiate(nodes: TemplateNode[]): DocNode[] {
  return nodes.map((node) => {
    const props: Record<string, unknown> = { ...node.props, id: freshId(node.type) };
    // A slot holds an array of nodes inside a block's props.
    for (const [key, value] of Object.entries(props)) {
      if (Array.isArray(value) && value.every((v) => v && typeof v === "object" && "type" in v && "props" in v)) {
        props[key] = instantiate(value as TemplateNode[]);
      }
    }
    return { type: node.type, props };
  });
}

/**
 * A Puck document made from a template, with fresh ids. Typed structurally
 * (this package does not import Puck); it is a valid `Data`.
 */
export function templateDocument(template: PageTemplate, title = ""): {
  root: { props: { title: string } };
  content: DocNode[];
  zones: Record<string, never>;
} {
  return { root: { props: { title } }, content: instantiate(template.content), zones: {} };
}
