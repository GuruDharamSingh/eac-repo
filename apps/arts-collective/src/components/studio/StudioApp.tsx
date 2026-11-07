"use client";

import * as React from "react";
import { StudioShell, type StudioShellProps } from "@elkdonis/studio";
import { videoExtension, type VideoKindProps } from "@elkdonis/reels/editor";
import { postExtension, type PostKindProps } from "@elkdonis/studio/post";
import { meetingExtension, type MeetingKindProps } from "@elkdonis/studio/meeting";
import { recordingExtension, type RecordingKindProps } from "@elkdonis/studio/recording";

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
    () => [videoExtension(video), postExtension(post), meetingExtension(meeting), recordingExtension(recording)],
    [video, post, meeting, recording]
  );
  return <StudioShell {...shell} extensions={extensions} />;
}
