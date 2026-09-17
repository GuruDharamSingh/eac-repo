"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SurfaceSkeleton,
  useWritingRoom,
  WritingRoomBody,
} from "@elkdonis/cms-ui/surface";
import { Button } from "@elkdonis/primitives";

/**
 * The writing room, on its own page.
 *
 * Same room as the popup — `useWritingRoom` and `WritingRoomBody` are shared,
 * so the words, the live preview and the save path are one implementation,
 * not two that drift. What differs is the frame: no dialog, no backdrop, and
 * therefore nothing that can throw away a half-written piece with one stray
 * click. That was the whole objection to composing in a modal, and it applies
 * hardest here, where the form is longest.
 *
 * Publishing navigates to the finished piece rather than replacing a layer,
 * because a page has no layer to replace.
 */
export function WritingRoomPage({ threadId }: { threadId?: string }) {
  const router = useRouter();

  const room = useWritingRoom({
    threadId,
    onSaved: ({ id, href }) => {
      toast.success("Published");
      // The save path answers with the piece's own path when it has one;
      // otherwise the hub, which is where the writer came from.
      router.push(href ?? "/hub");
    },
  });

  const { title, editing, loading, saving, error, canSave, original, status } = room;

  return (
    <div className="ifac-room">
      {/* No back control here: the compose page's own header already has
          one, and two "Back to the hub" buttons 250px apart is worse than
          none. */}
      <div className="ifac-room-head">
        <p className="kicker">{editing ? "Writing room · editing" : "Writing room"}</p>
        <h2 className="ifac-room-title">{title.trim() || "New post"}</h2>
      </div>

      {loading ? (
        <SurfaceSkeleton block />
      ) : (
        <>
          <WritingRoomBody room={room} />

          <div className="ifac-room-foot">
            <span className={`ifac-room-status${error ? " is-error" : ""}`} role={error ? "alert" : undefined}>
              {status}
            </span>
            <span className="ifac-room-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => void room.save("draft")}
                disabled={!canSave || Boolean(saving)}
              >
                {saving === "draft" ? "Saving…" : "Save draft"}
              </Button>
              <Button
                type="button"
                onClick={() => void room.save("published")}
                disabled={!canSave || Boolean(saving)}
              >
                {saving === "published"
                  ? "Publishing…"
                  : original?.status === "published"
                    ? "Update"
                    : "Publish"}
              </Button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
