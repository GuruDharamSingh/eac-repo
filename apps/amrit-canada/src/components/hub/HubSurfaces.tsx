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
import { defineTermAction, lookupTermAction } from "@/lib/dictionary-actions";
import { toContentFormValues } from "@/lib/cms/compose-adapter";
import { EmailSurface } from "./EmailSurface";
import { siteConfig } from "@/config/site";

const TIME_ZONE = "America/Toronto";

/**
 * This site's connectors for the shared surface system.
 *
 * Every popup on the site — a meeting, the month, the gallery, the quick-add
 * form, the writing room — is `@elkdonis/cms-ui/surface` rendered against
 * these functions. The surfaces never see this app's routes or column names.
 *
 * The routine half (loadThread, listEvents, listMedia, rsvp, the Deck→board
 * translation, profile, centerLayout) now comes from `createHubConnectors`,
 * which this file and innergathering's equivalent used to hold ~160 identical
 * lines of. What stays here is what only this site can answer: its own schema
 * in `saveThread`, its editor and media widgets, and which capabilities it
 * has.
 *
 * Mounted once, in the root layout, so a listing card on a public feed page
 * opens the same surface a hub tile does. Reads go through the hub API route
 * (public for published public threads, members for the rest, editors for
 * drafts); the save goes through the same server action /manage uses, so a
 * meeting made from a calendar day is exactly the meeting /manage would make.
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
    () => ({
      ...createHubConnectors({
        viewer: { signedIn, canCompose: canEdit, displayName },
        orgName: siteConfig.orgName,
        timeZone: TIME_ZONE,
        talkBaseUrl,
        // The published page renders posts in the journal voice; the writing
        // room's preview should match it.
        readingVoice: "journal",

        // What this site has. The library route is editors-only (it lists
        // unpublished material), so the gallery face is only offered to
        // editors — see hub/page.tsx.
        board: true,
        forum: true,
        profile: true,
        centerLayout: true,
        // Living documents in the org's own Nextcloud folder, and the ideas
        // feed on this site's forum. Both were tiles marked "unavailable"
        // until the shared surfaces were built; the routes behind them are
        // /api/hub/documents and /api/hub/ideas.
        documents: true,
        ideas: { href: "/forum/ideas" },

        // The network dictionary. Defining a term while writing creates its
        // wiki page straight away — the wiki is shared across every org, so
        // the entry outlives whatever article prompted it.
        dictionary: {
          lookup: (term) => lookupTermAction(term),
          define: (input) => defineTermAction(input),
        },

        async saveThread({ kind, answers, status, threadId }) {
          // This site's schema knows two shapes: writing, and a gathering. An
          // "event" from the shared catalogue is a gathering here.
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
          hasWorkshops: false,
          hasMeetings: true,
          canCreateDocument: true,
          canCreateTalkRoom: true,
          canShareToNetwork: false,
          // No timezone here: ComposeContext has no such field, so the
          // `defaultTimeZone` this used to carry was configuring nothing. The
          // zone the forms and faces actually read is `timeZone` above.
        },

        composeSlots: {
          body: ({ value, onChange, tier }) => (
            <RichTextEditor
              value={value}
              onChange={onChange}
              toolbar={tier === "quick" ? "compact" : "full"}
            />
          ),
          // Never a URL box: upload, or choose from what this org already has.
          media: ({ value, onChange, label, hint, accept }) => (
            <MediaPicker
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
              uploadEndpoint="/api/upload"
              libraryEndpoint="/api/media/library"
              label={label ?? "Image"}
              hint={hint}
              accept={accept}
            />
          ),
        },

        // The shared mapper already carries recurrence, RSVP deadline, minimum
        // attendance and the time zone (through `extra`); this only adds `kind`.
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
      custom: {
        email: ({ descriptor }) => <EmailSurface descriptor={descriptor} />,
      },
    }),
    [signedIn, canEdit, displayName, feeds, talkBaseUrl, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
