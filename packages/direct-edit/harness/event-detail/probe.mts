// Read-only (2026-11-14, editing landscape round 1): Para Theater's stored pages against the live database, signed out.
// 1. Which stored documents hold the 13 blocks that gained parts, and whether any of them carries a look (`morph`).
// 2. Each stored page rendered as a visitor gets it, with today's block definitions and again with their parts
//    removed: the two must be byte-identical (parts change nothing a visitor is sent unless a look is stored).
// 3. The loaders behind "From what?" for a service: the site's services, and a chosen slug's drawing.
// Bundled by bundle-probe.cjs inside the sunjay container: no writes, no network beyond Postgres.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render, resolveAllData } from "@puckeditor/core";
import { buildPuckConfig } from "@elkdonis/page-builder/config";
import { BOX_BLOCKS } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { getServiceOffering, getStandingMeeting, listServiceOfferings } from "@elkdonis/services";
import { pickStanding, upcomingGatherings, whichOf } from "@/lib/puck/data-standing";
import { loadProfileFor, siteGuide } from "@/lib/puck/data-profile";
import { getAllThreadsForOrg, getGuideBySlug, getGuides } from "@/lib/data";
import { loadPost } from "@/lib/puck/data-post";
import { POST_DETAIL_TEMPLATE } from "@/lib/puck/templates";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
// Template nodes carry no ids; a stored document does.
function withIds(n: { type: string; props: Record<string, unknown> }, id: string): { type: string; props: Record<string, unknown> } {
  const props: Record<string, unknown> = { ...n.props, id };
  for (const [k, v] of Object.entries(props)) if (Array.isArray(v)) props[k] = v.map((c, i) => (c && typeof c === "object" && "type" in c ? withIds(c as never, `${id}-${k}${i}`) : c));
  return { type: n.type, props };
}
import { serverPuckConfig } from "@/lib/puck/config.server";
import { CATALOGUE } from "@/lib/puck/catalogue";
import { PublishedRoot } from "@/lib/puck/page-root";
import { listPages, loadPage } from "@/lib/puck/store";
import { loadBooking, loadService } from "@/lib/puck/data-service";
import { siteConfig } from "@/config/site";

const PARTED = new Set(["pt-event-header", "pt-event-about", "pt-talk-room", "pt-event-rsvp", "pt-event-materials", "pt-offering-card", "pt-services", "pt-service", "pt-booking", "pt-journal", "pt-article", "pt-series-nav", "pt-notice"]);
const GATHERING = "u_Nc_PUtWLPnSRjxAjWu2"; // a Para Theater gathering (featured/sunjay-opens.mts)
let pass = 0, fail = 0;
const ok = (name: string, c: boolean, x?: unknown) => { if (c) { pass++; console.log("pass", name); } else { fail++; console.log("  FAIL", name, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

type Node = { type: string; props: Record<string, unknown> & { id?: string } };
function walk(list: unknown, fn: (n: Node) => void) {
  if (!Array.isArray(list)) return;
  for (const n of list as Node[]) {
    if (!n || typeof n !== "object" || typeof n.type !== "string" || !n.props) continue;
    fn(n);
    for (const v of Object.values(n.props)) walk(v, fn);
  }
}

// The same catalogue with every `parts` declaration removed: what these blocks were before 2026-11-14.
const unparted = [...CATALOGUE, ...(BOX_BLOCKS as unknown as typeof CATALOGUE)].map((b) =>
  PARTED.has(b.def.id) ? ({ ...b, def: { ...b.def, parts: undefined } } as typeof b) : b
);
const beforeConfig = buildPuckConfig({ blocks: unparted, root: { props: [], wrap: PublishedRoot }, morph: MorphMark });

async function main() {
  // ── 1 and 2: stored pages ────────────────────────────────────────────────
  const pages = await listPages();
  ok(`stored pages listed (${pages.length}: ${pages.map((p) => p.slug).join(", ")})`, pages.length > 0);
  const known = new Set(Object.keys(serverPuckConfig.components));
  let holding = 0, looks = 0;
  for (const { slug } of pages) {
    const page = await loadPage(slug, known).catch(() => null);
    if (!page) { ok(`${slug}: loads`, false); continue; }
    const counts: Record<string, number> = {}; const morphs: string[] = [];
    walk((page.data as { content?: unknown }).content, (n) => {
      if (!PARTED.has(n.type)) return;
      counts[n.type] = (counts[n.type] ?? 0) + 1;
      if (n.props.morph) morphs.push(`${n.type}#${n.props.id}`);
    });
    if (Object.keys(counts).length) holding++;
    looks += morphs.length;
    console.log(`  ${slug}: ${Object.entries(counts).map(([t, c]) => `${t}×${c}`).join(" ") || "none of the 13"}${morphs.length ? `; looks on ${morphs.join(", ")}` : ""}`);
    if (slug === "landing") continue; // drawn only with the home page's live pieces (its own config), none of the 13
    const metadata: Record<string, unknown> = { orgId: siteConfig.orgId, slug, canEdit: false, ...(slug === "event-detail" ? { threadId: GATHERING } : {}) };
    try {
      const resolved = await resolveAllData(page.data as never, serverPuckConfig as never, metadata);
      const now = renderToStaticMarkup(h(Render as never, { config: serverPuckConfig, data: resolved, metadata } as never));
      const before = renderToStaticMarkup(h(Render as never, { config: beforeConfig, data: resolved, metadata } as never));
      ok(`${slug}: a visitor's HTML is byte-identical with and without the new parts (${now.length} bytes)`, now === before, { now: now.length, before: before.length });
    } catch (err) {
      ok(`${slug}: renders`, false, String(err).slice(0, 200));
    }
  }
  ok(`pages holding the 13 blocks: ${holding}; stored looks on them: ${looks}`, true);

  // ── 3: the loaders behind "From what?" for a service ────────────────────
  const all = await listServiceOfferings(siteConfig.orgId);
  ok(`the site's services listed (${all.length}: ${all.map((s) => s.slug).join(", ") || "none"})`, Array.isArray(all));
  if (all.length) {
    const slug = all[all.length - 1].slug;
    const one = await loadService({ service: slug }, {});
    ok(`a chosen slug draws that service (${slug})`, one.chosen?.slug === slug, one.chosen?.slug);
    const book = await loadBooking({ service: slug }, {});
    ok("…and the booking block books it", book.booking.service?.slug === slug, book.booking.service?.slug);
    const empty = await loadService({ service: "" }, {});
    ok("an empty choice draws the newest", empty.chosen?.slug === all[0].slug, [empty.chosen?.slug, all[0].slug]);
  }
  ok("a slug that is not ours draws nothing from it", (await getServiceOffering(siteConfig.orgId, "no-such-service-x")) === null);

  // ── 4: which gathering "Next gathering" shows (data-standing.ts), signed out ──
  ok("whichOf: missing, junk and \"standing\" are the standing meeting; next and thread:<id> kept", whichOf(undefined) === "standing" && whichOf("x; drop") === "standing" && whichOf("standing") === "standing" && whichOf("next") === "next" && whichOf("thread:abc_D-1") === "thread:abc_D-1" && whichOf("thread:a b") === "standing");
  const standing = await getStandingMeeting(siteConfig.orgId, null);
  const asBefore = await pickStanding("standing", null);
  ok(`"standing" is exactly getStandingMeeting (${standing ? `${standing.event.title}, ${standing.source}` : "none"})`, JSON.stringify(asBefore) === JSON.stringify(standing));
  ok("a missing `which` (every block stored before) is the same", JSON.stringify(await pickStanding(undefined, null)) === JSON.stringify(standing));
  const upcoming = await upcomingGatherings(null);
  const next = await pickStanding("next", null);
  ok(`"next" is the soonest occurrence (${next ? `${next.event.title} ${next.at.toISOString()}` : "none"}; ${upcoming.length} in range)`, upcoming.length ? next?.event.id === upcoming[0].item.id && next?.at.getTime() === upcoming[0].at.getTime() : next === null);
  if (upcoming.length) {
    const last = upcoming[upcoming.length - 1];
    const one = await pickStanding(`thread:${last.item.id}`, null);
    ok(`"thread:<id>" is that gathering's next occurrence (${last.item.title})`, one?.event.id === last.item.id && one?.source === "flagged" && one.at.getTime() === upcoming.find((o) => o.item.id === last.item.id)!.at.getTime());
  }
  ok("a gathering that is not this site's draws nothing", (await pickStanding("thread:zbereXeUpM-vXGTpAmzYw", null)) === null);
  ok("no join link signed out", !upcoming.some((o) => (o.item as { meetingUrl?: string | null }).meetingUrl));

  // ── 5: whose profile "Profile card" shows (data-profile.ts) ──
  const before = await getGuideBySlug(siteConfig.guideSlug);
  const site = await loadProfileFor("");
  ok(`empty = the site's guide, exactly the guide shown before (${site.guide?.displayName ?? "none"})`, JSON.stringify(site.guide) === JSON.stringify(before), [site.guide?.slug, before?.slug]);
  ok("…and a stored block with no `person` is the same", JSON.stringify((await loadProfileFor(undefined)).guide) === JSON.stringify(before));
  const guides = await getGuides();
  const other = guides.find((g) => g.slug !== before?.slug);
  if (other) {
    const chosen = await loadProfileFor(`user:${other.userId}`);
    ok(`a chosen person draws their card (${other.displayName})`, chosen.guide?.userId === other.userId && chosen.links.at(-1)?.emphasis === true);
  }
  if (upcoming.length) {
    const author = await loadProfileFor(`thread:${upcoming[0].item.id}:author`);
    ok(`a following choice draws whoever the gathering names (author of ${upcoming[0].item.title}: ${author.guide?.displayName ?? "no public profile"})`, author.guide === null || typeof author.guide.slug === "string");
  }
  ok("someone with no public profile here draws no card", (await loadProfileFor("user:00000000-0000-4000-8000-000000000001")).guide === null);
  ok("junk draws no card", (await loadProfileFor("x'; drop")).guide === null);
  const owner = await siteGuide();
  ok("posts by the guide (pt-threads author) follow the same guide", owner?.userId === before?.userId);

  // ── 6: the post page template (data-post.ts, POST_DETAIL_TEMPLATE) ──
  const threads = await getAllThreadsForOrg(200);
  const aPost = threads.find((t) => t.kind === "post" && t.status === "published");
  const aMeeting = threads.find((t) => t.kind === "meeting");
  ok(`a published post exists to draw (${aPost ? aPost.title : "none"})`, Boolean(aPost));
  if (aPost) {
    const { post } = await loadPost({ threadId: aPost.id });
    ok("loadPost draws the post the route found, with its section", post?.id === aPost.id && post.title === aPost.title && (post.feedSlug ?? null) === (aPost.feedSlug ?? null) && typeof post.feedName === "string", [post?.title, post?.feedName]);
    const doc = { root: { props: {} }, content: POST_DETAIL_TEMPLATE.content.map((n, i) => withIds(n, `t${i}`)) };
    const metadata = { orgId: siteConfig.orgId, slug: "post-detail", canEdit: false, threadId: aPost.id };
    const resolved = await resolveAllData(doc as never, serverPuckConfig as never, metadata);
    const html = renderToStaticMarkup(h(Render as never, { config: serverPuckConfig, data: resolved, metadata } as never));
    ok("the starting template draws that post for a visitor (title, body, section link)", html.includes(esc(aPost.title)) && html.includes("eac-article") && (aPost.feedSlug ? html.includes(`href="/${aPost.feedSlug}"`) : true), html.length);
  }
  if (aMeeting) ok("a gathering is not drawn as a post", (await loadPost({ threadId: aMeeting.id })).post === null);
  ok("no record, nothing drawn (the editor shows its example)", (await loadPost({})).post === null);
  ok("another org's thread draws nothing", (await loadPost({ threadId: "zbereXeUpM-vXGTpAmzYw" })).post === null);

  console.log(`\n${pass} passed, ${fail} failed`);
}
main().then(() => process.exit(0), (e) => { console.log("CRASH", e?.stack || e); process.exit(1); });
