import { defineBlock, type PropsOf } from "../registry";
import { Region } from "../slot";

// ============================================================================
// A person page's body: a 280px side column beside a wide one.
//
// The proportions of PersonPage's body (`.eac-person-body`: 280px, then the
// rest), which "Two columns" (split-row) cannot express — its ratios are
// fractions, and the side column of a person page is a fixed card width at
// every screen size. Stacks under 760px, as the plain page does.
// ============================================================================

const props = [
  {
    name: "side",
    kind: "slot",
    label: "Side column",
    description: "Usually the person card.",
  },
  {
    name: "main",
    kind: "slot",
    label: "Wide column",
    description: "Usually their featured work.",
  },
  {
    name: "sidePosition",
    kind: "select",
    label: "Side column on the",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "end", label: "Right" },
    ],
  },
] as const;

export type PersonColumnsProps = PropsOf<typeof props>;

export function PersonColumns({ side, main, sidePosition = "start" }: PersonColumnsProps) {
  return (
    <div className="blk-person-cols blk-person-section" data-side={sidePosition}>
      <Region of={side} className="blk-person-col blk-person-col--side" />
      <Region of={main} className="blk-person-col blk-person-col--main" />
    </div>
  );
}

export const personColumns = defineBlock(
  {
    id: "person-columns",
    category: "layout",
    label: "Card and work",
    description: "A narrow column for the person card beside a wide one for their work, as on their page.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  PersonColumns,
  () => ({ sidePosition: "start" as const })
);
