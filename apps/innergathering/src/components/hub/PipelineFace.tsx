import type { OrgDeckBoard } from "@elkdonis/services";
import { BoardMini, SurfaceCard } from "@elkdonis/cms-ui/surface";

/**
 * The pipeline tile: the board at a glance.
 *
 * Each list is a stack of bars with its name and count, drawn server-side
 * from the same board the surface opens — so the tile is not a picture of
 * a board, it is the board at tile size. Clicking opens the board surface;
 * "Open the board" inside goes to the drag-and-drop page.
 */
export function PipelineFace({ board, canEdit }: { board: OrgDeckBoard | null; canEdit: boolean }) {
  if (!board) {
    return (
      <SurfaceCard
        kind="board"
        kicker="Pipeline"
        title="No board yet"
        blurb={canEdit ? "Set up the group's Deck board from the pipeline page." : "The group's board has not been set up yet."}
        href="/hub/pipeline"
        cue="→"
      />
    );
  }

  const stacks = board.stacks.map((s) => ({
    title: s.title,
    cards: (s.cards ?? []).filter((c) => !c.archived).map((c) => ({ done: Boolean(c.done) })),
  }));
  const total = stacks.reduce((n, s) => n + s.cards.length, 0);

  return (
    <SurfaceCard
      kind="board"
      kicker="Pipeline"
      title={board.title}
      blurb={`${total} ${total === 1 ? "card" : "cards"} across ${stacks.length} ${stacks.length === 1 ? "list" : "lists"}.`}
      surface={{ type: "board" }}
      preview={<BoardMini stacks={stacks} />}
    />
  );
}
