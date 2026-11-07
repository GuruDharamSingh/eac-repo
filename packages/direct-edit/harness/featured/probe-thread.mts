// Read-only: choices and following references for one thread (2026-11-06).
import { listPersonChoices, resolveFeaturedPerson } from "../../../services/src/featured-people.ts";
const [org, id] = process.argv.slice(2);
const ch = await listPersonChoices(org, `thread:${id}`);
console.log(ch);
for (const f of ["author", "next-host", "next-guide"]) console.log(f, await resolveFeaturedPerson(org, `thread:${id}:${f}`));
process.exit(0);
