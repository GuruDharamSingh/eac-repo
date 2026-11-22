"use client";

import { createRoot } from "react-dom/client";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { PICTURE_LIBRARIES } from "@/lib/media-libraries-config";
import type { PictureChooser } from "@elkdonis/direct-edit/visual";

/** The editor is plain DOM; pictures come from the site's own picker, with its upload and library routes. */
export const choosePicture: PictureChooser = (host, { value, onPick }) => {
  const root = createRoot(host);
  root.render(
    <MediaPicker
      value={value}
      onChange={onPick}
      uploadEndpoint="/api/upload"
      libraries={PICTURE_LIBRARIES}
      label="Picture"
      preview="none"
    />
  );
  return () => root.unmount();
};
