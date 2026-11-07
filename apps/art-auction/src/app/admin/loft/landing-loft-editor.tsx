"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Installation, InstallationArtwork, InstallationPiece } from "@/lib/installations";
import { InstallationEditor } from "@/app/studio/installations/[id]/installation-editor";
import { publishLandingAction, revertLandingAction, saveLandingLayoutAction, saveLandingSceneAction } from "./actions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });

/** The installations editor hosting the landing loft, with "Put on the landing page" and "Go back". */
export function LandingLoftEditor({
  installation,
  artworks,
  initialPieces,
  publishedAt: initialPublishedAt,
}: {
  installation: Installation;
  artworks: InstallationArtwork[];
  initialPieces: InstallationPiece[];
  publishedAt: string | null;
}) {
  const [publishedAt, setPublishedAt] = React.useState(initialPublishedAt);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  // Edits since the last publish: any save after it.
  const [dirty, setDirty] = React.useState(() => Boolean(initialPublishedAt && installation.updatedAt > initialPublishedAt));
  // Stable: the editor's save effects depend on these.
  const saveLayout = React.useCallback(async (id: string, pieces: InstallationPiece[]) => {
    const r = await saveLandingLayoutAction(id, pieces);
    setDirty(true);
    setNote(null);
    return r;
  }, []);
  const saveScene = React.useCallback(async (id: string, scene: unknown) => {
    const r = await saveLandingSceneAction(id, scene);
    setDirty(true);
    setNote(null);
    return r;
  }, []);

  const publish = async () => {
    setBusy(true);
    setNote(null);
    const r = await publishLandingAction(installation.id);
    setBusy(false);
    if (r.ok && r.at) {
      setPublishedAt(r.at);
      setDirty(false);
      setNote("On the landing page now.");
    } else setNote(r.error ?? "Could not publish.");
  };

  const revert = async () => {
    if (!window.confirm("Discard the changes made here since the landing page was last updated?")) return;
    setBusy(true);
    const r = await revertLandingAction(installation.id);
    if (r.ok) window.location.reload();
    else {
      setBusy(false);
      setNote(r.error ?? "Could not go back.");
    }
  };

  return (
    <InstallationEditor
      installation={installation}
      artworks={artworks}
      initialPieces={initialPieces}
      saveLayout={saveLayout}
      saveScene={saveScene}
      studioControls={false}
      openSpot
      trayTitle="Works on the market"
      trayEmpty="No pictured works are on show on the market yet."
      toolbar={({ saveState }) => (
        <div className="flex flex-wrap items-center gap-2" data-testid="landing-toolbar">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {note ??
              (publishedAt
                ? `${dirty ? "Changed since" : "Visitors see the version from"} ${when(publishedAt)}`
                : "Visitors see the starting hang until you put this on the page")}
          </span>
          <Button size="sm" onClick={publish} disabled={busy || saveState !== "saved"}>
            Put on the landing page
          </Button>
          {publishedAt && (
            <Button variant="outline" size="sm" onClick={revert} disabled={busy}>
              Go back to what visitors see
            </Button>
          )}
          <Link href="/" className="text-sm underline underline-offset-4">
            View the home page →
          </Link>
        </div>
      )}
    />
  );
}
