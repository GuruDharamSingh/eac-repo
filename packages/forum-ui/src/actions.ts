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
  | "read-all" | "propose-topic" | "moderate" | "notifications-read" | "review-topic"
  | "set-theme" | "category" | "wiki-talk" | "wiki-define";

const ACTIONS = new Set<string>([
  "reply", "topic", "vote", "heart", "watch", "bookmark", "read-all", "propose-topic", "moderate", "notifications-read", "review-topic", "set-theme", "category", "wiki-talk", "wiki-define",
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

  // Reader preferences. Deliberately outside the sign-in check below: how the
  // board LOOKS is not a privilege, and a signed-out reader who finds it hard
  // to read should be able to change it.
  if (action === "set-theme") {
    const res = redirect(safeBack(str(fd, "back"), hrefs.root()));
    const cookies: string[] = [];
    if (fd.has("theme")) {
      const theme = str(fd, "theme") === "modern" ? "modern" : "classic";
      cookies.push(`forum_theme=${theme}; Path=/; SameSite=Lax; Max-Age=31536000`);
    }
    if (fd.has("mode")) {
      const raw = str(fd, "mode");
      const mode = raw === "dark" || raw === "auto" ? raw : "light";
      cookies.push(`forum_mode=${mode}; Path=/; SameSite=Lax; Max-Age=31536000`);
    }
    for (const c of cookies) res.headers.append("Set-Cookie", c);
    return res;
  }

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
    case "category": {
      if (!w.createCategory) return fail("Not available here.");
      const r = await w.createCategory(viewer, {
        orgId: str(fd, "org"),
        name: str(fd, "name"),
        tagline: str(fd, "tagline"),
        audience: str(fd, "audience") === "members" ? "members" : "everyone",
      });
      if (r.ok === false) return fail(r.error);
      // Straight into the new category, which is empty and shows its own
      // new-topic form — the next thing they want is to post in it.
      return done(hrefs.feed(str(fd, "orgSlug"), r.slug), `“${r.name}” added.`);
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
    // Add a word to the dictionary from inside the forum. Reading is when
    // you notice an undefined term, so the wiki section takes input as well
    // as showing pages.
    case "wiki-define": {
      const define = connectors.wiki?.define;
      if (!define) return fail("Not available here.");
      const term = str(fd, "term").replace(/\s+/g, " ").trim();
      const definition = str(fd, "definition").trim();
      if (!term) return fail("Which word?");
      if (term.length > 120) return fail("That is too long for a term.");
      if (!definition) return fail("Say what it means.");

      const r = await define({
        term,
        definition,
        authorId: viewer.userId,
        sourceThreadId: str(fd, "sourceThreadId") || undefined,
      });

      const to = hrefs.wikiPage?.(r.slug) ?? back;
      if (r.duplicate) return done(to, `“${term}” already said it that way.`);
      return done(
        to,
        r.created
          ? `“${term}” added to the dictionary.`
          : `Your sense of “${term}” sits alongside the ${r.senses - 1} already there.`
      );
    }
    // Start the Talk page for a wiki page. Creating on demand rather than
    // with every wiki page is what keeps the board free of empty topics.
    case "wiki-talk": {
      const wikiTalk = connectors.wiki?.talkThread;
      if (!wikiTalk) return fail("Not available here.");
      // Attributed to whoever starts the discussion, not to whoever happened
      // to create the wiki page.
      const talk = await wikiTalk(str(fd, "wikiThreadId"), {
        ensure: true,
        authorId: viewer.userId,
      });
      if (!talk) return fail("That page is gone.");
      return done(hrefs.thread(talk.id, talk.slug));
    }
  }
  return new Response("Not found", { status: 404 });
}
