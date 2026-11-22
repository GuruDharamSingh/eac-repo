import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { HeroCityTitle } from "./hero-city-title";

// ============================================================================
// hero-city-title (2026-11-21): the desktop landing's one-line heading, "See [Paris v] with Local Artists.", as a
// real block so the editor can open its settings. The two phrases around the city chooser are the owner's; the
// chooser itself (which cities exist and which are coming) is the site's, not a setting. The saved landing's
// heading is turned into this block at read time (lib/puck/landing-hero.ts); the stored row is not changed.
// ============================================================================

const props = [
  { name: "before", kind: "string", label: "Words before the city", default: "See" },
  { name: "after", kind: "string", label: "Words after the city", default: "with Local Artists." },
] as const;

export type HeroCityBlockProps = PropsOf<typeof props>;

export function HeroCityBlock({ before, after }: HeroCityBlockProps) {
  return (
    <div className="hct-root">
      <h1 className="font-serif">
        <HeroCityTitle before={typeof before === "string" ? before : "See"} after={typeof after === "string" ? after : "with Local Artists."} />
      </h1>
    </div>
  );
}

export const heroCityTitle = defineBlock(
  {
    id: "hero-city-title",
    category: "headers",
    label: "Landing heading with city chooser",
    description: "One centred line with a city chooser: See [Paris] with Local Artists.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  HeroCityBlock,
  () => ({ before: "See", after: "with Local Artists." })
);
