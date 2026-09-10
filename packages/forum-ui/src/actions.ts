import type { ForumConnectors } from "./connectors";

// ============================================================================
// Form actions. Every interaction on the board is a plain HTML <form> that
// POSTs here — reply, vote, heart, watch, bookmark, mark read, new topic,
// moderate — so the forum works with no client JavaScript at all. The host
// mounts this once as a route handler; the package owns what the fields
// mean, the host owns who is asking (through connectors.viewer).
//
// Every action ends in a redirect (303) back to a page, with `?notice=` or
// `?error=` carried in the query so the next render can say what happened.
// ============================================================================

export type ForumActionName =
  | "reply" | "topic" | "vote" | "heart" | "watch" | "bookmark"
  | "read-all" | "propose-topic" | "moderate" | "notifications-read" | "review-topic";

const ACTIONS = new Set<string>([
  "reply", "topic", "vote", "heart", "watch", "bookmark", "read-all", "propose-topic", "moderate", "notifications-read", "review-topic",
]);

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

function withQuery(url: string, params: Record<string, string | null | undefined>): string {
  const [path, hash = ""] = url.split("#");
  const [base, qs = ""] = path.split("?");
  const sp = new URLSearchParams(qs);
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v); else sp.delete(k);
  }
  const s = sp.toString();
  return `${base}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Only ever redirect within the site: a `back` field is a path, never a URL. */
function safeBack(raw: string, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

function redirect(to: string): Response {
  return new Response(null, { status: 303, headers: { Location: to } });
}

export interface HandleActionOptions {
  request: Request;
  /** The action name from the URL, e.g. the last segment of /api/forum/reply. */
  action: string;
  connectors: ForumConnectors;
}

export async function handleForumAction({ request, action, connectors }: HandleActionOptions): Promise<Response> {
  if (request.method !== "POST" || !ACTIONS.has(action)) {
    return new Response("Not found", { status: 404 });
  }
  const w = connectors.write;
  if (!w) return new Response("This host is read-only", { status: 405 });

  const fd = await request.formData();
  const viewer = await connectors.viewer();
  const { hrefs } = connectors;
  const back = safeBack(str(fd, "back"), hrefs.root());
  const fail = (error: string) => redirect(withQuery(back, { error, notice: null }));
  const done = (to: string, notice?: string) => redirect(withQuery(to, { notice: notice ?? null, error: null }));

  if (!viewer.userId) return fail("Sign in first.");

  switch (action as ForumActionName) {
    case "reply": {
      const threadId = str(fd, "thread");
      const r = await w.postReply(viewer, { threadId, text: str(fd, "text"), parentId: str(fd, "parent") || null });
      if (r.ok === false) return fail(r.error);
      const slug = str(fd, "slug") || "topic";
      const base = hrefs.thread(threadId, slug);
      return done(`${withQuery(base, { page: r.page > 1 ? String(r.page) : null })}#reply-${r.replyId}`);
    }
    case "topic": {
      const orgId = str(fd, "org");
      const feedSlug = str(fd, "feed");
      const topicIds = fd.getAll("topics").filter((v): v is string => typeof v === "string");
      const r = await w.createTopic(viewer, { orgId, feedSlug, title: str(fd, "title"), text: str(fd, "text"), topicIds });
      if (r.ok === false) return fail(r.error);
      return done(hrefs.thread(r.threadId, r.slug));
    }
    case "vote": {
      const kind = str(fd, "kind");
      if (kind !== "up" && kind !== "down") return fail("Bad vote.");
      const r = await w.setVote(viewer, { threadId: str(fd, "thread"), replyId: str(fd, "reply") || null }, kind);
      return r.ok === true ? done(back) : fail(r.error);
    }
    case "heart": {
      const r = await w.toggleHeart(viewer, { threadId: str(fd, "thread"), replyId: str(fd, "reply") || null });
      return r.ok === true ? done(back) : fail(r.error);
    }
    case "watch": {
      const r = await w.toggleWatch(viewer, str(fd, "thread"));
      return r.ok === true ? done(back, r.watching ? "Watching this topic." : "No longer watching.") : fail(r.error);
    }
    case "bookmark": {
      const r = await w.toggleBookmark(viewer, str(fd, "thread"));
      return r.ok === true ? done(back, r.bookmarked ? "Bookmarked." : "Bookmark removed.") : fail(r.error);
    }
    case "read-all": {
      const r = await w.markAllRead(viewer);
      return r.ok === true ? done(back, "Everything marked read.") : fail(r.error);
    }
    case "propose-topic": {
      const r = await w.proposeTopic(viewer, { name: str(fd, "name"), orgId: str(fd, "org") });
      if (r.ok === false) return fail(r.error);
      return done(back, r.status === "approved" ? "Topic added." : "Topic proposed — an admin will review it.");
    }
    case "moderate": {
      const act = str(fd, "do");
      const ok = ["pin", "unpin", "lock", "unlock", "delete", "move"].includes(act);
      if (!ok) return fail("Bad action.");
      const r = await w.moderateThread(viewer, str(fd, "thread"), act as never, str(fd, "arg") || undefined);
      if (r.ok === false) return fail(r.error);
      return done(act === "delete" ? hrefs.root() : back, `Done: ${act}.`);
    }
    case "notifications-read": {
      await w.markNotificationsRead(viewer.userId);
      return done(back);
    }
    case "review-topic": {
      if (!w.reviewTopic) return fail("Not available here.");
      const decision = str(fd, "decision");
      if (decision !== "approved" && decision !== "rejected") return fail("Bad decision.");
      const r = await w.reviewTopic(viewer, str(fd, "topic"), decision);
      return r.ok === true ? done(back, decision === "approved" ? "Approved." : "Rejected.") : fail(r.error);
    }
  }
  return new Response("Not found", { status: 404 });
}
