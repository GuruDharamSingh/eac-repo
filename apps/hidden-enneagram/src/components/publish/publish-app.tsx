"use client";

import * as React from "react";
import { StudioShell, type StudioActions, type StudioShellProps } from "@elkdonis/studio";
import { formExtension } from "@elkdonis/studio/forms/focus";
import { ledgerDarkFormTheme, ledgerFormTheme, serviceKind } from "@elkdonis/studio-forms";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
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
import { heServiceActions } from "@/lib/forms/site";
import { siteServiceListAction } from "@/lib/forms/actions";
import { studioHref } from "./studio-surface";
import { comingExtension, COMING_KINDS } from "./coming-kind";
import { tellHost } from "./bridge";

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
  /** `?id=` of the offering to open on the Offerings kind. */
  initialServiceId: string | null;
};

export function PublishApp({ shell, orgId, feed, initialServiceId }: PublishAppProps) {
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
      // Offerings: the shared form (@elkdonis/studio-forms serviceKind), as arts-collective's "Offerings (new)".
      // A publish tells the popup frame, which closes (bridge.ts), as the old Services kind did.
      formExtension({
        id: "service",
        label: "Services",
        listLabel: "Services",
        schema: serviceKind,
        actions: heServiceActions,
        initialId: initialServiceId,
        theme: ledgerFormTheme,
        themeDark: ledgerDarkFormTheme,
        host: () => ({
          studioHref: (o) => studioHref({ kind: o.kind === "service" ? "service" : "writing", id: o.id }),
          viewHref: (ref) => ref.href ?? null,
          loginHref: (next) => `/login?next=${encodeURIComponent(next)}`,
          preview: {},
          feeds: [],
          onSaved: (_kind, record) => {
            const id = (record as { id?: string } | null)?.id;
            if (id) tellHost({ type: "saved", kind: "service", id });
          },
          onPublished: (_kind, record) => {
            const r = record as { id?: string; href?: string | null } | null;
            if (r?.id) tellHost({ type: "published", kind: "service", id: r.id, href: r.href ?? null });
          },
          slots: {
            body: ({ value, onChange, tier }) => <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />,
            media: ({ value, onChange, label, hint, accept }) => (
              <MediaPicker
                value={typeof value === "string" ? value : undefined}
                onChange={onChange}
                uploadEndpoint="/api/upload"
                libraryEndpoint="/api/media/library"
                label={label ?? "Picture"}
                hint={hint}
                accept={accept}
              />
            ),
          },
        }),
        items: () => siteServiceListAction(orgId).then((l) => l.map((s) => ({ id: s.id, title: s.title, status: s.status, updatedAt: s.updatedAt }))),
      }),
      ...COMING_KINDS.map(comingExtension),
    ],
    [initialServiceId]
  );

  return <StudioShell {...shell} actions={actions} extensions={extensions} />;
}
