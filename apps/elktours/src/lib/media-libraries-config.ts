// Client-safe. The libraries the elktours picture picker offers (MEDIA lane, 2026-11-21): one tab each in the shared
// MediaPicker (@elkdonis/cms-ui/files). The routes are app/api/media/libraries/[key]; what each person may open is
// decided there (lib/media-libraries.ts), so listing a tab here grants nothing.

export interface PictureLibrary {
  key: string;
  label: string;
  endpoint: string;
}

const BASE = "/api/media/libraries";

/** Tours, Places, General, Stop folders: the libraries a block's picture setting offers. */
export const PICTURE_LIBRARIES: PictureLibrary[] = [
  { key: "tours", label: "Tours", endpoint: `${BASE}/tours` },
  { key: "places", label: "Places", endpoint: `${BASE}/places` },
  { key: "general", label: "General", endpoint: `${BASE}/general` },
  { key: "stops", label: "Stop folders", endpoint: `${BASE}/stops` },
];

/**
 * For a screen that knows its tour (the creation flow): "This tour" opens straight into that tour's pictures, and the
 * Tours tab is dropped since "This tour" is the same library narrowed.
 */
export function pictureLibraries(opts: { tourId?: string } = {}): PictureLibrary[] {
  const out: PictureLibrary[] = [];
  if (opts.tourId) out.push({ key: "this-tour", label: "This tour", endpoint: `${BASE}/tours?tour=${encodeURIComponent(opts.tourId)}` });
  out.push(...PICTURE_LIBRARIES.filter((l) => !(opts.tourId && l.key === "tours")));
  return out;
}
