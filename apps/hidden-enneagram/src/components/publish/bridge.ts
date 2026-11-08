// The Studio, framed in the popup (studio-surface.tsx), tells the page under it
// what happened. Same origin only: the message is posted to this origin and the
// surface checks both the origin and that it came from its own frame.

export const STUDIO_MESSAGE = "he-studio";

export type StudioMessage =
  | { source: typeof STUDIO_MESSAGE; type: "published"; kind: string; id: string; href: string | null }
  | { source: typeof STUDIO_MESSAGE; type: "saved"; kind: string; id: string }
  | { source: typeof STUDIO_MESSAGE; type: "close" };

type Payload =
  | { type: "published"; kind: string; id: string; href: string | null }
  | { type: "saved"; kind: string; id: string }
  | { type: "close" };

/** True when this page is the popup's frame (not opened full screen). */
export function isFramed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window && window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function tellHost(msg: Payload) {
  if (!isFramed()) return;
  window.parent.postMessage({ source: STUDIO_MESSAGE, ...msg }, window.location.origin);
}

export function isStudioMessage(data: unknown): data is StudioMessage {
  return Boolean(data && typeof data === "object" && (data as { source?: unknown }).source === STUDIO_MESSAGE);
}
