import { toDefaultProps, type Block } from "@elkdonis/blocks";
import { grandForum } from "@/components/landing/forum-block";
import { offeringsBand } from "@/components/landing/offerings-block";

// ============================================================================
// The landing page's own blocks (2026-11-21), registered in both Puck configs (config.client.ts, config.server.ts).
// No database imports here: the client config reads this file.
//
//   offerings-band   "Current offerings": cover, details and a right-hand panel (RSVP, sign-in form, nothing)
//   grand-forum      "The Grand Forum": words, the forum conversation, the visitor's answer box
//
// "A mutual aid society" needs no block of its own: it is a heading and three paragraphs, which the shared blocks
// already are (section-heading, split-row, prose). `ABOUT_PATTERN` below is that arrangement as data, ready to be
// placed or kept; see IG-landing.md for why the stored About section is not converted here.
// ============================================================================

export const LANDING_BLOCKS: Block<never>[] = [offeringsBand as unknown as Block<never>, grandForum as unknown as Block<never>];

type Node = { type?: string; props?: Record<string, unknown> };

/**
 * The saved landing keeps "Current offerings" and "The Grand Forum" as live parts (finished HTML the site's code
 * draws, with nothing to set). They are the same two pieces as blocks, every setting at its default, so a part node
 * with those names is read as the block. The stored row is not changed: saving from the editor writes the block.
 */
export function swapLandingParts<T>(data: T): { data: T; swapped: number } {
  let swapped = 0;
  const walk = (list: unknown): unknown => {
    if (!Array.isArray(list)) return list;
    return (list as Node[]).map((n) => {
      if (!n || typeof n !== "object" || !n.props) return n;
      if (n.type === "part" && n.props.part === "offerings") {
        swapped++;
        return { type: "offerings-band", props: { ...toDefaultProps(offeringsBand.def), id: n.props.id } };
      }
      if (n.type === "part" && n.props.part === "forum") {
        swapped++;
        return { type: "grand-forum", props: { ...toDefaultProps(grandForum.def), id: n.props.id } };
      }
      // Slots hold lists of nodes: walk into them.
      const props = Object.fromEntries(Object.entries(n.props).map(([k, v]) => [k, Array.isArray(v) ? walk(v) : v]));
      return { ...n, props };
    });
  };
  const d = data as unknown as { content?: unknown };
  const content = walk(d.content);
  return { data: { ...(data as object), content } as T, swapped };
}

/**
 * "A Mutual Aid Society": a centred heading with the gold rule, then two columns of words. Ordinary blocks only
 * (section-heading, split-row, prose), so every word is typed on the page and every colour and face comes from the
 * blocks' own tokens. A pattern here is a PageTemplate-shaped list of nodes without ids (the shape of
 * packages/blocks/src/templates); nothing applies it yet, because the platform has no "insert a pattern into this
 * page" step, only whole-page templates for a new page.
 */
export const ABOUT_PATTERN = {
  id: "about-mutual-aid",
  name: "About: heading and two columns",
  description: "A heading with a gold rule over two columns of words.",
  content: [
    { type: "section-heading", props: { title: "A Mutual Aid Society", level: "h2", align: "center", rule: true } },
    {
      type: "split-row",
      props: {
        ratio: "even",
        align: "start",
        start: [
          { type: "prose", props: { body: "<p>Elkdonis Arts is a community organization dedicated to promoting and practicing objective arts, several forms of education, and cultural exchange for public benefit.</p>", size: "large" } },
          { type: "prose", props: { body: "<p>We provide accessible educational programs, workshops, lectures, and learning opportunities across diverse disciplines, including visual arts, theatre, philosophy, literature and cultural studies.</p>", size: "large" } },
        ],
        end: [
          { type: "prose", props: { body: "<p>Our original group was first formed in Newmarket Ontario, Canada, 1990. This collective is quintessentially nomadic, eclectic, reflexive and dedicated to seeking knowledge and passing on what we have met well.</p>", size: "large" } },
        ],
      },
    },
  ],
} as const;
