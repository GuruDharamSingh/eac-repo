"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SurfaceProvider,
  defaultThreadToAnswers,
  type SurfaceConnectors,
} from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { saveContentAction } from "@/lib/cms/actions";
import { saveWorkshopAction } from "@/lib/cms/workshop-actions";
import { toWorkshopInput } from "@/lib/cms/workshop-adapter";
import { toContentFormValues } from "@/lib/cms/compose-adapter";
import { siteConfig } from "@/config/site";

const TIME_ZONE = "America/Toronto";

/**
 * This site's connectors for the shared surface system.
 *
 * The routine half comes from `createHubConnectors` — see the note in
 * amrit-canada's copy of this file. What differs here is real and deliberate:
 * this site runs workshops (which carry a page and sessions of their own) and
 * has neither a forum nor the network dictionary, so those capabilities are
 * simply not asked for. Omitting a capability is how the shared surface hides
 * it rather than showing an empty one.
 */
export function HubSurfaces({
  signedIn,
  canEdit,
  displayName,
  feeds,
  talkBaseUrl,
  children,
}: {
  signedIn: boolean;
  canEdit: boolean;
  displayName?: string | null;
  feeds: Array<{ slug: string; name: string }>;
  talkBaseUrl: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      createHubConnectors({
        viewer: { signedIn, canCompose: canEdit, displayName },
        orgName: siteConfig.orgName,
        timeZone: TIME_ZONE,
        talkBaseUrl,
        readingVoice: "journal",

        board: true,
        profile: true,
        centerLayout: true,
        // Living documents in this org's own Nextcloud folder, behind
        // /api/hub/documents. No `ideas`: this app serves no forum route, and
        // that face's only navigation target is the ideas feed on the board.
        documents: true,

        async saveThread({ kind, answers, status, threadId }) {
          // Workshops carry a page and sessions of their own; they go through
          // the shared workshop service rather than this site's content schema.
          if (kind === "workshop") {
            const result = await saveWorkshopAction(toWorkshopInput(answers, status), threadId);
            if (!result.ok || !result.id) {
              return { ok: false, error: result.error ?? "Could not save it" };
            }
            return { ok: true, id: result.id, href: result.path ?? null };
          }
          // Otherwise two shapes: writing, and a gathering. An "event" from the
          // shared catalogue is a gathering here.
          const siteKind = kind === "post" ? "post" : "meeting";
          const result = await saveContentAction(
            toContentFormValues(siteKind, answers, status),
            threadId
          );
          if (!result.ok || !result.id) {
            return { ok: false, error: result.error ?? "Could not save it" };
          }
          return { ok: true, id: result.id, href: result.path ?? null };
        },

        compose: {
          orgSlug: siteConfig.orgId,
          feeds,
          canManageOrg: canEdit,
          hasWorkshops: true,
          workshopMode: "dialog",
          hasMeetings: true,
          canCreateDocument: true,
          canCreateTalkRoom: true,
          canShareToNetwork: false,
          // See amrit-canada's copy: `defaultTimeZone` was not a real
          // ComposeContext field. `timeZone` above is the one that is read.
        },

        composeSlots: {
          body: ({ value, onChange, tier }) => (
            <RichTextEditor
              value={value}
              onChange={onChange}
              toolbar={tier === "quick" ? "compact" : "full"}
            />
          ),
          media: ({ value, onChange, label, hint, accept }) => (
            <MediaPicker
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
              uploadEndpoint="/api/upload"
              libraryEndpoint="/api/media/library"
              label={label ?? "Image"}
              hint={hint}
              // A session's handout asks for documents; the default is images.
              accept={accept}
            />
          ),
        },

        threadToAnswers(thread) {
          return {
            ...defaultThreadToAnswers(thread, {
              timeZone: (thread.extra?.time_zone as string | undefined) ?? TIME_ZONE,
            }),
            kind: thread.kind,
          };
        },

        onMutated: () => router.refresh(),
      }),
    [signedIn, canEdit, displayName, feeds, talkBaseUrl, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
