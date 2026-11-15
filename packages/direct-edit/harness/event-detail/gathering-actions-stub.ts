// Stand-in for apps/sunjay/src/lib/puck/gathering-actions.ts in the harness (2026-11-14). Aliased in by run.sh's ALIAS.
const g = globalThis as any;
g.__gatherCalls = { sources: 0, choices: 0, draw: 0 };
const ev = (id: string, title: string, recurrencePattern: string | null) => ({
  id, title, slug: id, kind: "meeting", feedSlug: "gatherings", excerpt: `${title}, in short.`, description: null, location: null,
  isOnline: true, meetingUrl: null, coverImageUrl: null, scheduledAt: "2026-11-18T23:30:00.000Z", recurrencePattern, isRsvpEnabled: true, durationMinutes: 90,
});
const STANDING = { event: ev("lab", "Ritual Theatre Lab", "WEEKLY"), at: "2026-11-18T23:30:00.000Z", source: "weekly" };
const NEXT = { event: ev("open-eve", "Open Evening", null), at: "2026-11-15T23:00:00.000Z", source: "next" };
const ONE = { event: ev("winter-rite", "Winter Rite", null), at: "2026-12-21T22:00:00.000Z", source: "flagged" };

export async function gatheringSourcesAction() {
  g.__gatherCalls.sources++;
  return [
    { ref: "follows", label: "Follows the calendar", hint: "the standing meeting, or whatever is next" },
    { ref: "gatherings", label: "This site's gatherings", hint: "3 coming up" },
  ];
}
export async function gatheringChoicesAction(source: string) {
  g.__gatherCalls.choices++;
  if (source === "follows") return [
    { value: "standing", label: "The standing meeting", follows: true, hint: "Now: Ritual Theatre Lab, Wed, Nov 18" },
    { value: "next", label: "The next upcoming gathering", follows: true, hint: "Now: Open Evening, Sun, Nov 15" },
  ];
  if (source === "gatherings") return [
    { value: "thread:open-eve", label: "Open Evening", hint: "next Sun, Nov 15" },
    { value: "thread:lab", label: "Ritual Theatre Lab", hint: "next Wed, Nov 18 · weekly" },
    { value: "thread:winter-rite", label: "Winter Rite", hint: "next Mon, Dec 21" },
  ];
  return [];
}
export async function gatheringDrawAction(value: string) {
  g.__gatherCalls.draw++;
  await new Promise((r) => setTimeout(r, 40));
  const s = value === "next" ? NEXT : value === "thread:winter-rite" ? ONE : value === "thread:open-eve" ? { ...NEXT, source: "flagged" } : STANDING;
  return { standing: s, canEdit: true };
}
