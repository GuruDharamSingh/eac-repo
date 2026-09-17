"use client";

import * as React from "react";
import type { SurfaceAction, SurfaceDescriptor } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame, SurfaceSkeleton } from "../SurfaceShell";
import { useWritingRoom, WritingRoomBody } from "./writing-room";

// ============================================================================
// The writing room, in the popup.
//
// The room itself — the split editor, the live preview, the answers, the
// saving — is `./writing-room`, so the compose PAGE can host the same thing.
// What is left here is the dialog: the masthead, the foot, and the two moves
// only a layer can make (replace yourself with what you just published, pop
// back to what opened you).
//
// A blog post is `threads.kind = 'post'` — the same row an "Article" from the
// compose popup makes. What differs is the surface.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "write" }>;

export function WriteSurface({ descriptor }: { descriptor: Descriptor }) {
  const { replace, pop } = useSurface();
  const layer = useLayer();

  const room = useWritingRoom({
    threadId: descriptor.threadId,
    prefill: descriptor.prefill,
    // A layer replaces itself with the post it just made, so publishing reads
    // as the draft becoming the thing rather than a dialog closing.
    onSaved: ({ id }, answers) =>
      replace({
        type: "thread",
        id,
        preview: {
          title: String(answers.title ?? ""),
          kind: "post",
          coverImageUrl:
            typeof answers.cover_image_url === "string" ? answers.cover_image_url : null,
        },
      }),
  });

  const { title, editing, loading, saving, error, canSave, answers, original, status } = room;

  React.useEffect(() => {
    layer.setMeta({
      title: title.trim() || (editing ? "Edit" : "New post"),
      kind: "post",
      size: "full",
    });
  }, [layer, title, editing]);

  const actions: SurfaceAction[] = [
    {
      label: "Simple form",
      quiet: true,
      onClick: () =>
        replace({
          type: "compose",
          kind: "post",
          threadId: descriptor.threadId,
          prefill: answers,
          tier: "full",
        }),
    },
    { label: "Cancel", quiet: true, onClick: pop, disabled: Boolean(saving) },
    {
      label: saving === "draft" ? "Saving…" : "Save draft",
      onClick: () => room.save("draft"),
      disabled: !canSave || Boolean(saving),
    },
    {
      label:
        saving === "published"
          ? "Publishing…"
          : original?.status === "published"
            ? "Update"
            : "Publish",
      primary: true,
      onClick: () => room.save("published"),
      disabled: !canSave || Boolean(saving),
    },
  ];

  return (
    <SurfaceFrame
      kind="post"
      title={title.trim() || (editing ? "Edit" : "New post")}
      kicker={editing ? "Writing room · editing" : "Writing room"}
      actions={actions}
      status={status}
      statusTone={error ? "error" : "normal"}
      flush
    >
      {loading ? (
        <div style={{ padding: 22 }}>
          <SurfaceSkeleton block />
        </div>
      ) : (
        <WritingRoomBody room={room} />
      )}
    </SurfaceFrame>
  );
}
