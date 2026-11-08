"use client";

import * as React from "react";
import { StudioShell, type StudioShellProps } from "@elkdonis/studio";
import { videoExtension, type VideoKindProps } from "@elkdonis/reels/editor";
import { postExtension, type PostKindProps } from "@elkdonis/studio/post";
import { meetingExtension, type MeetingKindProps } from "@elkdonis/studio/meeting";
import { recordingExtension, type RecordingKindProps } from "@elkdonis/studio/recording";
import { wordartExtension, type WordArtFont } from "@elkdonis/studio/wordart";

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
  recording,
}: {
  shell: Omit<StudioShellProps, "extensions">;
  video: VideoKindProps;
  post: PostKindProps;
  meeting: MeetingKindProps;
  recording: RecordingKindProps;
}) {
  const extensions = React.useMemo(
    () => [videoExtension(video), postExtension(post), meetingExtension(meeting), recordingExtension(recording), wordartExtension({ fonts: WORDART_FONTS })],
    [video, post, meeting, recording]
  );
  return <StudioShell {...shell} extensions={extensions} />;
}
