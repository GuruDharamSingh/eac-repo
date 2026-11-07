import type { Block } from "@elkdonis/blocks";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
// Not the package's main entry: that also exports Puck's editor, and a server page importing it sends those scripts to every visitor (measured 2026-11-05: 840 KB on `/`).
import { buildPuckConfig } from "@elkdonis/page-builder/config";
import { HOME_BLOCKS } from "@/blocks/home-blocks";
import { PublishedRoot } from "./page-root";

// The home page's catalogue: boxes, words, pictures and its own live pieces. Not `config.server.ts`: importing the
// whole catalogue here would add every block's scripts to what each visitor to `/` downloads. Server-safe.
const blocks = [...(BOX_BLOCKS as unknown as Block<never>[]), ...HOME_BLOCKS];

/** What the editor draws with. */
export const landingCanvasConfig = buildPuckConfig({ blocks, root: BOX_ROOT, morph: MorphMark });

/** What a visitor's `/` draws with. */
export const landingPublishedConfig = buildPuckConfig({ blocks, root: { props: [], wrap: PublishedRoot }, morph: MorphMark });
