// Stand-in for apps/sunjay/src/lib/puck/service-actions.ts in the harness (2026-11-14): fixtures shaped like the
// actions' answers, and a count of each call. Aliased in by run.sh's ALIAS.
const g = globalThis as any;
g.__svcCalls = { sources: 0, choices: 0, draw: 0 };

const svc = (slug: string, title: string, priceLabel: string | null, extra: Record<string, unknown> = {}) => ({
  id: `svc-${slug}`, slug, title, subtitle: null, summary: `${title}, in short.`, bodyHtml: `<p>${title} in full.</p>`,
  bookingType: "group", format: "online", priceLabel, price: priceLabel ? 60 : null, currency: "CAD", priceSlidingMin: null,
  slidingScaleNote: null, registrationStatus: "open", sessionCount: 4, sessionDurationHrs: 2, recurrenceLabel: null,
  location: null, coverImageUrl: null, ...extra,
});
const VOICE = svc("voice-and-breath", "Voice and Breath", "CA$60");
const MASKS = svc("mask-work", "Mask Work Intensive", "CA$240", { registrationStatus: "waitlist" });
const ALL: Record<string, any> = { [VOICE.slug]: VOICE, [MASKS.slug]: MASKS };

export async function serviceSourcesAction() {
  g.__svcCalls.sources++;
  return [{ ref: "services", label: "This site's services", hint: "2 offered" }];
}
export async function serviceChoicesAction(source: string) {
  g.__svcCalls.choices++;
  if (source !== "services") return [];
  return [
    { value: VOICE.slug, label: VOICE.title, hint: "CA$60" },
    { value: MASKS.slug, label: MASKS.title, hint: "CA$240 · waitlist" },
  ];
}
export async function serviceDrawAction(slug: string) {
  g.__svcCalls.draw++;
  await new Promise((r) => setTimeout(r, 40));
  const s = ALL[slug];
  if (!s) return null;
  return { chosen: s, booking: { service: s, unavailable: null, inquiry: false, defaultName: null, defaultEmail: null } };
}
