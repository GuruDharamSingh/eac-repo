"use client";

import { Pencil } from "lucide-react";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { Button } from "@elkdonis/primitives";

/**
 * "Edit" on a published page, for editors.
 *
 * Opens the thread's authoring surface over the page it is being edited on —
 * the writing room for a post, the form for a gathering — so the page stays
 * in view underneath and publishing returns you to the same place, refreshed.
 * Without a surface provider it falls back to the /manage route.
 */
export function EditThreadButton({
  threadId,
  kind,
  className,
}: {
  threadId: string;
  kind: string;
  className?: string;
}) {
  const surfaces = useSurfaceOptional();
  const fallback = `/manage/content/${threadId}`;

  return (
    <Button
      asChild={!surfaces}
      variant="outline"
      size="sm"
      className={className}
      onClick={
        surfaces
          ? () =>
              surfaces.open(
                kind === "post"
                  ? { type: "write", kind: "post", threadId }
                  : { type: "compose", kind, threadId }
              )
          : undefined
      }
    >
      {surfaces ? (
        <>
          <Pencil className="size-3.5" aria-hidden /> Edit
        </>
      ) : (
        <a href={fallback}>
          <Pencil className="size-3.5" aria-hidden /> Edit
        </a>
      )}
    </Button>
  );
}
