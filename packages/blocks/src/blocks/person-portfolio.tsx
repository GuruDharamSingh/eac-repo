import { ProfileGallery } from "@elkdonis/cms-ui/gallery";
import { defineBlock, type PropsOf } from "../registry";
import type { PersonBlockWork } from "../person-context";
import { PersonBlockNote, type PuckContext } from "./person-note";

// ============================================================================
// Featured work — the arranged picture grid beside the card on a person page.
//
// The same ProfileGallery the plain page draws (users.portfolio, with the
// positions the person dragged it into), read-only here: arranging it stays
// on the plain page's own gallery panel. `ProfileGallery` is a client
// component; it receives only data, so the block stays server-rendered and
// needs no `interactive` flag.
// ============================================================================

const props = [
  {
    name: "emptyMessage",
    kind: "string",
    label: "Shown when there is no work yet",
    default: "Work coming soon.",
  },
] as const;

export type PersonPortfolioProps = PropsOf<typeof props> & {
  works?: PersonBlockWork[];
  /** The person switched the section off. */
  off?: boolean;
  editable?: boolean;
  puck?: PuckContext;
};

export function PersonPortfolio({ emptyMessage = "Work coming soon.", works = [], off, editable, puck }: PersonPortfolioProps) {
  if (off) return <PersonBlockNote puck={puck}>Featured work is switched off in your page settings.</PersonBlockNote>;
  if (works.length === 0) {
    // As the plain page: the column shows a line to its owner, nothing to a visitor.
    if (!editable && !puck?.isEditing) return null;
    return (
      <section className="eac-person-featured eac-person-panel blk-person-section">
        <p className="eac-person-empty">{emptyMessage || "Work coming soon."}</p>
      </section>
    );
  }
  return (
    <section className="eac-person-featured eac-person-panel blk-person-section">
      <ProfileGallery
        items={works.map((w) => ({ id: w.id, url: w.url, title: w.title, x: w.x, y: w.y, w: w.w, h: w.h }))}
        editable={false}
      />
    </section>
  );
}

export const personPortfolio = defineBlock(
  {
    id: "person-portfolio",
    category: "listings",
    label: "Featured work",
    description: "The pictures they arranged as their featured work.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonPortfolio,
  () => ({ emptyMessage: "Work coming soon.", works: [], editable: true })
);
