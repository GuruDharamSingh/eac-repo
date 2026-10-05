// ============================================================================
// Which props each data block's resolver fills in.
//
// Pure data, so both the editor config and the save action can read it. The
// save action removes these keys before a page is stored: the editor's
// resolvers ran as the signed-in editor and their rows (a forum snapshot with
// that person's unread count, say) are not page content. The published page
// runs `resolveAllData` and fetches them again on every request.
// ============================================================================

export const RESOLVED_KEYS: Record<string, readonly string[]> = {
  "pt-standing": ["standing", "canEdit"],
  "pt-calendar": ["events"],
  "pt-profile": ["guide", "links"],
  "pt-threads": ["threads", "feedName"],
  "pt-member": ["me", "orgName"],
  "pt-forum": ["forum"],
  "pt-writing": ["items"],
  "pt-gallery": ["images"],
  "pt-event-header": ["event"],
  "pt-event-about": ["event"],
  "pt-talk-room": ["event"],
  "pt-event-rsvp": ["event"],
  "pt-event-materials": ["event"],
  "pt-offering-card": ["event"],
  "pt-services": ["services"],
  "pt-service": ["chosen"],
  "pt-booking": ["booking"],
  "pt-journal": ["items"],
  "pt-article": ["post"],
  "pt-series-nav": ["items", "series", "current"],
};

type Node = { type?: unknown; props?: Record<string, unknown> };

/** Copy of a Puck document with every resolver-filled prop removed. */
export function stripResolved<T>(data: T): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const node = value as Node;
    if (typeof node.type === "string" && node.props && typeof node.props === "object") {
      const drop = new Set(RESOLVED_KEYS[node.type] ?? []);
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node.props)) {
        if (!drop.has(k)) props[k] = walk(v);
      }
      return { ...node, props };
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
  };
  return walk(data) as T;
}
