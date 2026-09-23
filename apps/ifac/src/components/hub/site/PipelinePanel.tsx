"use client";

import { PipelineBoard, ProvisionBoard } from "@elkdonis/pipeline";
import type { ComponentProps } from "react";

/**
 * The Deck board itself at the foot of the page — the same board as
 * /hub/pipeline, with its draggable cards (the popup's board is read-mostly;
 * drag has always lived on the page).
 *
 * `readable` (2026-09-23): list names as bold headings, a line of each card's
 * description under its title, and lists only as tall as their cards. The
 * panel used to cap the board at 26rem and scroll inside it, because every
 * list was a fixed 60vh; with the lists sized to their contents there is
 * nothing to scroll, so the cap is gone.
 */
export function PipelinePanel({
  board,
  assignees,
  viewerUid,
  canWrite,
  canManage,
  readable = false,
}: {
  board: ComponentProps<typeof PipelineBoard>["board"] | null;
  assignees: ComponentProps<typeof PipelineBoard>["assignees"];
  viewerUid: string | null;
  canWrite: boolean;
  canManage: boolean;
  readable?: boolean;
}) {
  return (
    <section className="ifac-pipeline" aria-labelledby="ifac-pipeline-h">
      <header className="ifac-pipeline__head">
        <div>
          <p className="eac-hs-kicker">Pipeline</p>
          <h2 id="ifac-pipeline-h" className="eac-hs-h">What we&rsquo;re working on</h2>
        </div>
        <a className="eac-btn eac-btn--quiet" href="/hub/pipeline">Open the board</a>
      </header>
      {board ? (
        <div className="ifac-pipeline__board">
          <PipelineBoard
            board={board}
            assignees={assignees}
            viewerUid={viewerUid}
            canWrite={canWrite}
            canManage={canManage}
            readable={readable}
          />
        </div>
      ) : (
        <ProvisionBoard canProvision={canManage} />
      )}
    </section>
  );
}
