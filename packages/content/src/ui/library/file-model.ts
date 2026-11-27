// The file as a content item, and back. A folder listing carries no key into the index (CONTRACT §1),
// so a listed file gets `file:<source>:<path>`; a file the search returns brings its own key.

import type { ContentListItem, ContentType } from "../../model";
import { kindOf, type FolderItem } from "./file-utils";
import type { FileLike } from "./file-tiles";

/** What a MediaLibrary pick reports: the file, and where it was found. */
export interface MediaLibraryFile {
  url: string;
  name: string;
  /** The source's key ("upload" for a file just uploaded, "drop" for a tile dropped from elsewhere). */
  source: string;
  /** The file's path within that source. */
  path: string;
  mimeType?: string | null;
  size?: number;
}

const TYPE_OF_KIND: Record<ReturnType<typeof kindOf>, ContentType> = { image: "image", video: "video", audio: "audio", document: "document", other: "file" };

/** A folder-listing entry (or an upload, or a drop) as a content item. `where` is its source key and path within it. */
export function fileToListItem(
  f: { name: string; url: string; thumb?: string; mimeType?: string | null; size?: number; lastModified?: string | null },
  where: { source: string; path: string; sourceLabel: string }
): ContentListItem {
  const type = TYPE_OF_KIND[kindOf(f)];
  const slash = where.path.lastIndexOf("/");
  return {
    key: `file:${where.source}:${where.path || f.url}`,
    type,
    title: f.name,
    meta: "",
    excerpt: "",
    cover: type === "image" ? f.thumb ?? f.url : f.thumb ?? null,
    status: "published",
    siteIdentityId: where.source,
    siteName: where.sourceLabel,
    siteHost: null,
    ownerIdentityId: null,
    series: null,
    createdAt: f.lastModified ?? "",
    date: f.lastModified ?? null,
    marks: [],
    note: null,
    timeline: [],
    links: { public: f.url, studio: null },
    store: "file",
    file: { source: where.source, path: where.path, mime: f.mimeType ?? null, size: typeof f.size === "number" ? f.size : null, folder: slash > 0 ? where.path.slice(0, slash) : "" },
  };
}

export function folderItemToListItem(item: FolderItem, where: { source: string; path: string; sourceLabel: string }): ContentListItem {
  return fileToListItem({ ...item, url: item.url! }, where);
}

/** The value MediaLibrary's callers have always received. */
export function listItemToMediaFile(item: ContentListItem): MediaLibraryFile {
  const file = item.file;
  const out: MediaLibraryFile = {
    url: item.links.public ?? item.cover ?? "",
    name: item.title,
    source: file?.source ?? "drop",
    path: file?.path ?? "",
  };
  // A tile dropped from another library reported no type and no size.
  if (file?.source === "drop") return out;
  out.mimeType = file?.mime ?? null;
  out.size = typeof file?.size === "number" ? file.size : undefined;
  return out;
}

/** A search-index file item as the tile components draw it. */
export function listItemToFileLike(item: ContentListItem): FileLike {
  return {
    name: item.title,
    url: item.links.public ?? item.cover ?? undefined,
    thumb: item.cover ?? undefined,
    mimeType: item.file?.mime ?? null,
    size: item.file?.size ?? undefined,
    path: item.file?.path ?? item.key,
    lastModified: item.date,
  };
}
