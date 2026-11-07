import { createElement, type ReactNode } from "react";
import type { Block, BlockDef } from "@elkdonis/blocks";
import { FORUM_PARTS, STANDING_PARTS } from "./shared-parts";

// ============================================================================
// The home page's live pieces as sealed blocks (2026-11-05). `app/page.tsx` draws what is in them, with current data
// and for the current viewer, and hands it over in `metadata.parts`; an editor gets the HTML a visitor gets. So a
// stored home page shows the same components as the coded one, and each piece opens in the popup, where a look is
// stored as `morph` like any other block's. Server-safe: no hooks. Only `config.landing.ts` lists these: they draw
// nothing on any other page.
// ============================================================================

type Id = "home-stage" | "home-standing" | "home-forum" | "home-join";

const CLASSES: Partial<Record<Id, string>> = {
  "home-stage": "pts-wrap pts-hero__stage",
  "home-standing": "landing-standing",
};

/** The element a piece's look is scoped to, on the coded page and in a stored one alike. */
export function LiveRoot({ id, html, children }: { id: Id; html?: string; children?: ReactNode }): ReactNode {
  const attrs = { "data-landing-block": id, className: CLASSES[id] };
  return html === undefined ? createElement("div", attrs, children) : createElement("div", { ...attrs, dangerouslySetInnerHTML: { __html: html } });
}

function piece(id: Id) {
  return function LivePiece({ puck }: { puck?: { metadata?: { parts?: Record<string, ReactNode> } } }): ReactNode {
    const v = puck?.metadata?.parts?.[id];
    return typeof v === "string" ? createElement(LiveRoot, { id, html: v }) : createElement(LiveRoot, { id }, v ?? null);
  };
}

const def = (id: Id, label: string, description: string, parts: NonNullable<BlockDef["parts"]>) =>
  ({ id, category: "listings", label, description, memberSafe: true, interactive: false, dataDriven: true, styling: "tailwind", props: [], parts }) as unknown as BlockDef;

const withoutProps = (parts: NonNullable<BlockDef["parts"]>, ...names: string[]) => Object.fromEntries(Object.entries(parts).filter(([n]) => !names.includes(n)));

export const HOME_BLOCKS = [
  {
    def: def("home-stage", "Series stage", "The current series and its next session. Fills itself.", {
      root: { label: "Series stage", sel: "> div" },
      stage: { label: "Stage", sel: ".ifs-stage" },
      body: { label: "Words", sel: ".ifs-stage__body" },
      slide: { label: "Slide", sel: ".ifs-stage__slide" },
      eyebrow: { label: "Small label", sel: ".ifs-stage__eyebrow" },
      title: { label: "Title", sel: ".ifs-stage__title" },
      week: { label: "This week", sel: ".ifs-stage__week" },
      lede: { label: "Summary", sel: ".ifs-stage__lede" },
      facts: { label: "Details", sel: ".ifs-facts" },
      actions: { label: "Button row", sel: ".ifs-stage__actions" },
      button: { label: "Button", sel: ".ifs-stage__actions a" },
      media: { label: "Picture area", sel: ".ifs-stage__media" },
      picture: { label: "Picture", sel: ".ifs-stage__img" },
      tag: { label: "Tag on the picture", sel: ".ifs-stage__tag" },
    }),
    Component: piece("home-stage"),
  },
  {
    def: def("home-standing", "Next gathering", "The standing meeting: when it is next and how to join. Fills itself.", STANDING_PARTS),
    Component: piece("home-standing"),
  },
  {
    def: def("home-forum", "Forum", "The site's forum at card size. Fills itself.", withoutProps(FORUM_PARTS, "heading")),
    Component: piece("home-forum"),
  },
  {
    def: def("home-join", "Sign-up frame", "The sign-up form for visitors, or a note for someone signed in. Follows who is looking.", {
      root: { label: "Sign-up frame", sel: "> div" },
      join: { label: "Form", sel: ".ifs-join" },
      note: { label: "Signed-in note", sel: ".pts-note" },
    }),
    Component: piece("home-join"),
  },
] as unknown as Block<never>[];
