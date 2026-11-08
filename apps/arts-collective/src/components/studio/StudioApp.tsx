"use client";

import * as React from "react";
import { StudioShell, type StudioShellProps } from "@elkdonis/studio";
import { videoExtension, type VideoKindProps } from "@elkdonis/reels/editor";
import { postExtension, type PostKindProps } from "@elkdonis/studio/post";
import { meetingExtension, type MeetingKindProps } from "@elkdonis/studio/meeting";
import { recordingExtension, type RecordingKindProps } from "@elkdonis/studio/recording";
import { wordartExtension, type WordArtFont } from "@elkdonis/studio/wordart";
import { broadsheetFormTheme, gatheringActions, gatheringKind, type FormHost } from "@elkdonis/studio/forms";
import { formExtension, richTextBodySlot } from "@elkdonis/studio/forms/focus";
import { MediaPicker } from "@elkdonis/cms-ui/files";

const PERSONAL_ORG_ID = "oad";

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
  video,
  post,
  meeting,
  gathering,
  recording,
}: {
  shell: Omit<StudioShellProps, "extensions">;
  video: VideoKindProps;
  post: PostKindProps;
  meeting: MeetingKindProps;
  /** The publication forms' Gathering, on trial beside Meetings (2026-11-08). Same server actions. */
  gathering: { initialId: string | null };
  recording: RecordingKindProps;
}) {
  const orgs = shell.orgs;
  const extensions = React.useMemo(
    () => [
      videoExtension(video),
      postExtension(post),
      meetingExtension(meeting),
      formExtension({
        id: "gathering",
        label: "Gatherings (new)",
        listLabel: "Gatherings",
        schema: gatheringKind,
        // No arts-collective org runs an attendee-reminder tick or the minimum-reached mail yet.
        actions: gatheringActions(meeting.actions, { canRemind: () => false, canNotifyMin: () => false }),
        initialId: gathering.initialId,
        theme: broadsheetFormTheme,
        host: (orgId) => gatheringHost(orgId, orgs, meeting.uploadEndpoint, meeting.libraryEndpoint),
      }),
      recordingExtension(recording),
      wordartExtension({ fonts: WORDART_FONTS }),
    ],
    [video, post, meeting, gathering, recording, orgs]
  );
  return <StudioShell {...shell} extensions={extensions} />;
}

/** This app's links and pickers for the forms: the Studio is /studio here; never guessed inside the package. */
function gatheringHost(
  orgId: string,
  orgs: Array<{ orgId: string; slug: string }>,
  uploadEndpoint: string,
  libraryEndpoint: string | undefined
): Omit<FormHost, "actions"> {
  const orgSlug = orgs.find((o) => o.orgId === orgId)?.slug ?? PERSONAL_ORG_ID;
  return {
    studioHref: (o) => {
      const q = new URLSearchParams();
      // "post" is the writing room, the Studio's default kind; "" is the Studio itself.
      if (o.kind && o.kind !== "post") q.set("kind", o.kind);
      if (o.id) q.set("id", o.id);
      if (orgId !== PERSONAL_ORG_ID) q.set("org", orgId);
      if (o.preset) q.set("preset", o.preset);
      if (o.focus) q.set("focus", "1");
      const qs = q.toString();
      return `/studio${qs ? `?${qs}` : ""}`;
    },
    viewHref: (ref) => ref.href ?? null,
    loginHref: (next) => `/login?next=${encodeURIComponent(next)}`,
    preview: {},
    feeds: [],
    slots: {
      body: richTextBodySlot(),
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
