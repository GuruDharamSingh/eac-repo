"use client";

import { createRoot } from "react-dom/client";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import type { PictureChooser } from "@elkdonis/direct-edit/visual";

/**
 * The canvas is plain DOM; pictures come from the site's own picker, with the routes
 * Puck's editor uses (sunjay's, 2026-11-11). The editor refuses a path with a Private
 * segment (`isPrivatePicture`): visitors could not load it.
 */
export const choosePicture: PictureChooser = (host, { value, onPick }) => {
  const root = createRoot(host);
  root.render(
    <MediaPicker
      value={value}
      onChange={onPick}
      uploadEndpoint="/api/upload"
      libraries={[{ key: "site", label: "Site images", endpoint: "/api/media/library" }]}
      label="Picture"
      preview="none"
    />,
  );
  return () => root.unmount();
};
