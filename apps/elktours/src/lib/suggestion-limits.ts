// Shared by lib/suggestion-actions.ts and lib/suggest-lead-actions.ts. A plain module, because a
// "use server" file may only export async functions.

/** Suggestions per person per rolling 24 hours, all kinds together. */
export const DAILY_LIMIT = 10;
