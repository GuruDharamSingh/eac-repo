import { createThread, folderForMime, listOrgMediaLibrary, searchForum, uploadOrgFile } from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { sendEmail } from "@elkdonis/email";
import type { LmsConnectors } from "@elkdonis/lms-ui";
import { getViewer } from "./viewer";
import { EditorIsland } from "@/components/EditorIsland";
import { FORUM_URL, SITE, SOPHIA_URL } from "./site";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MAX_MB = { image: 25, audio: 150, video: 500, document: 50 } as const;

export const connectors: LmsConnectors = {
  viewer: getViewer,
  site: SITE,
  origin: SOPHIA_URL,
  actionBase: "/api/lms",
  hrefs: {
    home: () => "/",
    course: (c) => `/${c}`,
    step: (c, s) => `/${c}/${s}`,
    journal: () => "/journal",
    studio: () => "/studio",
    studioCourse: (c) => `/studio/${c}`,
    studioStep: (c, id) => `/studio/${c}/${id}`,
    studioPool: (c) => `/studio/${c}/pool`,
    guide: () => "/guide",
    care: () => "/care",
    signIn: (next) => `/login?next=${encodeURIComponent(next)}`,
    forumThread: (id, slug) => `${FORUM_URL}/t/${id}/${slug}`,
  },
  // Media is served by this host's own /api/media (services' serveMedia — the
  // shared read path, authorised per file), so stored paths are used as they are.
  mediaUrl: (url) => url,

  // The shared upload path: sniff the CONTENT, cap the size, uploadOrgFile into
  // EAC_Network/<org>/Media/<kind>, which serveMedia reads back publicly.
  uploadMedia: async ({ orgId, uploaderId, file }) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateUploadBuffer(bytes, ["image", "audio", "video", "document"], { allowText: true });
    if ("reason" in check) return { ok: false, error: check.reason || "That kind of file isn’t accepted." };
    const { mime, kind } = check.sniffed;
    if (kind === "svg") return { ok: false, error: "SVG files aren’t accepted." };
    // Signature-less text is only a document when it is NAMED as one. Without
    // this, markup saved as "photo.png" passes as text and is stored under the
    // image's name (serveMedia sends nosniff, so it is inert — but it is junk).
    if (mime === "text/plain" && !/\.(txt|md)$/i.test(file.name)) return { ok: false, error: "That file isn’t what its name says it is." };
    const limit = MAX_MB[kind as keyof typeof MAX_MB] ?? 50;
    if (bytes.byteLength > limit * 1024 * 1024) return { ok: false, error: `That file is over the ${limit} MB limit for ${kind}.` };
    try {
      const r = await uploadOrgFile(orgId, `Media/${folderForMime(mime)}`, file.name, bytes, mime, uploaderId);
      if (!r) return { ok: false, error: "Storage didn’t accept the file." };
      return { ok: true, url: r.url, name: r.name, kind: kind === "document" ? "file" : (kind as "audio" | "video" | "image") };
    } catch (err) {
      console.error("[sophia] upload:", err);
      return { ok: false, error: "The upload failed." };
    }
  },

  // The pool's two finders are the network's own: forum search (which already
  // applies what this viewer may see) and the org media library.
  searchThreads: async (q, viewer) => {
    const page = await searchForum(q, viewer, { only: "thread", limit: 12 });
    return page.rows.map((h) => ({ threadId: h.threadId, title: h.threadTitle, snippet: h.snippet, orgName: h.org.name }));
  },
  listOrgMedia: async (orgId) => {
    const kindOf = (name: string) => (/\.(mp3|wav|m4a|ogg|flac)$/i.test(name) ? "audio" : /\.(mp4|webm|mov|m4v)$/i.test(name) ? "video" : /\.(png|jpe?g|gif|webp|avif)$/i.test(name) ? "image" : "file") as "audio" | "video" | "image" | "file";
    const items = await listOrgMediaLibrary(orgId, { type: null as never, limit: 100 });
    return items.map((m) => ({ url: m.url, filename: m.filename, kind: kindOf(m.filename) }));
  },

  editor: EditorIsland,

  createDiscussionThread: async ({ orgId, authorId, section, title, bodyHtml }) => {
    const t = await createThread({ kind: "post", title, orgId, authorId, body: bodyHtml, status: "published", visibility: "PUBLIC", section });
    return { id: t.id };
  },

  // Course-operational mail (CASL: needs no marketing consent). It says THAT
  // the guide answered, never what either of them wrote.
  notifyAcknowledged: async (n, stepUrl) => {
    if (!n.learnerEmail) return;
    await sendEmail({
      to: n.learnerEmail,
      orgId: "elkdonis",
      subject: `${n.guideName} answered your reflection`,
      html: `<p>Hello ${esc(n.learnerName)},</p><p>${esc(n.guideName)} left you a few words on <strong>${esc(n.stepTitle)}</strong>.</p><p><a href="${stepUrl}">Read them on ${esc(SITE.name)}</a></p><p style="color:#666;font-size:13px">You’re getting this because you chose to show that reflection to your guide. What you wrote is not included in this email.</p>`,
    });
  },
};
