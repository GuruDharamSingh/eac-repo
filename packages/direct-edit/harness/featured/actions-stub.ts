// Stand-in for apps/elktours/src/lib/featured-person-actions.ts in the harness: fixtures shaped like the
// service's answers (probe.mts output, 2026-11-06), and a count of each call.
const g = globalThis as any;
g.__calls = { sources: 0, choices: 0, who: 0 };
const DANA = "user:4eebc495-1db6-4b1e-a5b3-399326c78fe6", GURU = "user:fbf699b9-c708-440a-9abd-40f8953978e5", PRIV = "user:00000000-0000-4000-8000-000000000001";
const TOUR = "thread:elkNapol001tour000003";
const WHO: Record<string, unknown> = {
  [DANA]: { displayName: "Dana McCool", roleTitle: "Guide", bio: "Lives in the Marais.\n\nSecond paragraph.", photoUrl: "/p/dana.png", href: "/about/dana-mccool", via: null },
  [GURU]: { displayName: "Guru Dharam Singh", roleTitle: null, bio: null, photoUrl: null, href: null, via: null },
  [`${TOUR}:author`]: { displayName: "Dana McCool", roleTitle: "Guide", bio: null, photoUrl: "/p/dana.png", href: "/about/dana-mccool", via: { label: "author", at: null, thread: "L'héritage de Napoléon Bonaparte" } },
};
export async function personSourcesAction() {
  g.__calls.sources++;
  return [{ ref: "org", label: "People of this site", hint: "Anyone with a public profile here" }, { ref: TOUR, label: "L'héritage de Napoléon Bonaparte", hint: "tour" }, { ref: "thread:other", label: "Montmartre at dusk", hint: "tour" }];
}
export async function personChoicesAction(source: string) {
  g.__calls.choices++;
  if (source === "org") return [{ value: DANA, label: "Dana McCool", hint: "Guide" }, { value: GURU, label: "Guru Dharam Singh" }];
  if (source === TOUR) return [
    { value: `${TOUR}:author`, label: "Its author", follows: true, hint: "Now: Dana McCool" },
    { value: DANA, label: "Dana McCool", hint: "author" },
    { value: PRIV, label: "A guide", hint: "No public profile on this site", disabled: true },
  ];
  return [];
}
export async function personWhoAction(ref: string) {
  g.__calls.who++;
  await new Promise((r) => setTimeout(r, 60));
  return (WHO[ref] as any) ?? null;
}
// Opens and a Card's record (2026-11-06), shaped like lib/opens-server.ts answers.
export async function opensSourcesAction(binds: string) {
  g.__calls.sources++;
  return binds === "record" ? [{ ref: "tour", label: "A tour" }] : [{ ref: "page", label: "A page of this site" }, { ref: "reviews", label: "Popup: reviews" }, { ref: "person", label: "Popup: a person" }];
}
export async function opensChoicesAction(binds: string, source: string) {
  g.__calls.choices++;
  if (binds === "record") return [{ value: `${TOUR}`, label: "L'héritage de Napoléon Bonaparte" }];
  if (source === "reviews") return [
    { value: `popup:reviews:tour:elkNapol001tour000003`, label: "Reviews of L'héritage" },
    { value: `popup:reviews:tour:elkNapol001tour000003>page:/tours/heritage`, label: "Reviews of L'héritage, then its page" },
  ];
  if (source === "page") return [{ value: "page:/tours", label: "All tours" }];
  return [];
}
export async function opensDrawAction(binds: string, value: string) {
  g.__calls.who++;
  if (binds === "opens" && value.startsWith("popup:reviews:tour:elkNapol001tour000003")) {
    const then = value.includes(">") ? { href: "/tours/heritage", label: "See the tour and book" } : null;
    return { opened: { href: "/tours/heritage", label: `Popup: reviews of L'héritage${then ? ", then see the tour and book" : ""}`, popup: { key: "reviews", title: "Reviews of L'héritage", props: { type: "tour", id: "elkNapol001tour000003", then } } } };
  }
  if (binds === "opens" && value === "page:/tours") return { opened: { href: "/tours", label: "/tours" } };
  return null;
}
