import { stripResolvedKeys } from "@elkdonis/blocks/record";

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
  // Shared blocks this site resolves (2026-11-07).
  "featured-person": ["who", "opened"],
  "link-button": ["opened"],
  "feature-card": ["bound", "opened"],
};

/**
 * Copy of a Puck document with every resolver-filled prop removed. The shared walker since 2026-11-07
 * (`@elkdonis/blocks/record`, docs/reference/record-blocks.md); it also keeps a stored `__proto__` key as data.
 */
export function stripResolved<T>(data: T): T {
  return stripResolvedKeys(data, RESOLVED_KEYS);
}
