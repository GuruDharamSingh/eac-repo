import * as React from "react";

// ============================================================================
// What a file IS, at a glance: a family (document, sheet, slides, PDF, image,
// audio, video, archive, code, text, other), a short label ("PDF", "DOCX")
// and an icon. Inline SVG — no icon package — so every host renders it the
// same without an install.
//
// Colours are the family's badge fill; the label on it is white. Each was
// measured against the #ffffff label (WCAG 2.1, 2026-09-18): folder 5.0,
// pdf 6.5, doc 7.4, sheet 6.5, slides 6.1, image 7.4, audio 7.8, video 7.6,
// archive 8.6, code 10.6, text 9.3, other 6.2 — all ≥ 4.5:1.
// ============================================================================

export type FileFamily =
  | "folder"
  | "pdf"
  | "doc"
  | "sheet"
  | "slides"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "code"
  | "text"
  | "other";

export const FAMILY_COLOR: Record<FileFamily, string> = {
  folder: "#8a6a1f",
  pdf: "#b3261e",
  doc: "#2553a3",
  sheet: "#1d6b3a",
  slides: "#a4450f",
  image: "#6a3fa0",
  audio: "#8a2f6a",
  video: "#1f5a73",
  archive: "#5a4a2a",
  code: "#3b3f46",
  text: "#44474f",
  other: "#5b6170",
};

const FAMILY_NAME: Record<FileFamily, string> = {
  folder: "Folder",
  pdf: "PDF document",
  doc: "Document",
  sheet: "Spreadsheet",
  slides: "Presentation",
  image: "Image",
  audio: "Audio",
  video: "Video",
  archive: "Archive",
  code: "Code",
  text: "Text",
  other: "File",
};

const EXT_FAMILY: Record<string, FileFamily> = {
  pdf: "pdf",
  doc: "doc", docx: "doc", odt: "doc", rtf: "doc", pages: "doc",
  xls: "sheet", xlsx: "sheet", ods: "sheet", csv: "sheet", numbers: "sheet",
  ppt: "slides", pptx: "slides", odp: "slides", key: "slides",
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", avif: "image", svg: "image", heic: "image", tif: "image", tiff: "image",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", flac: "audio", aac: "audio",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video", m4v: "video",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  js: "code", ts: "code", tsx: "code", json: "code", html: "code", css: "code", py: "code", sql: "code",
  txt: "text", md: "text", excalidraw: "text",
};

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function familyOf(entry: { name: string; mimeType?: string | null; isFolder?: boolean }): FileFamily {
  if (entry.isFolder) return "folder";
  const byExt = EXT_FAMILY[extOf(entry.name)];
  if (byExt) return byExt;
  const mime = entry.mimeType ?? "";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

export function familyName(f: FileFamily): string {
  return FAMILY_NAME[f];
}

/** The short badge text: the extension, or the family for an extensionless file. */
export function badgeOf(entry: { name: string; isFolder?: boolean }, family: FileFamily): string {
  if (entry.isFolder) return "";
  const ext = extOf(entry.name);
  return (ext || family).slice(0, 4).toUpperCase();
}

/** A document-shaped icon with the family's colour and a badge; folders are folders. */
export function FileIcon({
  family,
  badge,
  size = 40,
}: {
  family: FileFamily;
  badge?: string;
  size?: number;
}) {
  const color = FAMILY_COLOR[family];
  if (family === "folder") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="eac-hs-icon">
        <path d="M3 10a3 3 0 0 1 3-3h9l4 4h15a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill={color} />
        <path d="M3 15h34v16a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill={color} opacity=".82" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="eac-hs-icon">
      <path d="M9 2h15l9 9v25a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke={color} strokeWidth="1.6" />
      <path d="M24 2v7a2 2 0 0 0 2 2h7" fill="none" stroke={color} strokeWidth="1.6" />
      <Glyph family={family} color={color} />
      {badge ? (
        <>
          <rect x="3" y="24" width="30" height="11" rx="2" fill={color} />
          <text
            x="18"
            y="32.3"
            textAnchor="middle"
            fontSize={badge.length > 3 ? 7 : 8}
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fill="#fff"
            letterSpacing=".3"
          >
            {badge}
          </text>
        </>
      ) : null}
    </svg>
  );
}

/** A small mark in the page's upper half, so families differ by shape, not only colour. */
function Glyph({ family, color }: { family: FileFamily; color: string }) {
  switch (family) {
    case "doc":
    case "text":
    case "pdf":
      return (
        <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
          <line x1="12" y1="12" x2="21" y2="12" />
          <line x1="12" y1="16" x2="27" y2="16" />
          <line x1="12" y1="20" x2="24" y2="20" />
        </g>
      );
    case "sheet":
      return (
        <g stroke={color} strokeWidth="1.3" fill="none">
          <rect x="11" y="11" width="17" height="10" />
          <line x1="11" y1="16" x2="28" y2="16" />
          <line x1="17" y1="11" x2="17" y2="21" />
          <line x1="22.5" y1="11" x2="22.5" y2="21" />
        </g>
      );
    case "slides":
      return <rect x="11" y="11" width="17" height="10" rx="1" fill="none" stroke={color} strokeWidth="1.6" />;
    case "image":
      return (
        <g>
          <circle cx="15" cy="13" r="2" fill={color} />
          <path d="M11 21l5-5 3 3 3-4 5 6z" fill={color} />
        </g>
      );
    case "audio":
      return <path d="M16 20.5a2 2 0 1 1-1-1.7V11l9-2v9.5a2 2 0 1 1-1-1.7V12l-7 1.5z" fill={color} />;
    case "video":
      return <path d="M15 11l10 5-10 5z" fill={color} />;
    case "archive":
      return (
        <g fill={color}>
          <rect x="18" y="5" width="3" height="2" />
          <rect x="18" y="9" width="3" height="2" />
          <rect x="18" y="13" width="3" height="2" />
          <rect x="17" y="17" width="5" height="4" rx="1" />
        </g>
      );
    case "code":
      return (
        <g stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 12l-3.5 4 3.5 4" />
          <path d="M24 12l3.5 4-3.5 4" />
        </g>
      );
    default:
      return null;
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n < 10 && u > 0 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
}
