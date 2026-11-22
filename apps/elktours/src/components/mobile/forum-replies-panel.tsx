"use client";

import * as React from "react";
import { AttachPicker } from "@elkdonis/forum-ui/attach";
import type { PhoneReply, PhoneThreadReplies } from "@/lib/forum-data";
import "./forum-surface.css";

// The replies of a forum topic, with the reply box, for the thread popup and the topic page (screen 20).
// Reads and writes go through /api/hub/forum/*, so one list is shared by the popup, the page and the desktop
// forum: they are all the same `replies` rows. Role rings: owner and guide brass, artist verdigris, guest plain.

const RING_LABEL: Record<PhoneReply["ring"], string> = { owner: "Office", guide: "Guide", artist: "Artist", guest: "" };
const AUDIENCES: Array<{ key: "everyone" | "followers" | "author"; label: string; help: string }> = [
  { key: "everyone", label: "Public", help: "Anyone can read it, signed in or not. Members can reply." },
  { key: "followers", label: "Members", help: "Only signed-in members can read it." },
  { key: "author", label: "Private", help: "Only you can read it." },
];

function when(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = 60_000, h = 60 * m, day = 24 * h;
  if (diff < m) return "now";
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < day) return `${Math.floor(diff / h)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Attachments({ items }: { items: PhoneReply["attachments"] }) {
  if (!items.length) return null;
  const links = items.filter((a) => a.kind === "link");
  const media = items.filter((a) => a.kind !== "link");
  return (
    <>
      {links.map((a, i) => (
        <a key={`l${i}`} className="fs-linkcard" href={a.url} target="_blank" rel="noopener noreferrer">
          <span className="fs-linkcard-body">
            <span className="fs-linkcard-host">{a.card.siteName ?? new URL(a.url).hostname.replace(/^www\./, "")}</span>
            <span className="fs-linkcard-title">{a.card.title ?? a.url}</span>
          </span>
        </a>
      ))}
      {media.length > 0 && (
        <div className="fs-media">
          {media.map((a, i) =>
            a.kind === "video" ? <video key={i} src={a.url} controls preload="metadata" playsInline /> : /* eslint-disable-next-line @next/next/no-img-element */ <img key={i} src={a.url} alt="" loading="lazy" />
          )}
        </div>
      )}
    </>
  );
}

export function ForumRepliesPanel({ threadId }: { threadId: string }) {
  const [data, setData] = React.useState<PhoneThreadReplies | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [audienceNote, setAudienceNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/hub/forum/replies?thread=${encodeURIComponent(threadId)}`, { cache: "no-store" });
      if (!res.ok) { setState("missing"); return; }
      setData((await res.json()) as PhoneThreadReplies);
      setState("ready");
    } catch {
      setState("missing");
    }
  }, [threadId]);
  React.useEffect(() => { void load(); }, [load]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = String(fd.get("text") ?? "");
    const attachments = fd.getAll("attachment").flatMap((v) => { try { return [JSON.parse(String(v))]; } catch { return []; } });
    if (!text.trim() && attachments.length === 0) { setError("Write something, or add a photo or video."); return; }
    setSending(true);
    setError(null);
    const res = await fetch("/api/hub/forum/replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, text, attachments }) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setSending(false);
    if (!res.ok || json.ok === false) { setError(json.error ?? "Could not post."); return; }
    setFormKey((k) => k + 1);
    await load();
  }

  async function setAudience(a: "everyone" | "followers" | "author") {
    setAudienceNote(null);
    const res = await fetch("/api/hub/forum/audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, audience: a }) });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) { setAudienceNote(json.error ?? "Could not change that."); return; }
    await load();
  }

  if (state === "loading") return <p className="fs-muted">Loading the replies…</p>;
  if (state === "missing" || !data) return null;
  const { thread, viewer, replies } = data;
  const help = AUDIENCES.find((a) => a.key === thread.audience)?.help ?? "";

  return (
    <section className="fs-root fs-replies" aria-label="Replies">
      {thread.mine ? (
        <div className="fs-yours">
          <span className="fs-kicker">Your topic · who can read it</span>
          <div className="fs-chips">
            {AUDIENCES.map((a) => (
              <button key={a.key} type="button" className={`fs-chip${thread.audience === a.key ? " is-on" : ""}`} aria-pressed={thread.audience === a.key} onClick={() => void setAudience(a.key)}>
                {a.label}
              </button>
            ))}
          </div>
          <p className="fs-help">{audienceNote ?? help}</p>
        </div>
      ) : null}

      <div className="fs-head">
        <span className="fs-kicker">{replies.length === 1 ? "1 reply" : `${replies.length} replies`}</span>
        <span className="fs-rule" aria-hidden="true" />
      </div>
      <ol className="fs-list">
        {replies.map((r) => (
          <li key={r.id} className={`fs-reply${r.parentId ? " is-nested" : ""}`}>
            <span className="fs-avatar" data-ring={r.ring} aria-hidden="true">{r.author.name.charAt(0).toUpperCase()}</span>
            <div className="fs-reply-main">
              <div className="fs-reply-head">
                <span className="fs-name">{r.author.name}{viewer.userId && r.author.id === viewer.userId ? " (you)" : ""}</span>
                {RING_LABEL[r.ring] ? <span className="fs-role" data-ring={r.ring}>{RING_LABEL[r.ring]}</span> : null}
                <span className="fs-when">{when(r.createdAt)}</span>
              </div>
              {r.contentHtml ? <div className="fs-body" dangerouslySetInnerHTML={{ __html: r.contentHtml }} /> : null}
              <Attachments items={r.attachments} />
            </div>
          </li>
        ))}
      </ol>

      {thread.locked ? (
        <p className="fs-muted">This topic is locked.</p>
      ) : !viewer.signedIn ? (
        <p className="fs-muted"><a href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/forum")}`}>Sign in</a> to reply.</p>
      ) : (
        <form key={formKey} className="fs-replybar" onSubmit={(e) => void send(e)}>
          <textarea name="text" className="fs-input fs-textarea" rows={2} placeholder="Reply" aria-label="Your reply" />
          <AttachPicker variant="reply" />
          {error ? <p className="fs-error" role="alert">{error}</p> : null}
          <button type="submit" className="fs-send" disabled={sending}>{sending ? "Sending…" : "Reply"}</button>
        </form>
      )}
    </section>
  );
}
