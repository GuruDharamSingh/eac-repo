import { parse } from "node-html-parser";

// ============================================================================
// Cards that stay pointed at a thread.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// The "Thread card" block was inert placeholder markup: drop it and you get
// "The title of the thing", "workshop · Your Organization" and a link to
// example.org, all of which you retype by hand. Nothing connected it to
// anything, so there was no way to tell whether a card pointed at the thread
// you meant — and a missed href shipped a newsletter linking to example.org.
//
// ── The reference ───────────────────────────────────────────────────────────
//
// A card carries `data-eac-thread="<id>"` on its root, and each field inside
// carries `data-eac-thread-field="title|kind|when|where|summary|url"`. That is
// the same shape the dossier template uses — a marked region with marked slots
// — and it means the card's DESIGN stays in the block, editable by the author,
// while only its VALUES are resolved.
//
// Resolution happens at SEND, not at insert: a letter composed on Monday and
// sent on Friday should carry Friday's time. The author sees what it is linked
// to while composing; the recipient gets what was true when it went out.
//
// Parsed, never regexed. A card is a table of nested tables, which is exactly
// the shape a regex gets wrong — the same reason the template binding engine
// parses.
// ============================================================================

export const THREAD_ATTR = "data-eac-thread";
export const FIELD_ATTR = "data-eac-thread-field";
/** Shown as the editor's "linked to" badge. Display only; never rendered. */
export const LABEL_ATTR = "data-eac-thread-label";

const PARSE_OPTIONS = {
  blockTextElements: { script: true, noscript: true, style: true, pre: true },
} as const;

/** What a card can show. Everything the block's six lines need. */
export interface ThreadCardData {
  id: string;
  title: string;
  kind?: string | null;
  /** Already formatted for reading — the letter states one time, not a zone. */
  when?: string | null;
  where?: string | null;
  summary?: string | null;
  url?: string | null;
  /** For the picker's own list and the editor badge. */
  orgName?: string | null;
  /** Writing shape: the cover image, when the thread has one. */
  coverUrl?: string | null;
  /** Writing shape: when it was published, already formatted. */
  published?: string | null;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

/** Every thread id referenced by a letter, in document order, deduplicated. */
export function referencedThreadIds(html: string): string[] {
  if (!html) return [];
  const root = parse(html, PARSE_OPTIONS);
  const ids: string[] = [];
  for (const el of root.querySelectorAll(`[${THREAD_ATTR}]`)) {
    const id = el.getAttribute(THREAD_ATTR);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export interface ResolveResult {
  html: string;
  /**
   * Cards whose thread could not be resolved — unpublished, deleted, or moved
   * to another org.
   *
   * Returned rather than thrown, and rather than silently left as-is: the
   * caller decides. A test send should show them; a real send should stop and
   * ask, because "the workshop you linked was taken down" is something the
   * author can fix in a minute and cannot fix once it is in inboxes.
   */
  missing: { id: string; label: string | null }[];
}

/**
 * Fill every linked card from live thread data.
 *
 * A field with no value is emptied rather than left showing the block's
 * placeholder, so a thread with no summary renders a card without a summary
 * line instead of one that says "One line about what it is."
 */
export function resolveThreadCards(
  html: string,
  threads: Map<string, ThreadCardData>
): ResolveResult {
  const missing: ResolveResult["missing"] = [];
  if (!html) return { html, missing };

  const root = parse(html, PARSE_OPTIONS);
  const cards = root.querySelectorAll(`[${THREAD_ATTR}]`);
  if (cards.length === 0) return { html, missing };

  for (const card of cards) {
    const id = card.getAttribute(THREAD_ATTR);
    if (!id) continue;

    const thread = threads.get(id);
    if (!thread) {
      const label = card.getAttribute(LABEL_ATTR);
      if (!missing.some((m) => m.id === id)) missing.push({ id, label: label ?? null });
      continue;
    }

    for (const slot of card.querySelectorAll(`[${FIELD_ATTR}]`)) {
      const field = slot.getAttribute(FIELD_ATTR);
      switch (field) {
        case "title":
          slot.set_content(esc(thread.title));
          break;
        case "kind":
          slot.set_content(
            esc([thread.kind, thread.orgName].filter(Boolean).join(" · "))
          );
          break;
        case "when":
          slot.set_content(esc(thread.when ?? ""));
          break;
        case "where":
          slot.set_content(esc(thread.where ?? ""));
          break;
        case "summary":
          slot.set_content(esc(thread.summary ?? ""));
          break;
        case "date":
          slot.set_content(esc(thread.published ?? thread.when ?? ""));
          break;
        case "cover":
          // A card whose thread lost its cover should lose the image, not
          // render a broken-image icon in somebody's inbox.
          if (thread.coverUrl) slot.setAttribute("src", thread.coverUrl);
          else slot.remove();
          break;
        case "url":
          // Both, because the block's link shows its own target as the text in
          // some layouts and a fixed phrase in others. Setting href is the part
          // that matters; the text is only replaced when it was a placeholder
          // URL, so an author's own wording survives.
          if (thread.url) {
            slot.setAttribute("href", thread.url);
            const text = slot.text.trim();
            if (/^https?:\/\//i.test(text) || text === "") {
              slot.set_content(esc(thread.url.replace(/^https?:\/\//i, "")));
            }
          }
          break;
        default:
          break;
      }
    }

    // The badge is for the editor only. Strip it so it never reaches an inbox.
    card.removeAttribute(LABEL_ATTR);
  }

  return { html: root.toString(), missing };
}

/**
 * Placeholders an author has not replaced.
 *
 * Separate from the linked-card check because they are a different mistake:
 * a card that was never linked still carries the block's demo copy and its
 * example.org link, and that is the thing that actually gets sent by accident.
 */
export function unresolvedPlaceholders(html: string): string[] {
  if (!html) return [];
  const found: string[] = [];
  if (/example\.org/i.test(html)) found.push("a link still points at example.org");
  if (/The title of the thing/i.test(html)) found.push("a thread card still says “The title of the thing”");
  if (/One line about what it is/i.test(html)) found.push("a thread card still has its placeholder summary");
  if (/Write here\. Keep it to what a person/i.test(html)) found.push("a paragraph still has its placeholder text");
  if (/Their Name|@handle|them@example\.com/.test(html)) found.push("a profile card still has placeholder details");
  // The placeholder pictures are real files on purpose — a 404 would render as
  // a broken-image icon, which an author cannot tell apart from a picture that
  // failed to load. Being real means they also SEND, so they have to be caught.
  if (/email\/(avatar-)?placeholder\.png/i.test(html)) {
    found.push("a picture is still the placeholder");
  }
  if (/Nothing linked yet|Pick something to feature/i.test(html)) {
    found.push("a card was never linked to anything");
  }
  if (/Letter N&ordm; 4|What we are working on this season/i.test(html)) {
    found.push("the masthead still has its example wording");
  }
  if (/Come and sit with us|Take a place/i.test(html)) {
    found.push("the ask panel still has its example wording");
  }
  if (/The work is not to become someone else/i.test(html)) {
    found.push("the quote still has its example text");
  }
  if (/&mdash; Their Name|— Their Name/.test(html)) {
    found.push("the sign-off is unsigned");
  }
  return found;
}
