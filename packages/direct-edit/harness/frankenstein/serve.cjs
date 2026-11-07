// Static server for the harness page plus stand-in /api/blocks/<id> rows (the shapes sunjay-live/live.ts uses).
const http = require("http"), fs = require("fs");
const pic = (fill, label) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 320"><rect width="840" height="320" fill="${fill}"/><text x="30" y="60" font-family="sans-serif" font-size="30" fill="#fff">${label}</text></svg>`)}`;
const thread = (id, title, excerpt, fill) => ({ id, slug: id, title, excerpt, description: excerpt, feedSlug: "materials", kind: "post", coverImageUrl: pic(fill, title), authorName: "Jason Ford aka sunjye", publishedAt: "2026-10-19T12:00:00Z", createdAt: "2026-10-19T12:00:00Z", isOnline: false });
const threads = [
  { ...thread("all-rites", "All Rites Reversed by Antero Alli", "Source text for Alli's early paratheatre work.", "#5b4636"), coverImageUrl: null },
  thread("q-what", "Q- What is Ritual Theatre?", "Ritual Theater Labs are an ongoing practice.", "#3f5a6b"),
  thread("garuda", "Wearing a Cloak of Garuda Feathers", "Riding the wind horse of goodness.", "#6b3f4c"),
];
const event = { id: "lab", slug: "ritual-theatre-lab", title: "Ritual Theatre Lab", kind: "meeting", description: "A weekly online lab.", excerpt: "A weekly online lab.", scheduledAt: "2026-12-06T20:30:00Z", durationMinutes: 90, isOnline: true, location: null, coverImageUrl: pic("#2d3a4a", "Ritual Theatre Lab"), recurrencePattern: "WEEKLY", attendanceCount: 4, isRsvpEnabled: true, feedSlug: "gatherings", feedName: "Gatherings", orgId: "sunjay" };
const ROWS = {
  "pt-threads": { threads },
  "pt-standing": { standing: { event, at: "2026-12-06T20:30:00Z", source: "weekly" } },
  "pt-calendar": { events: [] },
  "pt-profile": { guide: { userId: "g", slug: "jason-ford", displayName: "Jason Ford aka sunjye", roleTitle: "Teacher", bio: "Artist and teacher of ritual theatre.", photoUrl: pic("#55708a", "Portrait"), city: null, socialLinks: [], sortOrder: 0 }, links: [] },
  "pt-forum": { forum: { title: "Para Theater", href: "/forum", feeds: [{ slug: "lab", name: "Lab work", threadCount: 3 }], recent: [], topicCount: 3, postCount: 3 } },
  "pt-writing": { items: threads.map((t) => ({ id: t.id, slug: t.slug, title: t.title, lede: t.excerpt, coverImageUrl: t.coverImageUrl, status: "published", publishedAt: t.publishedAt })) },
  "pt-gallery": { images: [pic("#39475a", "Nightjar"), pic("#6d5a44", "Vessels")].map((url, i) => ({ url, name: `Picture ${i + 1}` })) },
};
const fetched = [];
const TYPES = { css: "text/css", js: "text/javascript" };
function serve(dir, page, port = 8123) {
  const srv = http.createServer((q, r) => {
    const api = q.url.match(/^\/api\/blocks\/([a-z0-9-]+)(\?.*)?$/);
    if (api) { fetched.push(q.url); r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify(ROWS[api[1]] ?? {})); return; }
    const f = q.url.match(/^\/([\w.-]+\.(css|js))$/);
    if (f && fs.existsSync(`${dir}/${f[1]}`)) { r.writeHead(200, { "content-type": TYPES[f[2]] }); r.end(fs.readFileSync(`${dir}/${f[1]}`)); return; }
    r.writeHead(200, { "content-type": "text/html" }); r.end(page);
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok(srv)));
}
module.exports = { serve, fetched };
