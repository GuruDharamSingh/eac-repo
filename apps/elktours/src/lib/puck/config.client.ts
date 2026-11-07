"use client";

import { createElement } from "react";
import type { Block, PropDef } from "@elkdonis/blocks";
import { contractOf } from "@elkdonis/blocks/contract";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildEditorConfig, buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { opensDrawAction, personWhoAction } from "@/lib/featured-person-actions";
import { PersonPickerField } from "@/components/studio/person-picker";
import { PAGE_BLOCKS } from "./catalogue";

// ============================================================================
// The catalogue as the editors see it (2026-11-06): the landing page's canvas,
// the block popup, and Puck Studio for new pages (/studio/<slug>). The box
// blocks come along so a page made of boxes opens in either editor.
// ============================================================================

const blocks = [...PAGE_BLOCKS, ...(BOX_BLOCKS as unknown as Block<never>[])];
/** Studio leaves out the live part: one exists only where the landing page drew it. */
const studioBlocks = blocks.filter((b) => b.def.id !== "part");

/** The canvas draws with the published shape. No resolvers: the page hands it what stored people drew, and the chooser fetches the rest. */
export const canvasConfig = buildPuckConfig({ blocks, root: BOX_ROOT, morph: MorphMark });

/** What each sealed block declares: its settings in the right column, and its parts to click into. */
export const canvasContract = contractOf(PAGE_BLOCKS);

/** In Puck the resolver runs in the browser: the person comes through the editors' action, the same answer a visitor's page gets. */
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const opensOf = async (v: unknown) => { const s = str(v); return s ? (((await opensDrawAction("opens", s))?.opened as unknown) ?? null) : null; };
const resolvers: BlockResolvers = {
  "featured-person": async (props) => ({ who: str(props.person) ? await personWhoAction(props.person as string) : null, opened: await opensOf(props.opens) }),
  "link-button": async (props) => ({ opened: await opensOf(props.opens) }),
  "feature-card": async (props) => ({ bound: str(props.record) ? (((await opensDrawAction("record", props.record as string))?.bound as unknown) ?? null) : null, opened: await opensOf(props.opens) }),
};

export const puckConfig = buildEditorConfig({
  resolvers,
  blocks: studioBlocks,
  morph: MorphMark,
  root: BOX_ROOT,
  fields: {
    // A string that binds to a person, an Opens or a Card's record gets "From what?"; every other string keeps Puck's own box (null).
    string: (prop: PropDef) =>
      prop.binds === "person" || prop.binds === "opens" || prop.binds === "record"
        ? function ReferenceProp(props: Record<string, unknown>) {
            return createElement(PersonPickerField, { ...(props as object), binds: prop.binds } as never);
          }
        : null,
  },
  media: {
    uploadEndpoint: "/api/upload",
    libraries: [{ key: "org", label: "This site", endpoint: "/api/media/library" }],
  },
});
