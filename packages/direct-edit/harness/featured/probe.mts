// Read-only probe of @elkdonis/services/featured-people against the live database (2026-11-06).
import { listPersonSources, listPersonChoices, resolveFeaturedPerson, parsePersonRef } from "../../../services/src/featured-people.ts";
const org = process.argv[2] ?? "elktours";
const sources = await listPersonSources(org);
console.log("sources", sources.length, sources.slice(0, 4));
console.log("org choices", await listPersonChoices(org, "org"));
const t = sources.find((s) => s.ref.startsWith("thread:"));
if (t) {
  const ch = await listPersonChoices(org, t.ref);
  console.log("thread choices", t.label, ch);
  for (const c of ch.slice(0, 4)) console.log(c.value, "->", (await resolveFeaturedPerson(org, c.value))?.displayName ?? null);
}
console.log("bad refs", [parsePersonRef("user:x"), parsePersonRef("thread:a:b"), parsePersonRef("thread:abc:author")]);
console.log("other org thread", await resolveFeaturedPerson("sunjay", t ? `${t.ref}:author` : ""));
process.exit(0);
