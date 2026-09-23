import type { SurfaceDescriptor, SurfaceProfileTab } from "./types";

// ============================================================================
// A surface in the address bar.
//
// `?surface=thread:GXsQ…` is what makes a popup shareable and what makes the
// browser's Back button close it. Only descriptors that are pure data
// serialise; a calendar carrying pre-loaded events or a compose carrying a
// prefill drops those parts and still reopens to the right place.
// ============================================================================

export const SURFACE_PARAM = "surface";

/** A post destination: `blog` or `orgId|feedSlug`. */
const SAFE_TARGET = /^(blog|[a-z0-9_-]{1,50}\|[a-z0-9_-]{1,50})$/i;

/** `profile:<tab>` — "profile" itself is the bare form. */
const PROFILE_TABS = new Set<string>(["details", "show", "page", "payouts"]);

export function serializeDescriptor(d: SurfaceDescriptor): string | null {
  switch (d.type) {
    case "thread":
      return `thread:${d.id}`;
    case "calendar":
      if (d.day) return `calendar:${d.day}`;
      if (d.month) return `calendar:${d.month}`;
      return "calendar";
    case "compose":
      if (d.threadId) return `compose:${d.kind ?? ""}:${d.threadId}`;
      return d.kind ? `compose:${d.kind}` : "compose";
    case "gallery":
      return "gallery";
    case "documents":
      // The seeded list and draft title are dropped, as the calendar's events
      // and compose's prefill are: the popup reopens to the right place and
      // fetches for itself.
      return "documents";
    case "identities":
      return "identities";
    case "write":
      return d.threadId ? `write:post:${d.threadId}` : "write:post";
    case "board":
      return "board";
    case "boardCard":
      return `boardCard:${d.cardId}`;
    case "forum":
      return "forum";
    case "forumFeed":
      // Not URL-addressable: the descriptor carries the section's NAME and
      // its href as well as the slug, and a round trip through the URL could
      // only restore the slug. Serialising it would write a link that opens
      // a panel with no title. The section is one click from the forum
      // surface, which IS addressable.
      return null;
    case "profile":
      if (d.target) return `profile:org:${d.target.orgId}`;
      if (d.tab && d.tab !== "profile") return `profile:${d.tab}`;
      return d.mode === "edit" ? "profile:edit" : "profile";
    case "define":
      // Encoded: a term may hold spaces, punctuation, even a colon, and the
      // format is colon-separated.
      return `define:${encodeURIComponent(d.term)}${d.sourceThreadId ? `:${d.sourceThreadId}` : ""}`;
    case "centerLayout":
      return `centerLayout:${d.orgId}`;
    case "material":
      // A file is not an address. Its URL may be signed, may be a one-off,
      // and reopening it out of context would restore a document with no
      // meeting around it — so this layer is deliberately not shareable.
      return null;
    case "gather":
      // Addressable, and deliberately so: "here is what we gathered, help me
      // arrange it" is a link worth being able to send. The title is dropped
      // and refetched with the thread, like every other seeded preview here.
      return `gather:${d.threadId}`;
    case "postTo":
      // The destination may be in the address; what was typed never is.
      return d.target && SAFE_TARGET.test(d.target) ? `postTo:${encodeURIComponent(d.target)}` : "postTo";
    case "custom":
      return null;
  }
}

/** A term out of the address bar: decoded, trimmed, and length-capped. */
function decodeTerm(raw: string | undefined): string | null {
  if (!raw) return null;
  let term: string;
  try {
    term = decodeURIComponent(raw);
  } catch {
    return null;
  }
  term = term.replace(/\s+/g, " ").trim();
  return term && term.length <= 120 ? term : null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const SAFE = /^[A-Za-z0-9_-]+$/;

export function parseDescriptor(value: string | null | undefined): SurfaceDescriptor | null {
  if (!value) return null;
  const [type, a, b] = value.split(":");
  switch (type) {
    case "thread":
      return a && SAFE.test(a) ? { type: "thread", id: a } : null;
    case "calendar":
      if (!a) return { type: "calendar" };
      if (DAY.test(a)) return { type: "calendar", day: a, month: a.slice(0, 7) };
      if (MONTH.test(a)) return { type: "calendar", month: a };
      return null;
    case "compose":
      if (b && SAFE.test(b)) return { type: "compose", kind: a || undefined, threadId: b };
      return { type: "compose", kind: a && SAFE.test(a) ? a : undefined };
    case "gallery":
      return { type: "gallery" };
    case "documents":
      return { type: "documents" };
    case "identities":
      return { type: "identities" };
    case "write":
      return { type: "write", kind: "post", threadId: b && SAFE.test(b) ? b : undefined };
    case "board":
      return { type: "board" };
    case "gather":
      return a && SAFE.test(a) ? { type: "gather", threadId: a } : null;
    case "boardCard":
      return a && SAFE.test(a) ? { type: "boardCard", cardId: a } : null;
    case "forum":
      return { type: "forum" };
    case "profile":
      if (a === "org" && b && SAFE.test(b)) return { type: "profile", target: { kind: "org", orgId: b } };
      if (a && PROFILE_TABS.has(a)) return { type: "profile", tab: a as SurfaceProfileTab };
      return { type: "profile", mode: a === "edit" ? "edit" : undefined };
    case "centerLayout":
      return a && SAFE.test(a) ? { type: "centerLayout", orgId: a } : null;
    case "postTo": {
      let target: string | undefined;
      try {
        target = a ? decodeURIComponent(a) : undefined;
      } catch {
        target = undefined;
      }
      return { type: "postTo", target: target && SAFE_TARGET.test(target) ? target : undefined };
    }
    case "define": {
      // Bounded: this arrives from the address bar, so it is somebody's input.
      const term = decodeTerm(a);
      if (!term) return null;
      return { type: "define", term, sourceThreadId: b && SAFE.test(b) ? b : undefined };
    }
    default:
      return null;
  }
}

export function urlWithSurface(value: string | null): string {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(SURFACE_PARAM, value);
  else url.searchParams.delete(SURFACE_PARAM);
  return url.pathname + url.search + url.hash;
}

export function readSurfaceParam(): string | null {
  return new URL(window.location.href).searchParams.get(SURFACE_PARAM);
}
