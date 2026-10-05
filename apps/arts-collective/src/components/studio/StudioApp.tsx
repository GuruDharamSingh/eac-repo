"use client";

import * as React from "react";
import { StudioShell, type StudioShellProps } from "@elkdonis/studio";
import { videoExtension, type VideoKindProps } from "@elkdonis/reels/editor";

/**
 * The Studio with this app's kinds registered. A client module because the
 * server page cannot hand components across: it passes data and server
 * actions, and the extensions are built here (packages/studio/src/frame.tsx).
 */
export function StudioApp({ shell, video }: { shell: Omit<StudioShellProps, "extensions">; video: VideoKindProps }) {
  const extensions = React.useMemo(() => [videoExtension(video)], [video]);
  return <StudioShell {...shell} extensions={extensions} />;
}
