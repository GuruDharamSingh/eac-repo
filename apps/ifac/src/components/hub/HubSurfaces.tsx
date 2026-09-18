"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SurfaceProvider,
  defaultThreadToAnswers,
  type SurfaceConnectors,
} from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { saveContentAction } from "@/lib/cms/actions";
import { toSaveContentInput } from "@/lib/cms/compose-adapter";
import { siteConfig } from "@/config/site";
import { FilesSurface } from "./FilesCard";
import { PageSectionsSurface } from "./PageSectionsCard";
import { HelpSurface, QuestionnairesSurface } from "./wide-surfaces";
import { QuestionnaireComposeSurface } from "./questionnaire-composer";
import { ArtPieceComposer } from "./art-piece-composer";
import { BlogGate } from "./blog-gate";
// The shared canvas. Lifted out of amrit-canada rather than copied — see
// packages/cms-ui/src/whiteboard. Excalidraw is an optional peer of cms-ui,
// so importing this subpath is what opts this app into the dependency.
import { WhiteboardSurface } from "@elkdonis/cms-ui/whiteboard";

/**
 * IFAC's connectors for the shared surface system.
 *
 * This site predates the surface system and grew its own popup idiom — a
 * `HubCard` wrapping a native <dialog>, one of the four idioms the shared
 * system was built to replace. Mounting the provider here does not remove
 * that: both work side by side, so the hub's tiles move onto faces one at a
 * time instead of in a single risky sweep.
 *
 * The routine half comes from `createHubConnectors`. What is stated here is
 * only what is true of THIS site:
 *
 *   board   — IFAC already serves the whole /api/pipeline/cards/* Deck API,
 *             so the shared board surface works against the default routes.
 *   forum   — /api/hub/forum, added beside this file.
 *   rsvp    — overridden: IFAC takes {threadId,status} on one POST, not the
 *             POST/DELETE on /api/threads/:id/rsvp the template apps use.
 *
 * `loadThread` uses the factory default against /api/hub/threads/[id], which
 * this site had no equivalent of until now — it is a prerequisite rather than
 * a nicety, because a calendar day with one thing on it opens that thing.
 *
 * `compose` IS claimed now. It was not, on the grounds that "this site's
 * authoring lives at /hub/compose" — which meant the Compose tile was the one
 * tile on the hub that left the page. Everything else opens where you are and
 * stacks; compose threw the hub away, and a stray click on the way back cost
 * the draft. amrit-canada has run the other way for months: the common kinds
 * sit ON the face, the rest open the catalogue in the same dialog, and the
 * route survives only for authoring too large for a popup.
 *
 * Three things had to be true before the face could work, and all three are
 * host facts the shared code cannot supply:
 *   compose      — what IFAC can make (its feeds, whether it has meetings).
 *   saveThread   — its own write path. The same `saveContentAction` the
 *                  /hub/compose page uses, so a meeting made from a calendar
 *                  day is the same meeting that page would make.
 *   composeSlots — its rich-text editor and its media picker. Without these
 *                  the body is a bare textarea and the cover image is a URL
 *                  box, which is the thing we do not do.
 *
 * Deliberately NOT claimed:
 *   centerLayout — the /api/center/layout route does not exist here yet.
 */
export function HubSurfaces({
  signedIn,
  canEdit,
  userId = null,
  displayName,
  feeds,
  children,
}: {
  signedIn: boolean;
  canEdit: boolean;
  /** The viewer's account id — what lets an author remove their own thread. */
  userId?: string | null;
  displayName?: string | null;
  /** The org's sections, so a composed item can be filed into one. */
  feeds: Array<{ slug: string; name: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      createHubConnectors({
        // canCompose was pinned false while this site had no compose surface.
        // Publishing for the org is an owner/guide act — the same gate
        // saveContentAction enforces server-side, mirrored here so a member
        // is not offered a form that will refuse them.
        viewer: {
          signedIn,
          canCompose: canEdit,
          displayName,
          // Editors take anything down; anyone may take down their own.
          canRemove: (t) => canEdit || (Boolean(userId) && t.authorId === userId),
        },
        orgName: siteConfig.orgName,
        timeZone: "America/Toronto",
        board: true,
        // `true` takes the factory's default read of /api/hub/forum; the
        // object form adds the section loader the popup uses when someone
        // walks into a section rather than out to the board.
        forum: {
          listFeed: async (slug: string) => {
            const res = await fetch(`/api/hub/forum?feed=${encodeURIComponent(slug)}`);
            if (!res.ok) throw new Error("Could not load that section");
            const data = await res.json();
            return Array.isArray(data.threads) ? data.threads : [];
          },
        },
        // Ideas and documents moved onto the shared surfaces. They were built
        // here first and were the only real ones in the repo; what was local
        // about them was the routes, which `createHubConnectors` now addresses
        // by the same paths this site already served.
        documents: true,
        // What a thread holds: the weekly meeting and the document written in
        // it, the terms defined out of it and the board it moved, as one
        // occasion rather than four tiles. IFAC is the first host because it
        // is the only one with all four — a `weekly-meeting` feed, living
        // documents, a Deck board and a forum. See migration 131.
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
        ideas: { href: "/forum/ideas" },
        // Identity — name, portrait, bio, links — is the shared `profile`
        // surface type (not `custom`): the same `users` row every org site
        // edits, read and written through /api/center/profile and
        // /api/center/avatar, which this app now serves the same way
        // amrit-canada and innergathering do.
        profile: true,
        onMutated: () => router.refresh(),

        // What this site can compose. Stated once, here, rather than again on
        // every page that draws a compose control.
        compose: {
          orgSlug: siteConfig.orgId,
          feeds,
          canManageOrg: canEdit,
          hasMeetings: true,
          canCreateDocument: true,
          // Workshops in DIALOG mode, not route. The catalogue's route form
          // points at /hub/workshops/:orgSlug/new — the ten-step template
          // wizard — and IFAC has no such route, so offering it that way
          // would be a door onto nothing, which is exactly what the
          // capability-derived catalogue exists to prevent. In dialog mode
          // the same composer gains the presentation and sessions groups and
          // writes kind='workshop' through this site's own save path.
          hasWorkshops: true,
          workshopMode: "dialog",
          // IFAC's members sell work and keep their own writing here, so both
          // of these are real. They are off by default for everyone else —
          // most orgs are not a marketplace and have no member profiles for a
          // blog to hang on.
          hasArtworks: true,
          hasMemberBlogs: true,
        },

        async saveThread({ kind, answers, status }) {
          const result = await saveContentAction(
            toSaveContentInput(kind, answers, status)
          );
          // `!result.ok` does not narrow in this repo — compare explicitly.
          if (result.ok === false) return { ok: false, error: result.error };
          return { ok: true, id: result.id, href: null };
        },

        composeSlots: {
          body: ({ value, onChange, tier }) => (
            <RichTextEditor
              value={value}
              onChange={onChange}
              toolbar={tier === "quick" ? "compact" : "full"}
            />
          ),
          // Never a URL box: pasting a path means dead links and images the
          // org does not control. Upload, or choose from what IFAC already
          // has.
          //
          // `/api/media/upload`, NOT `/api/upload`. The latter is the ARTIST
          // portfolio route — it writes into `EAC_Network/users/<slug>/` and
          // requires a `memberSlug`, so composing a meeting cover got back
          // "memberSlug is required", which reads as a permissions refusal
          // and is really a missing route. A meeting's cover belongs to IFAC,
          // so it goes in the org's own media tree.
          media: ({ value, onChange, label, hint, accept }) => (
            <MediaPicker
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
              uploadEndpoint="/api/media/upload"
              libraryEndpoint="/api/media/library"
              label={label ?? "Image"}
              hint={hint}
              accept={accept}
            />
          ),
        },

        threadToAnswers(thread) {
          return {
            ...defaultThreadToAnswers(thread, { timeZone: "America/Toronto" }),
            kind: thread.kind,
          };
        },

        // This site's own features, which have no shared surface: they are
        // real here and nowhere else. Registered as `custom`, which trades
        // URL-addressability for not having to invent a network-wide
        // descriptor for one org's filing cabinet.
        custom: {
          files: ({ descriptor }) => <FilesSurface descriptor={descriptor} />,
          "page-sections": ({ descriptor }) => (
            <PageSectionsSurface descriptor={descriptor} />
          ),
          questionnaires: ({ descriptor }) => (
            <QuestionnairesSurface descriptor={descriptor} />
          ),
          help: () => <HelpSurface />,

          // The compose catalogue offers a kind that writes `threads` when
          // `saveThread` exists, and a kind that writes anything else only
          // when the host registers `compose:<id>` — because a questionnaire's
          // save path is per app and the shared surface cannot guess it.
          // IFAC has one, so both kinds appear in the popup alongside post,
          // event, meeting and workshop rather than only on the page.
          "compose:questionnaire": () => (
            <QuestionnaireComposeSurface kind="questionnaire" />
          ),
          "compose:poll": () => <QuestionnaireComposeSurface kind="poll" />,

          // A piece of work, with its measurements. Writes `artwork` through
          // the commerce package's own `createArtwork`, so IFAC never grows a
          // second representation of a thing art-auction already owns.
          "compose:art-piece": () => <ArtPieceComposer />,

          // The blog's door: the offer and its one decision the first time,
          // and straight through to the page every time after.
          "compose:blog": () => <BlogGate />,

          // Any member may draw — the same gate as ideas, and deliberately
          // not `canEdit`. Publishing for the org is an editorial act;
          // sketching on a scratch canvas is not.
          whiteboard: () => (
            <WhiteboardSurface
              onSaveError={() => toast.error("Couldn't save the whiteboard.")}
            />
          ),
        },

        // One POST carries both directions here.
        async rsvp(thread, going) {
          const res = await fetch("/api/hub/rsvp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threadId: thread.id, status: going ? "yes" : "no" }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, error: data.error ?? "Could not update your RSVP." };
          return { ok: true, attending: Boolean(data.attending ?? going), count: data.count };
        },
      }),
    [signedIn, canEdit, userId, displayName, feeds, router]
  );

  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
