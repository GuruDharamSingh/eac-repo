"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SurfaceProvider,
  defaultThreadToAnswers,
  type SurfaceConnectors,
} from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { EmailPopup } from "./email/EmailPopup";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { saveContentAction } from "@/lib/cms/actions";
import { saveWorkshopAction } from "@/lib/cms/workshop-actions";
import { toWorkshopInput } from "@/lib/cms/workshop-adapter";
import { toContentFormValues } from "@/lib/cms/compose-adapter";
import { PlanAheadSurface } from "@elkdonis/cms-ui/hub";
import { QuestionnaireComposeSurface } from "@elkdonis/cms-ui/compose";
import { createQuestionnaireAction } from "@/lib/cms/questionnaire-actions";
import { ArtPieceGate, BlogGate } from "@/components/hub/publish-gates";
// The shared canvas. Its own subpath because @excalidraw/excalidraw is an
// optional peer of cms-ui — a drawing engine must not ride along with the hub.
import { WhiteboardSurface } from "@elkdonis/cms-ui/whiteboard";
import { siteConfig } from "@/config/site";

const TIME_ZONE = "America/Toronto";

/** What this group promises about who reads the answers. */
const QUESTIONNAIRE_PRIVACY = {
  poll: "Everyone who answers sees the running result. It is never public.",
  questionnaire: "Answers are visible to this group's organisers only.",
} as const;

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
  userId = null,
  displayName,
  feeds,
  talkBaseUrl,
  children,
}: {
  signedIn: boolean;
  canEdit: boolean;
  /** The viewer's account id — what lets an author remove their own thread. */
  userId?: string | null;
  displayName?: string | null;
  feeds: Array<{ slug: string; name: string }>;
  talkBaseUrl: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      createHubConnectors({
        viewer: {
          signedIn,
          canCompose: canEdit,
          displayName,
          // Editors take anything down; anyone may take down their own.
          canRemove: (t) => canEdit || (Boolean(userId) && t.authorId === userId),
        },
        orgName: siteConfig.orgName,
        timeZone: TIME_ZONE,
        talkBaseUrl,
        readingVoice: "journal",

        board: true,
        profile: true,
        centerLayout: true,
        // Living documents in this org's own Nextcloud folder, behind
        // /api/hub/documents.
        //
        // `forum` is on now — this app serves /forum. `listFeed` is what lets
        // the popup open a SECTION in place instead of navigating out to the
        // board for it.
        documents: true,
        forum: {
          listFeed: async (slug: string) => {
            const res = await fetch(`/api/hub/forum?feed=${encodeURIComponent(slug)}`);
            if (!res.ok) return [];
            const body = await res.json().catch(() => ({}));
            return Array.isArray(body.threads) ? body.threads : [];
          },
        },
        // What a thread holds: the gathering and the document written in it,
        // the terms defined out of that and the board it moved, as one
        // occasion rather than four tiles. See migration 131.
        // Gathering is OFF as a surface action (2026-09-17, user's call): the
        // "Gather / Arrange what this holds" button was appearing on every
        // thread popup, which made it feel pasted on. The edge (migration 131)
        // and the forum's map of it stay; what a thread already holds still
        // lists, since that comes down with the thread. Gathering as an act
        // gets its own home when the time comes — flip this back to wire it.
        gather: false,
        // Remove from the popup (author or editor) and feature a meeting as
        // the standing one (editor) — both on the same thread route.
        remove: true,
        standing: true,

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
          // The two door-kinds above. Off by default in the catalogue, so a
          // host that has not registered their surfaces never offers them.
          hasMemberBlogs: true,
          hasArtworks: true,
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

        custom: {
          // The email suite, in the popup. The SAME component the full page
          // at /hub/email renders — one email UI, opened two ways, which is
          // the point of consolidating the four app-local attempts.
          //
          // Fetches its own data on open — this provider is mounted in the
          // ROOT layout, so anything passed in here would be loaded on every
          // page of the site. It refuses itself for a non-editor, because the
          // route does.
          email: ({ descriptor }) => <EmailPopup descriptor={descriptor} />,

          // Who is hosting the coming weeks. Opened from the standing
          // meeting's "Plan ahead" tool; read by any member, written by an
          // organiser — or by a member putting themselves down for a week.
          "meeting-rota": ({ descriptor }) => (
            <PlanAheadSurface
              threadId={String(descriptor.props?.threadId ?? "")}
              canPlan={Boolean(descriptor.props?.canPlan)}
              timeZone={TIME_ZONE}
            />
          ),

          // The shared canvas, at full width: a drawing surface with a
          // toolbar down one side has nothing to give back at tile-and-a-half.
          whiteboard: () => <WhiteboardSurface />,

          // The compose catalogue offers a kind that writes `threads` through
          // `saveThread`; a kind that writes anything ELSE appears only when
          // the host registers `compose:<id>`, because a questionnaire's save
          // path is per app and the shared surface cannot guess it. These two
          // are what put Questionnaire and Poll in the popup alongside post,
          // event, meeting and workshop rather than only on the page.
          "compose:questionnaire": () => (
            <QuestionnaireComposeSurface
              kind="questionnaire"
              onSave={createQuestionnaireAction}
              privacyNote={QUESTIONNAIRE_PRIVACY}
            />
          ),
          // Two kinds that are DOORS, not forms — both act on the member's own
          // page rather than on the site. Registering them is what puts them
          // in the publish catalogue at all.
          "compose:blog": () => <BlogGate />,
          "compose:art-piece": () => <ArtPieceGate />,

          "compose:poll": () => (
            <QuestionnaireComposeSurface
              kind="poll"
              onSave={createQuestionnaireAction}
              privacyNote={QUESTIONNAIRE_PRIVACY}
            />
          ),
        },

        onMutated: () => router.refresh(),
      }),
    [signedIn, canEdit, userId, displayName, feeds, talkBaseUrl, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
