"use client";

import { createRoot } from "react-dom/client";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import type { PictureChooser } from "@elkdonis/direct-edit/visual";

/** The editor is plain DOM; pictures come from the site's own picker, with its upload and library routes. */
export const choosePicture: PictureChooser = (host, { value, onPick }) => {
  const root = createRoot(host);
  root.render(
    <MediaPicker
      value={value}
      onChange={onPick}
      uploadEndpoint="/api/upload"
      libraries={[
        { key: "site", label: "This site", endpoint: "/api/media/library" },
        { key: "mine", label: "My files", endpoint: "/api/media/library/mine" },
      ]}
      label="Picture"
      preview="none"
    />
  );
  return () => root.unmount();
};
