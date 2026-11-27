// Seeds experiments for the workspace screens (test accounts only), re-runnable. Usage (from packages/lms):
//   SEED_NAME=seed|throwaway npx tsx ../../apps/sophia/scripts/seed-experiment.mts
//   seed       "Quiet morning light": sunjay, private, the two test participants consent, a week of entries, A agrees to two entries,
//              B agrees to one and declines one, and a compiled DRAFT result (NOT published).
//   throwaway  "zz Test Experiment": the same shape, left for the publish / withdraw / takedown test.
import {
  agreeToParticipation, createWorkspace, decidePublication, enrol, getCourseBySlug, getRunBySlug, listOngoingSessions, listResultCandidates, listResults,
  requestPublication, saveIntervalEntry, saveOngoingSession, saveResultDraft,
} from "@elkdonis/lms";

const WHICH = process.env.SEED_NAME ?? "seed";
const TITLE = WHICH === "throwaway" ? "zz Test Experiment" : "Quiet morning light: a two week experiment";
const G = { userId: "bb77984c-0bdc-4e47-bb39-33dae6723794", roles: { sunjay: "guide" } };
const A = { userId: "e6bf54d9-ea1a-4549-b6d7-0df01f71d6f9", roles: {} };
const B = { userId: "7a75e3ce-02f0-4f6c-80d2-40dcaa979872", roles: {} };
const slugOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slug = slugOf(TITLE);
const say = (l: string, r: unknown) => console.log(l, typeof r === "string" ? r : JSON.stringify(r));

let course = await getCourseBySlug(slug);
if (!course) {
  const r = await createWorkspace(G, {
    orgId: "sunjay", title: TITLE, line: "Does a few minutes of quiet each morning change how the day feels? Two weeks, a short note each day.",
    when: "Mon 16 Nov", where: "Online", experiment: true, visibility: "private",
  });
  if (!r.ok) throw new Error(r.error);
  say("created", { slug: r.slug, courseId: r.courseId, runId: r.runId });
  course = await getCourseBySlug(slug);
}
const run = (await getRunBySlug(course!.id, "group"))!;
const ses = (await listOngoingSessions(run.id))[0];
// The test log started a week ago, so there are past days to write on.
say("log start moved to 2026-11-16", await saveOngoingSession(G, run.id, { ...ses, start: "2026-11-16" }));

for (const [who, v] of [["A", A], ["B", B]] as const) {
  say(`seat ${who}`, (await enrol({ userId: v.userId, roles: { sunjay: "guide" } }, run.id)).ok ? "ok" : "refused");
}
// Before consenting: an unconsented seat cannot write.
const pre = await saveIntervalEntry(A, slug, ses.moduleId, { body: "should not be kept", visibility: "circle", tz: "America/Toronto" }, new Date("2026-11-16T15:00:00Z"));
say("A writes BEFORE consenting (must refuse)", pre.ok ? "ACCEPTED (BAD)" : pre.error);
say("A agrees", await agreeToParticipation(A, slug));
say("B agrees", await agreeToParticipation(B, slug));

const put = async (label: string, v: typeof A, tz: string, iso: string, body: string, vis: "circle" | "guide" | "me" = "circle") => {
  const r = await saveIntervalEntry(v, slug, ses.moduleId, { body, visibility: vis, tz }, new Date(iso));
  say(label, r.ok ? `ok ${r.key}` : r.error);
};
await put("A 16", A, "America/Toronto", "2026-11-16T13:00:00Z", "Sat by the window at seven. The light came in low and orange. I felt unhurried for about an hour afterwards.");
await put("B 16", B, "Asia/Kolkata", "2026-11-16T02:30:00Z", "Five minutes on the balcony before the street woke up. Hard to stay with it; mind jumped to the day ahead.");
await put("A 17", A, "America/Toronto", "2026-11-17T12:30:00Z", "Cloudy, so no light to speak of. Sat anyway. Noticed I was more patient in the first meeting.");
await put("B 17", B, "Asia/Kolkata", "2026-11-17T01:45:00Z", "A quieter start. My phone stayed in the other room, which helped more than the sitting itself.");
await put("A 18", A, "America/Toronto", "2026-11-18T12:10:00Z", "Short one, three minutes. Still felt different from a morning without it.");
await put("B 18 (private to the guide)", B, "Asia/Kolkata", "2026-11-18T02:10:00Z", "Slept badly and sat anyway. Telling only the guide: I almost skipped it.", "guide");
await put("A 19", A, "America/Toronto", "2026-11-19T12:40:00Z", "Rain on the roof. Probably the best sit so far.");
await put("B 20", B, "Asia/Kolkata", "2026-11-20T03:00:00Z", "Noticed my shoulders dropping about two minutes in. New for me.");

const cands = (await listResultCandidates(G, slug)) ?? [];
say("candidates (shared entries of consenting people; the guide-only one must be absent)", cands.map((c) => `${c.writer.split(" ")[2] ?? c.writer}:${c.body.slice(0, 22)}`));
const res = await saveResultDraft(G, slug, { title: "What two weeks of quiet mornings did", intro: "Two people took five quiet minutes every morning for a week and wrote down what they noticed. These are the entries they agreed to share.", conclusion: "Too small to prove anything. Enough to suggest the second minute matters more than the fifth.", audience: "members" });
if (!res.ok) throw new Error(res.error);
const pick = cands.filter((c) => /window|rain|shoulders|balcony/i.test(c.body)).map((c) => c.responseId);
say("ask the writers about 4 entries", await requestPublication(G, slug, res.id, pick));
const [draft] = (await listResults(G, slug)) ?? [];
const mine = (who: "A" | "B") => draft.items.filter((i) => i.writer.includes(who === "A" ? "Participant (test)" : "Two"));
// A agrees to both of hers (one named, one anonymous); B agrees to one and declines one.
const { listMyPublicationRequests } = await import("@elkdonis/lms");
const aReq = await listMyPublicationRequests(A, slug), bReq = await listMyPublicationRequests(B, slug);
say("A's requests", aReq.map((r) => r.state));
say("A agrees (named)", await decidePublication(A, slug, aReq[0].itemId, "agree", "named"));
if (aReq[1]) say("A agrees (anonymous)", await decidePublication(A, slug, aReq[1].itemId, "agree", "anonymous"));
say("B agrees to one", await decidePublication(B, slug, bReq[0].itemId, "agree", "anonymous"));
if (bReq[1]) say("B declines the other", await decidePublication(B, slug, bReq[1].itemId, "decline"));
void mine;
const after = ((await listResults(G, slug)) ?? [])[0];
say("result draft", { id: after.id, status: after.status, items: after.items.map((i) => `${i.state}${i.credit ? "/" + i.credit : ""}`) });
console.log(JSON.stringify({ slug, courseId: course!.id, runId: run.id, resultId: after.id }));
process.exit(0);
