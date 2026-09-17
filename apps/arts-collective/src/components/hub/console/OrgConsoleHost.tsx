"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SurfaceProvider,
  SurfaceFrame,
  useSurface,
  defaultThreadToAnswers,
  type SurfaceConnectors,
} from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import type { ComposeContext } from "@elkdonis/cms-ui/compose";
import { createThreadAction } from "@/lib/cms/actions";
import type { ThreadFormInput } from "@/lib/cms/schema";
import { CONSOLE_SURFACES } from "./AttentionBands";
import {
  DraftsSurface,
  ScheduleSurface,
  ResponsesSurface,
  PeopleSurface,
} from "./ConsoleSurfaces";
import { ConsoleSettings, type ConsoleSettingsProps } from "./ConsoleSettings";
import { EmailSurface, type EmailSuiteData, type EmailTab } from "@elkdonis/cms-ui/email";
import { useEmailConnectors } from "@/components/hub/email/use-email-connectors";
import { QuestionnaireComposer } from "@/components/cms/questionnaire-composer";
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

  const compose = React.useMemo<ComposeContext>(
    () => ({
      orgSlug,
      feeds,
      canManageOrg: canEdit,
      // This app is the network hub: cross-posting is the point of it, and
      // Talk rooms are already wired here (see /api/talk/join).
      canShareToNetwork: true,
      hasMeetings: true,
      // The workshop wizard is a route, not a sheet body — the catalogue says
      // so and ComposeFace honours it by navigating rather than opening an
      // empty dialog over it.
      hasWorkshops: true,
      canCreateTalkRoom: true,
    }),
    [orgSlug, feeds, canEdit]
  );

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

        // The names this person writes under. Scoped to the signed-in account
        // by the route itself, so nothing here identifies whose a name is.
        identities: {
          list: async () => {
            const res = await fetch("/api/hub/identities", { cache: "no-store" });
            if (!res.ok) throw new Error("identities");
            const data = await res.json();
            return data.identities ?? [];
          },
          create: async (input) => {
            const res = await fetch("/api/hub/identities", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false as const, error: data.error ?? "Could not open that name." };
            return { ok: true as const, identity: data.identity };
          },
          setRetired: async (identityId, retired) => {
            const res = await fetch("/api/hub/identities", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ identityId, retired }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false as const, error: data.error ?? "Could not change that name." };
            return { ok: true as const };
          },
        },

        compose,

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
              uploadEndpoint="/api/upload/image"
              libraryEndpoint="/api/media/library"
              label={label ?? "Image"}
              hint={hint}
              accept={accept}
            />
          ),
        },

        async saveThread({ kind, answers, status, actingAs }) {
          // Cast to one open shape: `CreateThreadResult` is a discriminated
          // union and this repo compiles with `strict: false`, where TS will
          // not narrow one — reading `.error` off the union is an error
          // without it. Same trap as PublishDraftResult.
          const result = (await createThreadAction(
            {
              ...answers,
              orgSlug,
              kind,
              status,
            } as unknown as ThreadFormInput,
            { actingAs }
          )) as {
            ok: boolean;
            id?: string;
            slug?: string;
            error?: string;
          };
          if (!result.ok || !result.id) {
            return { ok: false, error: result.error ?? "Could not save it" };
          }
          // The thread lives on the ORG'S site, not on this console, so the
          // "see it" link the surface offers has to point there.
          return {
            ok: true,
            id: result.id,
            href: result.slug ? `${orgHomeUrl}/${result.slug}` : null,
          };
        },

        threadToAnswers(thread) {
          return { ...defaultThreadToAnswers(thread), kind: thread.kind };
        },

        custom: {
          // Questionnaires and polls do NOT write to `threads` — they have
          // their own table and their own save path — so the compose surface
          // deliberately hides them unless the host registers a surface under
          // this exact key. Without these two the picker would silently drop
          // both kinds, which is what happened to the row this replaced.
          "compose:questionnaire": () => (
            <ComposeQuestionnaire orgSlug={orgSlug} kind="questionnaire" />
          ),
          "compose:poll": () => <ComposeQuestionnaire orgSlug={orgSlug} kind="poll" />,

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
    }),
    [state, orgId, orgSlug, orgName, orgHomeUrl, displayName, canEdit, compose, settings, email, emailConnectors, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}

/**
 * The questionnaire/poll composer, wearing a surface.
 *
 * `QuestionnaireComposer` is this app's own form against its own table; all
 * this adds is the shared frame so it looks like every other popup, and a
 * close that pops the layer rather than navigating.
 */
function ComposeQuestionnaire({
  orgSlug,
  kind,
}: {
  orgSlug: string;
  kind: "questionnaire" | "poll";
}) {
  const surface = useSurface();
  return (
    <SurfaceFrame
      kind={kind}
      title={kind === "poll" ? "New poll" : "New questionnaire"}
      kicker={orgSlug}
    >
      <QuestionnaireComposer
        orgSlug={orgSlug}
        kind={kind}
        onDone={() => surface.close()}
      />
    </SurfaceFrame>
  );
}
