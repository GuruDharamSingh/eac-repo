"use client";

import type { Config } from "@puckeditor/core";
import type { Block } from "@elkdonis/blocks";
import { BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildEditorConfig, buildPuckConfig } from "@elkdonis/page-builder";
import { ThemeScope } from "./theme-scope";

/**
 * The config tiles draw with: the published shape (what a site renders), with no resolvers, so a
 * data-driven block draws from its own sample rows (see nodeProps in ./model).
 */
export function renderConfigFor(blocks: Block<never>[]): Config {
  return buildPuckConfig({ blocks, root: BOX_ROOT, morph: MorphMark });
}

/**
 * The config the editing sheet uses: the editor shape (Puck's own field controls for every prop,
 * the generic Style control), with a root wrapper that applies the chosen theme inside Puck's
 * preview iframe. Pictures cannot be uploaded in the sandbox: the endpoint does not exist.
 */
export function editorConfigFor(blocks: Block<never>[]): Config {
  return buildEditorConfig({
    blocks,
    morph: MorphMark,
    root: { props: [], wrap: ThemeScope },
    media: { uploadEndpoint: "/development/api/none", libraries: [] },
  });
}
