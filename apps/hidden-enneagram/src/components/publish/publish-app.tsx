"use client";

import * as React from "react";
import { StudioShell, type StudioActions, type StudioShellProps } from "@elkdonis/studio";
import {
  listPublishIdentities,
  listPublishPieces,
  listPublishSeries,
  loadPublishPiece,
  removePublishPiece,
  savePublishPiece,
  searchPublishThreads,
  setPublishListing,
  startPublishPiece,
} from "@/lib/studio/writing-actions";
import { listPublishServices, loadPublishService, savePublishService } from "@/lib/studio/service-actions";
import { serviceExtension } from "./service-kind";
import { comingExtension, COMING_KINDS } from "./coming-kind";
import { tellHost } from "./bridge";
import type { ServiceDraft, ServiceSummary } from "./service-types";

// ============================================================================
// The network's Studio (@elkdonis/studio), mounted on Ario's site at /publish
// (round 4). arts-collective's components/studio/StudioApp.tsx is the model:
// a client module that builds the extensions, because a server page cannot
// hand components across.
//
// What differs from there: the writing actions are this site's (its posts,
// lib/studio/writing-actions.ts), Services is an extension of this app, and the
// kinds this site does not offer are "coming" stubs. Framed in the popup
// (studio-surface.tsx), a publish tells the page underneath, which closes the
// popup and refreshes.
// ============================================================================

export type PublishAppProps = {
  shell: Omit<StudioShellProps, "actions" | "extensions">;
  orgId: string;
  orgName: string;
  /** The page a new piece goes on (?feed=); /writing when absent. */
  feed: string | null;
  services: ServiceSummary[];
  initialService: ServiceDraft | null;
};

export function PublishApp({ shell, orgId, orgName, feed, services, initialService }: PublishAppProps) {
  const actions = React.useMemo<StudioActions>(
    () => ({
      listPieces: listPublishPieces,
      loadPiece: loadPublishPiece,
      startPiece: async (o, title) => {
        const res = await startPublishPiece(o, title, feed);
        if (res.ok) tellHost({ type: "saved", kind: "writing", id: res.value.id });
        return res;
      },
      savePiece: async (id, patch) => {
        const res = await savePublishPiece(id, patch);
        if (res.ok) {
          tellHost(
            patch.status === "published"
              ? { type: "published", kind: "writing", id, href: null }
              : { type: "saved", kind: "writing", id }
          );
        }
        return res;
      },
      removePiece: removePublishPiece,
      setListing: setPublishListing,
      listIdentities: listPublishIdentities,
      listSeries: listPublishSeries,
      searchThreads: searchPublishThreads,
    }),
    [feed]
  );

  const extensions = React.useMemo(
    () => [
      serviceExtension({
        orgId,
        orgName,
        initialServices: services,
        initial: initialService,
        actions: { list: listPublishServices, load: loadPublishService, save: savePublishService },
        uploadEndpoint: "/api/upload",
        libraryEndpoint: "/api/media/library",
        onSaved: ({ id, path, published }) =>
          tellHost(published ? { type: "published", kind: "service", id, href: path } : { type: "saved", kind: "service", id }),
      }),
      ...COMING_KINDS.map(comingExtension),
    ],
    [orgId, orgName, services, initialService]
  );

  return <StudioShell {...shell} actions={actions} extensions={extensions} />;
}
