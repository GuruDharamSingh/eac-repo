"use client";

// cms-ui does not list @types/react-dom, so this import has no declaration
// here (the apps that render it do). `ts-ignore`, not `ts-expect-error`: it
// stays quiet if the types are added later.
// @ts-ignore TS7016
import { createRoot as createReactRoot } from "react-dom/client";
import { MediaPicker } from "./MediaPicker";

/**
 * The picture chooser the direct-edit canvas asks a site for, built from the
 * site's own routes.
 *
 * The canvas is plain DOM, so the chooser mounts a React root into a host
 * element and hands back the function that unmounts it. Four apps carried this
 * as a ~20-line copy that differed only in the upload endpoint and the
 * libraries; those are the arguments.
 *
 * Typed STRUCTURALLY: this has the shape of direct-edit's `PictureChooser`
 * (`(host, { value, onPick }) => dispose`), so it can be assigned to one, but
 * cms-ui does not import direct-edit.
 *
 *   export const choosePicture: PictureChooser = makeChoosePicture({
 *     uploadEndpoint: "/api/upload",
 *     libraries: [{ key: "site", label: "Site images", endpoint: "/api/media/library" }],
 *   });
 *
 * The editor itself refuses a path with a Private segment (`isPrivatePicture`).
 */
export interface ChoosePictureOptions {
  uploadEndpoint: string;
  libraries: Array<{ key: string; label: string; endpoint: string }>;
  /** Default "Picture". */
  label?: string;
}

const createRoot = createReactRoot as (host: HTMLElement) => {
  render(node: unknown): void;
  unmount(): void;
};

export function makeChoosePicture(
  opts: ChoosePictureOptions
): (host: HTMLElement, o: { value?: string; onPick(url: string): void }) => () => void {
  return (host, { value, onPick }) => {
    const root = createRoot(host);
    root.render(
      <MediaPicker
        value={value}
        onChange={onPick}
        uploadEndpoint={opts.uploadEndpoint}
        libraries={opts.libraries}
        label={opts.label ?? "Picture"}
        preview="none"
      />
    );
    return () => root.unmount();
  };
}
