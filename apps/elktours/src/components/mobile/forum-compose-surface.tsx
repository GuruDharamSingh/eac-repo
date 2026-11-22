"use client";

import * as React from "react";
import { SurfaceFrame, useLayer, useSurface, type SurfaceDescriptor, type SurfaceForum, type SurfaceForumFeed } from "@elkdonis/cms-ui/surface";
import { AttachPicker } from "@elkdonis/forum-ui/attach";
import "./forum-surface.css";

// Start a topic (design screen 21) as a compose surface: opened as a layer from the forum list, a section page or a
// popup. Section (sub-sections as "Parent > Child"), Kind, Title, What you want to say, Link, Photos and video, Who can
// read it. Posts through /api/hub/forum/topics, which wraps createTopic (the services decide who may post where).
// Private is the author only in this version; named people are not supported yet.

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;
type Kind = "post" | "idea" | "event";
type Audience = "everyone" | "followers" | "author";

const KINDS: Array<{ key: Kind; label: string }> = [
  { key: "post", label: "Discussion" },
  { key: "idea", label: "Idea" },
  { key: "event", label: "Event" },
];
const AUDIENCES: Array<{ key: Audience; label: string; help: string }> = [
  { key: "everyone", label: "Public", help: "Anyone can read it, signed in or not. Members can reply." },
  { key: "followers", label: "Members", help: "Only signed-in members can read it." },
  { key: "author", label: "Private", help: "Only you can read it." },
];

export function ForumComposeSurface({ descriptor }: { descriptor: Custom }) {
  const { replace, connectors } = useSurface();
  const layer = useLayer();
  const preset = typeof descriptor.props?.section === "string" ? (descriptor.props.section as string) : null;
  const [forum, setForum] = React.useState<SurfaceForum | null>(null);
  const [section, setSection] = React.useState<string | null>(preset);
  const [kind, setKind] = React.useState<Kind>("post");
  const [audience, setAudience] = React.useState<Audience>("everyone");
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [link, setLink] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => { layer.setMeta({ title: "Start a topic", kind: "forum", size: "standard" }); }, [layer]);
  React.useEffect(() => {
    let off = false;
    void fetch("/api/hub/forum", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((f: SurfaceForum | null) => {
        if (off || !f) return;
        setForum(f);
        setSection((cur) => cur ?? f.feeds.find((x) => !x.closed)?.slug ?? f.feeds[0]?.slug ?? null);
      })
      .catch(() => undefined);
    return () => { off = true; };
  }, []);

  const feeds = forum?.feeds ?? [];
  const byslug = new Map(feeds.map((f) => [f.slug, f]));
  const label = (f: SurfaceForumFeed) => (f.parentSlug && byslug.get(f.parentSlug) ? `${byslug.get(f.parentSlug)!.name} › ${f.name}` : f.name);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!section) { setError("Choose a section."); return; }
    if (title.trim().length < 2) { setError("Give it a title."); return; }
    if (!text.trim()) { setError("Say what you want to say."); return; }
    const fd = new FormData(e.currentTarget);
    const attachments = fd.getAll("attachment").flatMap((v) => { try { return [JSON.parse(String(v))]; } catch { return []; } });
    setSending(true);
    setError(null);
    const res = await fetch("/api/hub/forum/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedSlug: section, title, text, kind, audience, link: link.trim() || undefined, attachments }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: string };
    setSending(false);
    if (!res.ok || json.ok === false || !json.id) { setError(json.error ?? "Could not post it."); return; }
    connectors.onMutated?.();
    replace({ type: "thread", id: json.id, preview: { title, kind } });
  }

  const help = AUDIENCES.find((a) => a.key === audience)?.help;
  return (
    <SurfaceFrame kind="forum" title="Start a topic" kicker={connectors.orgName ? `Forum · ${connectors.orgName}` : "Forum"}>
      <form ref={formRef} data-audience={audience} className="fs-root fs-compose" onSubmit={(e) => void submit(e)} noValidate>
        <div className="fs-field">
          <span className="fs-kicker">Section</span>
          <div className="fs-chips">
            {feeds.map((f) => (
              <button key={f.slug} type="button" className={`fs-chip${section === f.slug ? " is-on" : ""}`} aria-pressed={section === f.slug} onClick={() => setSection(f.slug)}>
                {label(f)}
              </button>
            ))}
          </div>
        </div>
        <div className="fs-field">
          <span className="fs-kicker">Kind</span>
          <div className="fs-chips fs-chips--even">
            {KINDS.map((k) => (
              <button key={k.key} type="button" className={`fs-chip fs-chip--wide${kind === k.key ? " is-on" : ""}`} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <label className="fs-field">
          <span className="fs-kicker">Title</span>
          <input className="fs-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A question, an idea, a plan" maxLength={200} />
        </label>
        <label className="fs-field">
          <span className="fs-kicker">What you want to say</span>
          <textarea className="fs-input fs-textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className="fs-field">
          <span className="fs-kicker">Link · optional</span>
          <input className="fs-input" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        </label>
        <AttachPicker variant="compose" />
        <div className="fs-field">
          <span className="fs-kicker">Who can read it</span>
          <div className="fs-chips fs-chips--even">
            {AUDIENCES.map((a) => (
              <button key={a.key} type="button" className={`fs-chip fs-chip--wide${audience === a.key ? " is-on" : ""}`} aria-pressed={audience === a.key} onClick={() => setAudience(a.key)}>
                {a.label}
              </button>
            ))}
          </div>
          <p className="fs-help">{help}</p>
        </div>
        {error ? <p className="fs-error" role="alert">{error}</p> : null}
        <button type="submit" className="fs-post" disabled={sending}>{sending ? "Posting…" : "Post topic"}</button>
      </form>
    </SurfaceFrame>
  );
}
