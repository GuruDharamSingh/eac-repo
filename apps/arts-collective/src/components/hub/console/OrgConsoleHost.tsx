"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SurfaceProvider, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import type { ComposeContext } from "@elkdonis/cms-ui/compose";
import { orgComposeConnectors, orgComposeContext } from "./org-compose";
import { CONSOLE_SURFACES } from "./AttentionBands";
import {
  DraftsSurface,
  ScheduleSurface,
  ResponsesSurface,
  PeopleSurface,
  PublishedSurface,
} from "./ConsoleSurfaces";
import { togglePinAction } from "@/lib/cms/actions";
import { ConsoleSettings, type ConsoleSettingsProps } from "./ConsoleSettings";
import { EmailSurface, type EmailSuiteData, type EmailTab } from "@elkdonis/cms-ui/email";
import { useEmailConnectors } from "@/components/hub/email/use-email-connectors";
import type { ConsoleState } from "@/lib/org-console";

/**
 * The console's surface stack.
 *
 * The routine half — loadThread, listEvents, listMedia, rsvp — comes from
 * `createHubConnectors`, the same floor amrit-canada and innergathering stand
 * on. What differs here is that this console is MULTI-ORG: the template apps
 * read their org from a `siteConfig` constant, while this one shows whichever
 * org the switcher selected, so every route is scoped by slug in its path
 * rather than implied by the host.
 *
 * The console's own bands and its settings ride on top as host-registered
 * `custom` surfaces, so the shared package gains no console vocabulary while
 * the popups still behave like every other surface on the network — one native
 * dialog, a stack with a back affordance, `?surface=` so a panel survives a
 * reload.
 */
export function OrgConsoleHost({
  state,
  orgId,
  orgSlug,
  orgName,
  orgHomeUrl,
  displayName,
  canEdit,
  feeds,
  settings,
  email,
  hasDesignedPage = false,
  children,
}: {
  state: ConsoleState;
  orgId: string;
  orgSlug: string;
  orgName: string;
  orgHomeUrl: string;
  displayName?: string | null;
  canEdit: boolean;
  feeds: Array<{ slug: string; name: string }>;
  /** Omitted for a member: there is nothing for them to configure. */
  settings: ConsoleSettingsProps | null;
  /** A landing page designed in the page editor is published for this org. */
  hasDesignedPage?: boolean;
  /**
   * The org's email, when this viewer may see it. Omitted for a member — the
   * face is not drawn at all rather than drawn and refused, because a tile
   * that opens onto "you may not" is furniture.
   */
  email?: EmailSuiteData | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const emailConnectors = useEmailConnectors(orgSlug);

  const compose = React.useMemo<ComposeContext>(() => orgComposeContext({ orgSlug, feeds, canEdit }), [orgSlug, feeds, canEdit]);
  const composeParts = React.useMemo(() => orgComposeConnectors({ orgSlug, orgHomeUrl, compose }), [orgSlug, orgHomeUrl, compose]);
  const { customCompose, ...composeConnectors } = composeParts;

  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      ...createHubConnectors({
        viewer: { signedIn: true, canCompose: canEdit, displayName },
        orgName,
        // Every route is per-org, because the console is not single-tenant.
        routes: {
          thread: `/api/org/${encodeURIComponent(orgSlug)}/threads`,
          calendar: `/api/org/${encodeURIComponent(orgSlug)}/calendar`,
          mediaLibrary: "/api/media/library",
          upload: "/api/upload/image",
          rsvp: "/api/threads",
        },
        // Only what this app actually serves. Board, documents, ideas, profile
        // and centerLayout have no routes here, so they stay off rather than
        // opening a surface that cannot load.
        board: false,
        forum: false,
        documents: false,
        ideas: false,
        profile: false,
        centerLayout: false,

        // Compose for this org: identities, context, editor slots, save (org-compose.tsx).
        ...composeConnectors,

        custom: {
          // Questionnaire and poll composers (org-compose.tsx).
          ...customCompose,

          // The email suite, in the popup. The SAME component the full page at
          // /hub/email renders — which is the whole point of consolidating the
          // four app-local attempts: there is one email UI, opened two ways.
          email: ({ descriptor }) =>
            email ? (
              <EmailSurface
                data={email}
                connectors={emailConnectors}
                canEdit={canEdit}
                tab={(descriptor.props?.tab as EmailTab | undefined) ?? "activity"}
              />
            ) : null,

          [CONSOLE_SURFACES.drafts]: () => (
            <DraftsSurface state={state} orgHomeUrl={orgHomeUrl} />
          ),
          [CONSOLE_SURFACES.schedule]: () => <ScheduleSurface state={state} />,
          [CONSOLE_SURFACES.responses]: () => <ResponsesSurface state={state} />,
          [CONSOLE_SURFACES.people]: () => (
            <PeopleSurface state={state} orgSlug={orgSlug} />
          ),
          [CONSOLE_SURFACES.published]: () => (
            <PublishedSurface state={state} orgHomeUrl={orgHomeUrl} canEdit={canEdit} hasDesignedPage={hasDesignedPage} />
          ),
          [CONSOLE_SURFACES.settings]: ({ descriptor }) =>
            settings ? (
              <ConsoleSettings
                props={settings}
                initialSection={
                  (descriptor.props?.section as
                    | "identity"
                    | "people"
                    | "appearance"
                    | "site"
                    | undefined) ?? "identity"
                }
              />
            ) : null,
        },

        onMutated: () => router.refresh(),
      }),
      // The pin, on the thread's own popup: what leads the site. Only a
      // published PUBLIC thread can lead, which is also what the offering
      // query selects. `extra.pinned` comes from /api/org/[slug]/threads/[id].
      threadActions(thread, { refresh }) {
        if (!canEdit || thread.status !== "published" || thread.visibility !== "PUBLIC") return [];
        const pinned = Boolean(thread.extra?.pinned);
        return [
          {
            label: pinned ? "Stop leading the site" : "Lead the site with this",
            done: pinned,
            onClick: async () => {
              const r = await togglePinAction(thread.id);
              if (r.ok === false) {
                toast.error(r.error);
                return;
              }
              toast.success(r.pinned ? "This now leads the site" : "No longer leading the site");
              refresh();
              router.refresh();
            },
          },
        ];
      },
    }),
    [state, orgId, orgSlug, orgName, orgHomeUrl, displayName, canEdit, composeParts, settings, email, emailConnectors, router, hasDesignedPage]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
