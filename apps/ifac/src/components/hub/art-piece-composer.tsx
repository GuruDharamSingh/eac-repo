"use client";

import { ArtPieceComposer } from "@elkdonis/cms-ui/compose";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import {
  canListArtPieceAction,
  createArtPieceAction,
} from "@/lib/cms/art-piece-actions";
import { siteConfig } from "@/config/site";

// ============================================================================
// A piece of work, from IFAC's hub — the shared form, bound to this app.
//
// The form moved to @elkdonis/cms-ui/compose. An artist's store belongs to the
// PERSON (`store.owner_user_id`; `getStoreForUser` is not told which org is
// asking), so cataloguing work had no business being possible only from the
// one app that happened to have the component. What stays here is the save,
// its permission gate, and the media picker on this app's own endpoints.
// ============================================================================

export function ArtPieceComposerCard() {
  return (
    <ArtPieceComposer
      checkStore={async () => {
        const r = await canListArtPieceAction();
        return { ok: r.ok, reason: r.reason };
      }}
      onSave={createArtPieceAction}
      marketplaceUrl={siteConfig.marketplaceUrl}
      media={({ value, onChange, label, hint }) => (
        <MediaPicker
          value={value}
          onChange={onChange}
          uploadEndpoint="/api/media/upload"
          libraryEndpoint="/api/media/library"
          label={label}
          hint={hint}
        />
      )}
    />
  );
}

/** The name the connectors already register. */
export { ArtPieceComposerCard as ArtPieceComposer };
