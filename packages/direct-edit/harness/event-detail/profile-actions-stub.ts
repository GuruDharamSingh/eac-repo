// Stand-in for apps/sunjay/src/lib/puck/profile-actions.ts in the harness (2026-11-14). Aliased in by run.sh's ALIAS.
const g = globalThis as any;
g.__guideCalls = { sources: 0, choices: 0, draw: 0 };
const guide = (userId: string, slug: string, displayName: string, roleTitle: string | null) =>
  ({ userId, slug, displayName, roleTitle, bio: `${displayName}'s bio.`, photoUrl: null, city: null, socialLinks: [], sortOrder: 0 });
const JASON = guide("u-jason", "jason-ford", "Jason Ford aka sunjye", "Teacher");
const GURU = guide("u-guru", "jg", "Guru Dharam Singh", null);
const links = [{ label: "Elkdonis Arts", url: "https://elkdonis-arts.org", emphasis: true }];

export async function guideSourcesAction() {
  g.__guideCalls.sources++;
  return [
    { ref: "site", label: "The site's guide", hint: "Now: Jason Ford aka sunjye" },
    { ref: "org", label: "People of this site", hint: "Anyone with a public profile here" },
    { ref: "thread:lab", label: "Ritual Theatre Lab", hint: "gathering" },
  ];
}
export async function guideChoicesAction(source: string) {
  g.__guideCalls.choices++;
  if (source === "site") return [{ value: "", label: "The site's guide", follows: true, hint: "Now: Jason Ford aka sunjye, an owner of this organisation" }];
  if (source === "org") return [{ value: "user:u-jason", label: JASON.displayName }, { value: "user:u-guru", label: GURU.displayName }];
  if (source === "thread:lab") return [{ value: "thread:lab:author", label: "Its author", follows: true, hint: "Now: Jason Ford aka sunjye" }];
  return [];
}
export async function guideDrawAction(value: string) {
  g.__guideCalls.draw++;
  await new Promise((r) => setTimeout(r, 40));
  const who = value === "user:u-guru" ? GURU : value === "" || value === "user:u-jason" || value === "thread:lab:author" ? JASON : null;
  return { guide: who, links: who ? links : [] };
}
