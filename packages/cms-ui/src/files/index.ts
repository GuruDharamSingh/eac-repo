export { FilesCard } from "./FilesCard";
export type { FilesCardProps, FilesCardSource, FilesCardEntry } from "./FilesCard";

// Mantine-free replacement for MediaUpload + FileBrowser in @elkdonis/ui.
export { MediaPicker } from "./MediaPicker";
export type { MediaPickerProps, MediaPickerItem } from "./MediaPicker";

// The library half of MediaPicker: folders, search, draggable tiles.
export { MediaBrowser, MEDIA_DRAG_TYPE, writeMediaDrag, readMediaDrop, isMediaDrag } from "./MediaBrowser";
export type { MediaBrowserProps, MediaBrowserItem } from "./MediaBrowser";

// A cover's preview and framing (focal point + zoom), and the style that draws
// a framed cover; `cover-frame.ts` has no "use client", so server pages use it.
export { CoverFramer } from "./CoverFramer";
export type { CoverFramerProps, CoverFramerShape } from "./CoverFramer";
export { coverEmbedSrc, coverFrameStyle, frameOrNull } from "./cover-frame";
export type { CoverFrame } from "./cover-frame";

// A cover chooser: framed picture, video file with a still, or a YouTube/Vimeo
// link (2026-10-18; series covers and series weeks).
export { CoverField } from "./CoverField";
export type { CoverValue } from "./CoverField";
