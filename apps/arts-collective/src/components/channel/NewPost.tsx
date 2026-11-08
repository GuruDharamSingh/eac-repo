"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, Check, ExternalLink, Pencil } from "lucide-react";
import { INSTAGRAM_RULES, fmtLong, kindGlyph, kindLabel, linkInBio, type Piece } from "@/lib/channel/model";
import {
  dryRunPublishAction,
  listPublishTargetsAction,
  publishNewPostAction,
  saveNewPostAction,
  type DryRunStep,
  type PublishResult,
  type PublishTarget,
} from "@/lib/channel/actions";
import { CHANNEL_BASE, useChannel } from "./context";
import { OutletIcon } from "./icons";
import { PreviewCard } from "./QuickSheet";
import { Thumb } from "./bits";

type Col = "site" | "instagram" | "facebook";

/** "Post as" (design 1c): the kind of post, which sets the shared text's starting shape. */
const POST_AS = [
  { id: "artwork", label: "Artwork" },
  { id: "writing", label: "Writing" },
  { id: "video", label: "Video" },
  { id: "series", label: "Series" },
  { id: "meeting", label: "Meeting" },
] as const;
type PostAs = (typeof POST_AS)[number]["id"];

function postAsFor(p: Piece | undefined): PostAs {
  if (!p) return "artwork";
  if (p.kind === "product" || p.kind === "artwork") return "artwork";
  if (p.kind === "workshop") return "series";
  if (p.kind === "event") return "meeting";
  return p.kind as PostAs;
}

/** The shared text's starting shape for a kind of post about a piece. The title is its own field. */
function template(kind: PostAs, p: Piece | undefined, timeZone: string): string {
  if (!p) return "";
  const when = p.eventAt ? fmtLong(p.eventAt, timeZone) : null;
  const link = p.href;
  const meta = p.meta && p.meta !== kindLabel(p.kind) ? `${p.meta}.` : null;
  const parts: Record<PostAs, Array<string | null>> = {
    artwork: [p.excerpt || null, meta, link ? `See it: ${link}` : null],
    writing: [p.excerpt || null, link ? `Read it: ${link}` : null],
    video: [p.excerpt || null, link ? `Watch: ${link}` : null],
    series: [when ? `Starts ${when}.` : null, p.excerpt || null, link ? `Join: ${link}` : null],
    meeting: [when ? `${when}.` : null, p.excerpt || null, link ? `Details: ${link}` : null],
  };
  return parts[kind].filter(Boolean).join("\n\n");
}

/**
 * New post (1d): cross-post work that already exists. Shared text on top,
 * each outlet as a live preview beside the others, with its own edit.
 *
 * Save draft writes a Studio post (social_posts) so the same draft opens in
 * the Studio's Post editor. "Publish to N places" first shows exactly what
 * each account will get and in what order, with a checkbox per account; only
 * "Post now" sends, through the Studio's own send path. The first post that
 * goes out also puts it on the site (the Studio's mirror), so Website is not
 * a separate switch.
 */
export function NewPost({ about }: { about: string | null }) {
  const { model, piece: find, href, scopeOrg, openLibrary } = useChannel();
  const [aboutKey, setAboutKey] = React.useState<string | null>(about && find(about) ? about : null);
  const piece: Piece | undefined = aboutKey ? find(aboutKey) : undefined;
  const ig = model.outlets.find((o) => o.id === "instagram");
  const fb = model.outlets.find((o) => o.id === "facebook");

  const [postAs, setPostAs] = React.useState<PostAs>(postAsFor(piece));
  const [title, setTitle] = React.useState(piece?.title ?? "");
  const [body, setBody] = React.useState(() => template(postAsFor(piece), piece, model.timeZone));
  // The last text Channel wrote: replaced on a new piece or kind only while the person has not edited it.
  const lastTemplate = React.useRef(body);
  const lastTitle = React.useRef(title);

  function restart(nextPiece: Piece | undefined, nextKind: PostAs) {
    const t = template(nextKind, nextPiece, model.timeZone);
    if (body === lastTemplate.current || !body.trim()) setBody(t);
    lastTemplate.current = t;
    if (title === lastTitle.current || !title.trim()) {
      setTitle(nextPiece?.title ?? "");
      lastTitle.current = nextPiece?.title ?? "";
    }
  }

  function chooseAbout(key: string | null) {
    const next = key ? find(key) : undefined;
    setAboutKey(next ? key : null);
    const kind = postAsFor(next);
    setPostAs(kind);
    restart(next, kind);
    const u = new URL(window.location.href);
    if (next && key) u.searchParams.set("about", key);
    else u.searchParams.delete("about");
    window.history.replaceState(window.history.state, "", u.pathname + u.search);
  }
  const [on, setOn] = React.useState<Record<Col, boolean>>({ site: true, instagram: Boolean(ig?.connected) && ig?.left !== 0, facebook: Boolean(fb?.connected) });
  const [over, setOver] = React.useState<{ instagram: string | null; facebook: string | null }>({ instagram: null, facebook: null });
  const [editing, setEditing] = React.useState<Col | null>(null);
  const [postId, setPostId] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<{ steps: DryRunStep[]; live: boolean } | null>(null);
  const [targets, setTargets] = React.useState<PublishTarget[] | null>(null);
  const [chosen, setChosen] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<PublishResult[] | null>(null);
  // The review and the results open below the previews: bring them into view.
  const panel = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (plan || results) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [plan, results]);
  const [tab, setTab] = React.useState<Col>("site"); // phone review tabs (1e)

  const shared = `${title ? `${title}\n\n` : ""}${body}`.trim();
  const igText = linkInBio(over.instagram ?? shared);
  const fbText = over.facebook ?? shared;
  // Website goes with the first social post (the Studio's mirror), so it counts only alongside
  // one; a post about a piece links to the piece's own page instead (no second copy).
  const socials = (["instagram", "facebook"] as Col[]).filter((k) => on[k]).length;
  const count = socials ? socials + (piece?.href ? 0 : 1) : 0;
  const images = piece?.imageUrl ? [{ url: piece.imageUrl, alt: piece.title }] : [];

  const input = () => ({
    postId,
    pieceKey: piece?.key ?? null,
    scopeOrg,
    title,
    body,
    link: piece?.href ?? null,
    images,
    outlets: on,
    overrides: over,
  });

  async function save() {
    setBusy(true);
    setError(null);
    const r = await saveNewPostAction(input());
    setBusy(false);
    if (r.ok === false) return setError(r.error);
    setPostId(r.postId);
    setSavedAt(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: model.timeZone }).format(new Date()));
  }

  /** Step 1: show exactly what goes where, with a checkbox per account. Sends nothing. */
  async function review() {
    // Accounts that already took this post are not ticked again.
    const sent = new Set((results ?? []).filter((x) => x.ok).map((x) => x.targetId));
    setBusy(true);
    setError(null);
    setResults(null);
    const [r, t] = await Promise.all([
      dryRunPublishAction({ ...input(), accounts: { instagram: ig?.accounts[0] ?? null, facebook: fb?.accounts[0] ?? null, site: piece?.siteHost ?? model.identities[0]?.siteHost ?? null } }),
      listPublishTargetsAction(scopeOrg),
    ]);
    setBusy(false);
    if (r.ok === false) return setError(r.error);
    if (t.ok === false) return setError(t.error);
    setPlan({ steps: r.steps, live: r.live });
    setTargets(t.targets);
    // One account per outlet that is on, the first that can take it.
    const pick = new Set<string>();
    for (const o of ["instagram", "facebook"] as const) {
      if (!on[o]) continue;
      const first = t.targets.find((x) => x.outlet === o && !x.disabledReason && !sent.has(x.id));
      if (first) pick.add(first.id);
    }
    setChosen(pick);
  }

  /** Step 2: post to the ticked accounts, through the Studio's send path. */
  async function postNow() {
    if (chosen.size === 0) return;
    setBusy(true);
    setError(null);
    const r = await publishNewPostAction({ ...input(), targetIds: [...chosen] });
    setBusy(false);
    if (r.ok === false) return setError(r.error);
    setPostId(r.postId);
    setResults(r.results);
    setPlan(null);
    // A second try goes only to the accounts that failed (the server also skips the rest).
    setChosen(new Set(r.results.filter((x) => !x.ok).map((x) => x.targetId)));
  }

  const column = (c: Col) => {
    const outlet = model.outlets.find((o) => o.id === c);
    const disabled = c === "site" || (c === "instagram" && ig?.left === 0);
    const status =
      c === "site"
        ? piece?.href
          ? `Already on ${piece.siteName === "Your page" ? "your page" : piece.siteName}; the posts link to it`
          : `${scopeOrg ? "The org's feed" : "Your page"} · goes up with the first post`
        : c === "instagram"
          ? outlet?.connected
            ? `${outlet.accounts[0] ?? "Instagram"} · ${ig?.left ?? 25} of 25 left today`
            : "Not connected"
          : outlet?.connected
            ? `${outlet.accounts[0] ?? "Facebook"} · ${piece?.href ? "its preview reads the piece's page" : "a text post"}`
            : "Not connected";
    const editedNote =
      c === "instagram"
        ? [igText.swapped ? "link replaced with “link in bio”" : null, over.instagram !== null ? "text edited" : null].filter(Boolean).join(", ")
        : c === "facebook"
          ? [piece?.href ? "link shown as a preview card" : null, over.facebook !== null ? "text edited" : null].filter(Boolean).join(", ")
          : "";
    return (
      <section key={c} className="chn-np-col" data-off={on[c] ? "0" : "1"} data-tab={tab === c ? "1" : "0"}>
        <header>
          <OutletIcon outlet={c} size={17} />
          <strong>{c === "site" ? "Website" : c === "instagram" ? "Instagram" : "Facebook"}</strong>
          <label className="chn-toggle">
            <input type="checkbox" checked={on[c]} disabled={disabled || !outlet?.connected} onChange={(e) => setOn((v) => ({ ...v, [c]: e.target.checked }))} />
            <span>{c === "site" ? (piece?.href ? "Linked" : "With the first post") : on[c] ? "On" : "Off"}</span>
          </label>
        </header>
        <p className="chn-quiet">{c === "instagram" && ig?.left === 0 ? "Daily limit reached (counted from this platform's posts)" : status}</p>
        {c === "site" ? (
          <figure className="chn-preview" data-outlet="site">
            <small className="chn-kicker is-accent">{POST_AS.find((k) => k.id === postAs)?.label ?? "Post"}</small>
            <h3>{title || "Untitled"}</h3>
            {piece?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={piece.imageUrl} alt="" />
            ) : null}
            <p>{body}</p>
          </figure>
        ) : (
          <PreviewCard outlet={c} account={outlet?.accounts[0] ?? (c === "instagram" ? "Instagram" : "Facebook")} text={c === "instagram" ? igText.text : fbText} piece={piece} quote={null} />
        )}
        {c === "site" ? (
          <small className="chn-quiet">Same as shared text</small>
        ) : (
          <>
            {editedNote && (
              <small className="chn-edited">
                <Pencil size={12} aria-hidden /> Edited here: {editedNote}
              </small>
            )}
            {editing === c ? (
              <div className="chn-field">
                <label className="chn-sr" htmlFor={`np-${c}`}>
                  Text for {c}
                </label>
                <textarea id={`np-${c}`} rows={5} maxLength={c === "instagram" ? INSTAGRAM_RULES.captionMax : 63_000} value={over[c] ?? shared} onChange={(e) => setOver((v) => ({ ...v, [c]: e.target.value }))} />
                <div className="chn-actions">
                  <button type="button" className="chn-linkbtn" onClick={() => setEditing(null)}>
                    Done
                  </button>
                  <button
                    type="button"
                    className="chn-linkbtn"
                    onClick={() => {
                      setOver((v) => ({ ...v, [c]: null }));
                      setEditing(null);
                    }}
                  >
                    Use the shared text
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="chn-linkbtn" onClick={() => setEditing(c)}>
                Edit for {c === "instagram" ? "Instagram" : "Facebook"}
              </button>
            )}
          </>
        )}
      </section>
    );
  };

  return (
    <div className="chn-page chn-np">
      <nav className="chn-crumbs" aria-label="Breadcrumb">
        <Link href={href(CHANNEL_BASE)}>Channel</Link>
        {piece && (
          <>
            {" "}
            / <Link href={href(CHANNEL_BASE, { piece: piece.key })}>{piece.title}</Link>
          </>
        )}{" "}
        / <span aria-current="page">New post</span>
      </nav>
      <header className="chn-head">
        <h1>New post</h1>
        <div className="chn-actions">
          {savedAt && <small className="chn-quiet">Saved {savedAt}</small>}
          <button type="button" className="chn-btn" disabled={busy || !shared} onClick={save}>
            Save draft
          </button>
          <button type="button" className="chn-btn is-primary" disabled={busy || count === 0 || !shared} onClick={review}>
            {count === 0 ? "Choose where to publish" : `Publish to ${count} ${count === 1 ? "place" : "places"}`}
          </button>
        </div>
      </header>
      <p className="chn-quiet chn-np-note">Nothing goes out until you confirm: the next step lists each account and the exact text it gets. Posts go through your own connected accounts; in an org's channel, only the org's own channels.</p>
      {error && (
        <p className="chn-banner is-alert" role="alert">
          {error}
        </p>
      )}

      <section className="chn-np-shared" aria-label="Shared text">
        {piece?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={piece.imageUrl} alt="" className="chn-np-cover" />
        ) : (
          <span className="chn-np-cover is-empty" aria-hidden>
            {piece ? kindGlyph(piece.kind) : "✎"}
          </span>
        )}
        <div>
          <div className="chn-np-about">
            <span className="chn-kicker">About</span>
            {piece ? (
              <span className="chn-np-piece">
                <Thumb piece={piece} size={28} />
                <strong>{piece.title}</strong>
                <small>
                  {kindGlyph(piece.kind)} {kindLabel(piece.kind)}
                  {piece.inMotion ? ` · ${piece.inMotion.reason}` : ""}
                </small>
              </span>
            ) : (
              <span className="chn-quiet">Not about a piece yet</span>
            )}
            <button type="button" className="chn-linkbtn" onClick={() => openLibrary(aboutKey, (key) => chooseAbout(key))}>
              <ArrowLeftRight size={13} aria-hidden /> {piece ? "Change" : "Choose a piece"}
            </button>
            {piece && (
              <button type="button" className="chn-linkbtn" onClick={() => chooseAbout(null)}>
                Clear
              </button>
            )}
          </div>
          <div className="chn-np-as">
            <span className="chn-kicker">Post as</span>
            <div className="chn-seg is-small" role="group" aria-label="Post as">
              {POST_AS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={postAs === k.id}
                  onClick={() => {
                    setPostAs(k.id);
                    restart(piece, k.id);
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
            {(postAs === "writing" || postAs === "video") && (
              <a className="chn-link" href={postAs === "writing" ? model.links.writing : model.links.video}>
                {postAs === "writing" ? "Longer writing? Write it in the Studio" : "Make a clip in the Studio"} <ExternalLink size={12} aria-hidden />
              </a>
            )}
          </div>
          <p className="chn-kicker is-accent">
            Shared text <span className="chn-quiet">Every outlet below starts from this. Edit one and the rest keep the shared version.</span>
          </p>
          <label className="chn-sr" htmlFor="np-title">
            Title
          </label>
          <input id="np-title" className="chn-np-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} />
          <label className="chn-sr" htmlFor="np-body">
            Text
          </label>
          <textarea id="np-body" className="chn-np-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What is it, and where can people see it?" />
          <small className="chn-quiet">
            {piece ? (
              <>
                {kindGlyph(piece.kind)} {kindLabel(piece.kind)} · {images.length} {images.length === 1 ? "image" : "images"} ·{" "}
              </>
            ) : null}
            {postId ? <a href={`/studio?kind=post&id=${encodeURIComponent(postId)}${scopeOrg ? `&org=${encodeURIComponent(scopeOrg)}` : ""}`}>Open the full editor</a> : "Save a draft to open it in the full editor"}
          </small>
        </div>
      </section>

      <div className="chn-np-tabs" role="group" aria-label="Review each outlet">
        {(["site", "instagram", "facebook"] as Col[]).map((c) => (
          <button key={c} type="button" aria-pressed={tab === c} onClick={() => setTab(c)}>
            {c === "site" ? "Site" : c === "instagram" ? "Instagram" : "Facebook"}
          </button>
        ))}
      </div>
      <div className="chn-np-cols">{(["site", "instagram", "facebook"] as Col[]).map(column)}</div>

      {plan && targets && (
        <section className="chn-dryrun" aria-labelledby="chn-dry-h" ref={panel}>
          <h2 id="chn-dry-h" className="chn-kicker">
            Check before it goes out
          </h2>
          <ol>
            {plan.steps.map((st) => {
              const accounts = st.outlet === "site" ? [] : targets.filter((t) => t.outlet === st.outlet);
              return (
                <li key={st.outlet}>
                  <OutletIcon outlet={st.outlet} size={15} />{" "}
                  <strong>{st.outlet === "site" ? `Website: ${st.account}, with the first post that goes out` : st.outlet === "instagram" ? "Instagram" : "Facebook"}</strong>
                  {st.outlet !== "site" && (
                    <div className="chn-dry-accounts">
                      {accounts.length === 0 ? (
                        <small className="is-alert">No account to post through. Connect one under Outlets.</small>
                      ) : (
                        accounts.map((t) => (
                          <label key={t.id} className="chn-check">
                            <input
                              type="checkbox"
                              checked={chosen.has(t.id)}
                              disabled={Boolean(t.disabledReason) || busy}
                              onChange={(e) =>
                                setChosen((v) => {
                                  const n = new Set(v);
                                  if (e.target.checked) n.add(t.id);
                                  else n.delete(t.id);
                                  return n;
                                })
                              }
                            />
                            {t.label}
                            {t.disabledReason && <small> · {t.disabledReason}</small>}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  <pre>{st.text}</pre>
                  {st.notes.length > 0 && (
                    <ul>
                      {st.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="chn-actions">
            <button type="button" className="chn-btn is-primary" disabled={busy || chosen.size === 0} onClick={postNow}>
              {busy ? "Posting…" : chosen.size === 0 ? "Tick an account" : `Post now to ${chosen.size} ${chosen.size === 1 ? "account" : "accounts"}`}
            </button>
            <button type="button" className="chn-btn" disabled={busy} onClick={() => setPlan(null)}>
              Not yet
            </button>
            <small className="chn-quiet">Order: Instagram, then Facebook, then Threads; Facebook's preview reads the piece's own page. A failure on one does not stop the others, and a second try skips the accounts that already have it.</small>
          </div>
        </section>
      )}

      {results && (
        <section className="chn-dryrun" aria-labelledby="chn-res-h" role="status" ref={panel}>
          <h2 id="chn-res-h" className="chn-kicker">
            Posted
          </h2>
          <ul className="chn-plain">
            {results.map((r) => (
              <li key={r.targetId} className={r.ok ? undefined : "is-alert"}>
                {r.ok ? <Check size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />} {r.label}:{" "}
                {r.ok ? (
                  r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      see the post <ExternalLink size={11} aria-hidden />
                    </a>
                  ) : (
                    "posted"
                  )
                ) : (
                  r.error
                )}
              </li>
            ))}
          </ul>
          {results.some((r) => r.ok) && (
            <p className="chn-quiet">
              {piece?.href ? "The posts link to the piece's own page." : `The first post also put it on ${scopeOrg ? "the org's feed" : "your page"}.`} It shows on the timeline after a refresh.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
