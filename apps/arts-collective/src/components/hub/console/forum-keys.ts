/** Surface keys for the forum card. A plain module so server and client read the same values. */
export const FORUM_SURFACES = {
  /** "Across your organisations": the old cross-org board, as a layer of the forum card. */
  across: "console-forum-across",
} as const;

/**
 * The thread kinds that carry a reply panel in the thread frame (a forum topic's kinds). Anything else the
 * console opens (a questionnaire, a poll, a service) is drawn exactly as before. To keep replies off events,
 * remove "event" here.
 */
export const FORUM_REPLY_KINDS: ReadonlySet<string> = new Set(["post", "idea", "event"]);
