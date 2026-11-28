"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { ArtworkForm } from "@/app/studio/_components/artwork-form";
import { loadEditArtworkData, type EditArtworkData } from "@/app/hub/edit-artwork-action";

/** The artwork form as a frame inside the hub card's popup stack (in-stack Edit). Saved -> onDone; no redirect. */
export function EditArtworkFrame({
  artworkId,
  onDone,
  onCancel,
  load = loadEditArtworkData,
}: {
  artworkId: string;
  onDone: () => void;
  onCancel: () => void;
  /** Test seam; the server action by default. */
  load?: (id: string) => Promise<EditArtworkData>;
}) {
  const [data, setData] = React.useState<EditArtworkData | null>(null);
  React.useEffect(() => {
    let live = true;
    setData(null);
    load(artworkId)
      .then((d) => live && setData(d))
      .catch(() => live && setData({ error: "This could not be loaded. Try again." }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkId]);

  return (
    <div className="hc-edit-artwork">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={onCancel} className="inline-flex min-h-10 items-center rounded-md border px-3.5 text-sm font-medium">
          Cancel
        </button>
      </div>
      {!data ? (
        <p className="text-sm opacity-70">Loading…</p>
      ) : !("initial" in data) ? (
        <p className="text-sm" role="alert">{data.error}</p>
      ) : (
        <ArtworkForm
          key={artworkId}
          initial={data.initial}
          allowMakerChoice={data.allowMakerChoice}
          beneficiaries={data.beneficiaries}
          orgOptions={data.orgOptions}
          sources={data.sources}
          onSaved={onDone}
        />
      )}
      <Toaster richColors position="top-right" />
    </div>
  );
}
