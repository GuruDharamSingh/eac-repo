import { mountTreePage } from "/app/packages/direct-edit/src/puck/index";
import { canvasConfig, canvasContract } from "/app/apps/sunjay/src/lib/puck/config.client";
import { cleanBoxDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import seed from "/app/packages/direct-edit/harness/sunjay-try-page.json";

const pic = (fill: string, label: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 320"><rect width="840" height="320" fill="${fill}"/><text x="30" y="60" font-family="sans-serif" font-size="30" fill="#fff">${label}</text></svg>`)}`;
const thread = (id: string, title: string, excerpt: string, fill: string) => ({ id, slug: id, title, excerpt, description: excerpt, feedSlug: "materials", kind: "post", coverImageUrl: pic(fill, title), authorName: "Jason Ford aka sunjye", publishedAt: "2026-10-19T12:00:00Z", createdAt: "2026-10-19T12:00:00Z", isOnline: false });
const threads = [
  { ...thread("all-rites", "All Rites Reversed by Antero Alli", "Source text for Alli's early paratheatre work.", "#5b4636"), coverImageUrl: null },
  thread("q-what", "Q- What is Ritual Theatre?", "Ritual Theater Labs are an ongoing practice.", "#3f5a6b"),
  thread("garuda", "Wearing a Cloak of Garuda Feathers", "Riding the wind horse of goodness.", "#6b3f4c"),
  thread("why-med", "Why We Meditate", "Notes for the circle of seers.", "#46603f"),
];
const event = { id: "lab", slug: "ritual-theatre-lab", title: "Ritual Theatre Lab", kind: "meeting", description: "A weekly online lab.", excerpt: "A weekly online lab.", scheduledAt: new Date("2026-12-06T20:30:00Z"), durationMinutes: 90, isOnline: true, location: null, coverImageUrl: pic("#2d3a4a", "Ritual Theatre Lab"), recurrencePattern: "WEEKLY", attendanceCount: 4, isRsvpEnabled: true, feedSlug: "gatherings", feedName: "Gatherings", orgId: "sunjay" };
const rows: Record<string, Record<string, unknown>> = {
  "try-feed-cards": { threads },
  "try-feed-list": { threads },
  "try-standing": { standing: { event, at: "2026-12-06T20:30:00Z", source: "weekly" } },
  "try-calendar": { events: [] },
  "try-profile": { guide: { userId: "g", slug: "jason-ford", displayName: "Jason Ford aka sunjye", roleTitle: "Teacher", bio: "Artist, rock balancer and teacher of ritual theatre.", photoUrl: pic("#55708a", "Portrait"), city: null, socialLinks: [], sortOrder: 0 }, links: [{ label: "Elkdonis Arts", url: "https://elkdonis-arts.org", emphasis: true }] },
  "try-forum": { forum: { title: "Para Theater", href: "/forum", feeds: [{ slug: "lab", name: "Lab work", threadCount: 3 }, { slug: "materials", name: "Materials", threadCount: 4 }], recent: threads.map((t) => ({ id: t.id, title: t.title, slug: t.slug, kind: "post", href: "/x", lastActivityAt: new Date("2026-11-02T12:00:00Z"), at: new Date("2026-11-02T12:00:00Z"), replyCount: 1 })), topicCount: 9, postCount: 9 } },
  "try-writing": { items: threads.map((t) => ({ id: t.id, slug: t.slug, title: t.title, lede: t.excerpt, coverImageUrl: t.coverImageUrl, status: "published", publishedAt: t.publishedAt })) },
  "try-gallery": { images: [pic("#39475a", "Nightjar"), pic("#6d5a44", "Vessels"), pic("#8c6f5a", "Winter")].map((url, i) => ({ url, name: `Picture ${i + 1}` })) },
};
(globalThis as any).__saved = null;
(globalThis as any).__ed = mountTreePage({
  host: document.getElementById("host")!,
  config: canvasConfig as any,
  contract: canvasContract as any,
  doc: seed as any,
  resolved: rows,
  metadata: { orgId: "sunjay", slug: "try" },
  pageName: "Try the editor",
  onSave: async (d: any) => { (globalThis as any).__saved = cleanBoxDoc(d); return { ok: true }; },
} as any);
