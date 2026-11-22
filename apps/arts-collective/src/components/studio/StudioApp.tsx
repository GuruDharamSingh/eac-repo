"use client";

import * as React from "react";
import { StudioShell, type StudioShellProps } from "@elkdonis/studio";
import { videoExtension, type VideoKindProps } from "@elkdonis/reels/editor";
import { postExtension, type PostKindProps } from "@elkdonis/studio/post";
import { createExtension, type CreateKindProps } from "@elkdonis/studio/create";
import { PieceSummaryHostContext, type PieceSummaryHost } from "@elkdonis/studio/summary";
import type { MeetingActions } from "@elkdonis/studio-forms/meeting";
import { recordingExtension, type RecordingKindProps } from "@elkdonis/studio/recording";
import { wordartExtension, type WordArtFont } from "@elkdonis/studio/wordart";
import {
  artworkActions,
  artworkKind,
  ledgerFormTheme,
  ledgerDarkFormTheme,
  meetingActions,
  meetingKind,
  serviceActions,
  serviceKind,
  type FormHost,
  type FormKindId,
} from "@elkdonis/studio-forms";
import { artworkFormContextAction, listArtworkFormAction, loadArtworkFormAction, saveArtworkFormAction } from "@/lib/artwork-form-actions";
import { loadMakeIntoPresetAction } from "@/lib/make-into-preset";
import { listServiceFormAction, loadServiceFormAction, saveServiceFormAction, serviceFormContextAction } from "@/lib/service-form-actions";
import { canvasBlocksSlot, formExtension, richTextBodySlot } from "@elkdonis/studio/forms/focus";
import type { ThreadCardSearchHit } from "@elkdonis/studio";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import type { ChannelLinkRequest } from "@elkdonis/utils/host";

const PERSONAL_ORG_ID = "oad";

/** The forms' kinds → this Studio's `?kind=`. */
const STUDIO_KIND_OF: Partial<Record<FormKindId, string>> = {
  post: "",
  meeting: "meeting",
  artwork: "artwork-form",
  service: "service-form",
};

/**
 * Fonts word art can set text in (public/fonts/wordart; opentype.js reads TTF, OTF and WOFF, not WOFF2).
 * Licences: Basteleur, Alfa Slab One, Cinzel and Cormorant Garamond are OFL. Brothers is personal-use only
 * until its commercial licence is bought (circlefont.com); Religath here is the demo build.
 */
const WORDART_FONTS: WordArtFont[] = [
  { id: "basteleur-bold", label: "Basteleur Bold", url: "/fonts/wordart/Basteleur-Bold.woff", note: "OFL." },
  { id: "basteleur-moonlight", label: "Basteleur Moonlight", url: "/fonts/wordart/Basteleur-Moonlight.woff", note: "OFL." },
  { id: "brothers", label: "Brothers (the ELKDONIS wordmark)", url: "/fonts/wordart/BrothersTypeface-Regular.otf", note: "Personal-use licence only until the commercial licence is bought (circlefont.com)." },
  { id: "religath", label: "Religath (the EAC logo face)", url: "/fonts/RELIGATH-Demo.otf", note: "Demo build: no swash alternates, and demo terms apply." },
  { id: "alfa-slab", label: "Alfa Slab One", url: "/fonts/wordart/AlfaSlabOne-Regular.ttf", note: "OFL." },
  { id: "cinzel", label: "Cinzel", url: "/fonts/wordart/Cinzel.ttf", note: "OFL." },
  { id: "cormorant", label: "Cormorant Garamond", url: "/fonts/wordart/CormorantGaramond.ttf", note: "OFL." },
];

/**
 * The Studio with this app's kinds registered. A client module because the
 * server page cannot hand components across: it passes data and server
 * actions, and the extensions are built here (packages/studio/src/frame.tsx).
 */
export function StudioApp({
  shell,
  makeFrom,
  video,
  post,
  meeting,
  artworkForm,
  serviceForm,
  recording,
  create,
  summary,
}: {
  shell: Omit<StudioShellProps, "extensions">;
  /** Make into (2026-11-15): the source piece key; the form kinds offer a "From ..." preset built from it. */
  makeFrom?: string | null;
  video: VideoKindProps;
  post: PostKindProps;
  /**
   * The meeting form (the `meeting` kind since 2026-11-14, when the old Meetings tab was retired;
   * docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md §7).
   */
  meeting: { initialId: string | null; actions: MeetingActions; uploadEndpoint: string; libraryEndpoint?: string };
  /** The publication forms' Artwork and Offering, on trial (pass 2). */
  artworkForm: { initialId: string | null };
  serviceForm: { initialId: string | null };
  recording: RecordingKindProps;
  /** Create (canvas A, 2026-11-14): New, Bring in, the Library with Make into, Products, brand kit; at ?kind=create. */
  create?: CreateKindProps;
  /** The piece summary in front of the forms for published pieces (canvas C, 2026-11-14). */
  summary?: PieceSummaryHost;
}) {
  const orgs = shell.orgs;
  // The Writing room's Canvas upload and card search, shared with the meeting's block body.
  const canvas = React.useMemo(
    () => ({ upload: shell.upload ? { endpoint: shell.upload.endpoint, fields: shell.upload.fields } : undefined, search: shell.actions.searchThreads }),
    [shell.upload, shell.actions.searchThreads]
  );
  const extensions = React.useMemo(
    () => [
      ...(create ? [createExtension(create)] : []),
      videoExtension(video),
      postExtension(post),
      formExtension({
        id: "meeting",
        label: "Meetings",
        listLabel: "Meetings",
        schema: meetingKind,
        presets: (orgId) => (makeFrom ? loadMakeIntoPresetAction(makeFrom, "meeting", orgId).then((p) => (p ? [p] : [])) : Promise.resolve([])),
        // No arts-collective org runs an attendee-reminder tick or the minimum-reached mail yet.
        // Series are not made here: they are their own kind, made and edited in the planner.
        actions: meetingActions(meeting.actions, { canRemind: () => false, canNotifyMin: () => false }),
        initialId: meeting.initialId,
        theme: ledgerFormTheme,
        themeDark: ledgerDarkFormTheme,
        host: (orgId) => formHost(orgId, orgs, meeting.uploadEndpoint, meeting.libraryEndpoint, canvas),
        // The Studio column's "All pieces" (2026-11-11): the org's meetings, dated by when they meet.
        // Series are left out: the form does not open them (adapters/meeting.ts load).
        items: (orgId) =>
          meeting.actions.listMeetings(orgId).then((list) =>
            list.filter((m) => !m.isSeries).map((m) => ({ id: m.id, title: m.title, status: m.status, updatedAt: m.updatedAt, when: m.scheduledAt }))
          ),
      }),
      formExtension({
        id: "artwork-form",
        label: "Artwork (new)",
        listLabel: "Artwork",
        schema: artworkKind,
        presets: (orgId) => (makeFrom ? loadMakeIntoPresetAction(makeFrom, "artwork-form", orgId).then((p) => (p ? [p] : [])) : Promise.resolve([])),
        actions: artworkActions({
          context: artworkFormContextAction,
          loadArtwork: loadArtworkFormAction,
          saveArtwork: saveArtworkFormAction,
          listArtworks: listArtworkFormAction,
        }),
        initialId: artworkForm.initialId,
        theme: ledgerFormTheme,
        themeDark: ledgerDarkFormTheme,
        host: (orgId) => formHost(orgId, orgs, meeting.uploadEndpoint, meeting.libraryEndpoint),
        // The person's own works, whichever org is acting (as the form saves them).
        items: () => listArtworkFormAction(),
      }),
      formExtension({
        id: "service-form",
        label: "Offerings (new)",
        listLabel: "Offerings",
        schema: serviceKind,
        presets: (orgId) => (makeFrom ? loadMakeIntoPresetAction(makeFrom, "service-form", orgId).then((p) => (p ? [p] : [])) : Promise.resolve([])),
        actions: serviceActions({
          context: serviceFormContextAction,
          loadService: loadServiceFormAction,
          saveService: saveServiceFormAction,
          listServices: listServiceFormAction,
        }),
        initialId: serviceForm.initialId,
        theme: ledgerFormTheme,
        themeDark: ledgerDarkFormTheme,
        host: (orgId) => formHost(orgId, orgs, meeting.uploadEndpoint, meeting.libraryEndpoint),
        items: (orgId) => listServiceFormAction(orgId),
      }),
      recordingExtension(recording),
      wordartExtension({ fonts: WORDART_FONTS, recording: { uploadEndpoint: "/api/studio/recordings/upload", reelHref: "/studio?kind=video" } }),
    ],
    [video, post, meeting, artworkForm, serviceForm, recording, create, orgs, canvas, makeFrom]
  );
  const links = React.useMemo(() => ({ ...shell.links, channelHref: channelPieceHref }), [shell.links]);
  const studio = <StudioShell {...shell} links={links} extensions={extensions} />;
  return summary ? <PieceSummaryHostContext.Provider value={summary}>{studio}</PieceSummaryHostContext.Provider> : studio;
}

/**
 * A piece's board in this app's Channel (2026-11-11): /channel/piece/<thread|artwork>/<id>, with
 * `?org=` for an org's own piece (Channel treats an unknown or personal org as the artist's scope,
 * lib/channel/load.ts). The Studio's Board link and its "Continue in Channel" use it.
 */
function channelPieceHref(o: ChannelLinkRequest): string | null {
  if (!o.id) return null;
  const org = o.org && o.org !== PERSONAL_ORG_ID ? `?org=${encodeURIComponent(o.org)}` : "";
  return `/channel/piece/${o.store}/${encodeURIComponent(o.id)}${org}`;
}

/** This app's links and pickers for the forms: the Studio is /studio here; never guessed inside the package. */
function formHost(
  orgId: string,
  orgs: Array<{ orgId: string; slug: string }>,
  uploadEndpoint: string,
  libraryEndpoint: string | undefined,
  /** The Writing room's Canvas upload and card search, for a block body ("What"). */
  canvas?: { upload?: { endpoint: string; fields?: Record<string, string> }; search?: (kind: string, q: string) => Promise<ThreadCardSearchHit[]> }
): Omit<FormHost, "actions"> {
  const orgSlug = orgs.find((o) => o.orgId === orgId)?.slug ?? PERSONAL_ORG_ID;
  return {
    studioHref: (o) => {
      const q = new URLSearchParams();
      // "post" is the writing room, the Studio's default kind; "" is the Studio itself.
      const studioKind = STUDIO_KIND_OF[o.kind as FormKindId] ?? o.kind;
      if (studioKind) q.set("kind", studioKind);
      if (o.id) q.set("id", o.id);
      if (orgId !== PERSONAL_ORG_ID) q.set("org", orgId);
      if (o.preset) q.set("preset", o.preset);
      if (o.focus) q.set("focus", "1");
      const qs = q.toString();
      return `/studio${qs ? `?${qs}` : ""}`;
    },
    viewHref: (ref) => ref.href ?? null,
    channelHref: channelPieceHref,
    loginHref: (next) => `/login?next=${encodeURIComponent(next)}`,
    preview: {},
    feeds: [],
    slots: {
      body: richTextBodySlot(),
      // A meeting's "What" in blocks, as the Writing room's Canvas (developer's brief; added 2026-11-11 after
      // the live Studio showed only the toolbar editor). Pictures go where Writing's do (acting org's slug added).
      // Layouts that do not ask for blocks (artwork, offering) keep their own editor.
      blocks: canvasBlocksSlot({
        search: canvas?.search,
        upload: canvas?.upload ? { ...canvas.upload, fields: { ...(canvas.upload.fields ?? {}), orgSlug } } : undefined,
        placeholder: "What happens, who it is for, what to bring.",
      }),
      media: ({ value, onChange, label, hint }) => (
        <MediaPicker
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          uploadEndpoint={uploadEndpoint}
          libraryEndpoint={libraryEndpoint ? libraryEndpoint.replace(":org", encodeURIComponent(orgSlug)) : undefined}
          uploadFields={{ orgSlug, context: "content" }}
          label={label ?? "Cover image"}
          hint={hint}
        />
      ),
    },
  };
}
