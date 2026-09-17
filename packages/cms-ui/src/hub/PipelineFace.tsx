"use client";

import * as React from "react";
import { BoardMini, SurfaceCard, useSurface } from "../surface";
import type { HubPipelineBoard } from "./types";

/**
 * The pipeline tile: the board at a glance.
 *
 * Each list is a stack of bars with its name and count, drawn server-side
 * from the same board the page shows — so the tile is not a picture of
 * a board, it is the board at tile size.
 *
 * Clicking goes to the pipeline page, not to the board surface. The surface
 * is a reduced board by design (no card menu, no attachments or activity,
 * no drag-and-drop), and the full board opens its own modal for card detail,
 * which a popup cannot host: the surface is a native <dialog> in the top
 * layer, so the board's own dropdowns and dialog would land behind it. The
 * depth of this feature is a page.
 */
export function PipelineFace({
  board,
  canEdit,
  pageHref = "/hub/pipeline",
}: {
  board: HubPipelineBoard | null;
  canEdit: boolean;
  /** The board's page — where the tile goes. */
  pageHref?: string;
}) {
  if (!board) {
    return (
      <SurfaceCard
        kind="board"
        kicker="Pipeline"
        title="No board yet"
        blurb={
          canEdit
            ? "Set up the group's Deck board from the pipeline page."
            : "The group's board has not been set up yet."
        }
        href={pageHref}
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
      href={pageHref}
      cue="→"
      tools={canEdit ? <QuickAdd board={board} /> : undefined}
      preview={<BoardMini stacks={stacks} />}
    />
  );
}

/** The first list's name, a field, and two ways to file a card into it. */
function QuickAdd({ board }: { board: HubPipelineBoard }) {
  const surfaces = useSurface();
  const createCard = surfaces.connectors.board?.createCard;
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // The first list IS the inbox — usually "To do", but named from the board
  // rather than assumed, because a board that calls it "Backlog" should say
  // so on the tile.
  const target = board.stacks[0];
  // No stack id means this board's shape cannot address a list, so there is
  // nowhere to file a card — draw nothing rather than a field that fails.
  if (!createCard || !target || target.id == null) return null;

  async function file(thenOpen: boolean) {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const card = await createCard!(target!.id!, trimmed).catch(() => null);
    setBusy(false);
    if (!card) return;
    setTitle("");
    surfaces.connectors.onMutated?.();
    if (thenOpen) {
      surfaces.open({ type: "boardCard", cardId: card.id, preview: { title: trimmed } });
    }
  }

  return (
    <>
      <span className="eac-face-tool-label">{target.title}</span>
      <input
        className="eac-face-tool-input"
        value={title}
        disabled={busy}
        maxLength={200}
        placeholder="Add a card…"
        aria-label={`Add a card to ${target.title}`}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void file(false);
          }
        }}
      />
      <button
        type="button"
        className="eac-face-tool"
        disabled={busy || !title.trim()}
        title="Add it and open its details"
        aria-label="Add it and open its details"
        onClick={() => void file(true)}
      >
        …
      </button>
      <button
        type="button"
        className="eac-face-tool"
        disabled={busy || !title.trim()}
        title="Add it"
        aria-label="Add it"
        onClick={() => void file(false)}
      >
        ↵
      </button>
    </>
  );
}
