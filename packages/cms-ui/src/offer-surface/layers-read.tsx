"use client";

import * as React from "react";
import { LayerCtx, useSurface } from "../surface/context";
import { OfferFrame, KIND_VAR } from "./OfferFrame";
import { SurfaceIcon } from "./icons";
import { useOfferEnv } from "./env";
import { offerDescriptor, type OfferProps } from "./descriptor";
import { Avatar } from "./parts";
import { useJoinGate } from "./layers-join";
import { ProfileHoverCard, profileLayerFor } from "./layers-people";
import type { SurfaceWritingPiece } from "./types";
import type { TemplateData, TemplatePiece } from "./templates/types";

// Reading and talk layers (lane C). Import ./layers-read.css with the other offer styles.
//   wr-read: packet "Offer Surface" isRead: series kicker, italic standfirst, author row,
//            first paragraph with a drop cap, picture, the rest of the text, pull quote,
//            "In this series" index. Head: Aa +/-. Foot: Open the talk, quiet Next
//            (replaces the piece in place).
//   talk:    comments (24px avatar, name, mono time, text), host ring + HOST tag, composer.
//            Posts live in local state only (no action is wired).
//   WritingStage: wr-read docked into a page (frames 3b / 4c): no close button, a strip of
//            piece cards, "Open the talk" pushes onto the stage's own stack.
// `props.key` is the piece key for wr-read, and the piece key (or offer key) for talk.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function dayMonth(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}
const two = (n: number) => String(n).padStart(2, "0");

/** Pieces of the site: the template data's `pieces` when present, else `writing`. */
function usePieces(): TemplatePiece[] {
  const env = useOfferEnv();
  const d = env.data as Partial<TemplateData>;
  return React.useMemo(() => (d.pieces?.length ? d.pieces : (env.data.writing as SurfaceWritingPiece[])) as TemplatePiece[], [d.pieces, env.data.writing]);
}

function findPiece(pieces: TemplatePiece[], key?: string): TemplatePiece | undefined {
  return pieces.find((p) => p.key === key) ?? pieces[0];
}

function repliesOf(piece: TemplatePiece, env: ReturnType<typeof useOfferEnv>): number {
  const d = env.data as Partial<TemplateData>;
  return Math.max(piece.replies?.length ?? 0, d.extras?.talkCount ?? 0);
}

/**
 * A person's name inside a reading layer. In a popup or sheet it PUSHES that person's profile
 * layer (the crumb leads back); on the docked stage there is no layer, so it opens one over the
 * page. On a desktop pointer the hover card shows after a pause (PersonName's behaviour).
 */
function Person({ id, children }: { id: string; children: React.ReactNode }) {
  const env = useOfferEnv();
  const { open, push } = useSurface();
  const inLayer = React.useContext(LayerCtx) != null;
  const who = env.findProfile(id);
  const [shown, setShown] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  React.useEffect(() => clear, []);
  const go = (el?: HTMLElement) => {
    setShown(false);
    const d = offerDescriptor(profileLayerFor(env.data, id), id);
    if (inLayer) push(d);
    else open(d, el ?? null);
  };
  return (
    <span
      className="osf-pn"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        clear();
        timer.current = setTimeout(() => setShown(true), 380);
      }}
      onPointerLeave={() => {
        clear();
        timer.current = setTimeout(() => setShown(false), 160);
      }}
      onKeyDown={(e) => e.key === "Escape" && setShown(false)}
    >
      <button type="button" className="osf-namelink" onClick={(e) => go(e.currentTarget)}>
        {children}
      </button>
      {shown && who && (
        <ProfileHoverCard
          profile={who}
          onProfile={(el) => go(el)}
          onFollow={(el) => {
            setShown(false);
            open(offerDescriptor(env.isFollowing(id) ? "pf-owner" : "follow", id, env.isFollowing(id) ? undefined : { flow: "fol" }), el);
          }}
        />
      )}
    </span>
  );
}

// ── reading body (shared by the popup and the docked stage) ────────────────

/** The first paragraph, and the paragraphs after it (the picture sits between them). */
function splitBody(html: string): [string, string] {
  const i = html.indexOf("</p>");
  if (i < 0) return [html, ""];
  return [html.slice(0, i + 4), html.slice(i + 4)];
}

function ReadBody({ piece, pieces, big, onPick }: { piece: TemplatePiece; pieces: TemplatePiece[]; big: boolean; onPick: (p: TemplatePiece) => void }) {
  const env = useOfferEnv();
  const owner = env.data.owner;
  const series = piece.series ? pieces.filter((p) => p.series === piece.series) : [];
  const [first, rest] = piece.bodyHtml ? splitBody(piece.bodyHtml) : ["", ""];
  const meta = [dayMonth(piece.date), piece.minutes ? `${piece.minutes} MIN` : ""].filter(Boolean).join(" · ");
  return (
    <>
      {piece.series && <span className="osf-rd-series">{piece.series}{piece.n ? ` · ${piece.n} of ${piece.total ?? series.length}` : ""}</span>}
      {piece.standfirst && <div className="osf-rd-stand">{piece.standfirst}</div>}
      <div className="osf-rd-by">
        <Avatar src={owner.portrait} size={22} />
        <Person id={owner.id}>{owner.name}</Person>
        <span className="osf-rd-meta">{meta}</span>
      </div>
      {/* Trusted sample HTML; the host must pass sanitised HTML. */}
      {first ? <div className={`osf-rd-text is-first${big ? " is-big" : ""}`} dangerouslySetInnerHTML={{ __html: first }} /> : <p className="osf-note">This piece has no text yet.</p>}
      <div className="osf-rd-pic osf-ph">{piece.picture ? <img src={piece.picture} alt="" /> : "picture"}</div>
      {rest && <div className={`osf-rd-text${big ? " is-big" : ""}`} dangerouslySetInnerHTML={{ __html: rest }} />}
      {piece.pullQuote && <div className="osf-rd-pull">“{piece.pullQuote}”</div>}
      {series.length > 1 && (
        <>
          <span className="osf-label is-ruled">In this series</span>
          {series.map((p, i) => (
            <button key={p.key} type="button" className={`osf-rd-row${p.key === piece.key ? " is-now" : ""}`} onClick={() => p.key !== piece.key && onPick(p)}>
              <span className="osf-rd-n">{two(p.n ?? series.length - i)}</span>
              <span className="osf-rd-t">{p.title}</span>
              <span className="osf-rd-m">{p.minutes ? `${p.minutes} MIN` : ""}</span>
            </button>
          ))}
        </>
      )}
    </>
  );
}

// ── talk body ───────────────────────────────────────────────────────────────

interface Comment {
  name: string;
  ago: string;
  text: string;
  host?: boolean;
  photo?: boolean;
}

/**
 * Comments of ONE thing, keyed by what the talk was opened for (a piece, or an offer). `known` says the key
 * names something on this site. The seed is local: the piece's own replies; otherwise, only on the sandbox
 * site (slug "sample") for a thing that exists, three sample comments; otherwise nothing (an empty state).
 * Never another item's comments. The real forum wiring is a later round.
 */
function useComments(piece: TemplatePiece | undefined, known: boolean = Boolean(piece)) {
  const env = useOfferEnv();
  const owner = env.data.owner;
  const sample = env.data.site.slug === "sample";
  const seed = React.useMemo<Comment[]>(() => {
    const given = (piece?.replies ?? []).map((r) => ({ ...r, host: r.name === owner.name }));
    if (given.length) return given;
    if (!known || !sample) return [];
    return [
      { name: "Name", ago: "2h", text: "Looking forward to this one." },
      { name: "Name", ago: "5h", text: "From last time.", photo: true },
      { name: owner.name, ago: "1d", text: "Thanks for reading. Replies are open.", host: true },
    ];
  }, [piece, known, sample, owner.name]);
  const [extra, setExtra] = React.useState<Comment[]>([]);
  const [text, setText] = React.useState("");
  const all = [...seed, ...extra];
  const post = () => {
    const t = text.trim();
    if (!t) return;
    // Local state only: no action is wired.
    setExtra((e) => [...e, { name: env.data.viewer?.name || "You", ago: "now", text: t }]);
    setText("");
  };
  return { all, text, setText, post };
}

function TalkBody({ all, text, setText, post }: ReturnType<typeof useComments>) {
  const env = useOfferEnv();
  const owner = env.data.owner;
  return (
    <>
      {all.length === 0 && <p className="osf-note">No replies here yet. Be the first to say something.</p>}
      {all.map((c, i) => (
        <div key={i} className={`osf-tk-c${i > 0 ? " is-ruled" : ""}`}>
          <Avatar src={c.host ? owner.portrait : null} size={24} ring={c.host} />
          <div className="osf-tk-b">
            <span className="osf-tk-h">
              <Person id={c.host ? owner.id : c.name}>{c.name}</Person>{" "}
              <span className={`osf-tk-time${c.host ? " is-host" : ""}`}>{c.host ? `· HOST · ${c.ago.toUpperCase()}` : `· ${c.ago.toUpperCase()}`}</span>
            </span>
            <span className="osf-tk-t">{c.text}</span>
            {c.photo && <div className="osf-tk-photo osf-ph">photo</div>}
          </div>
        </div>
      ))}
      <div className="osf-tk-compose">
        <input className="osf-tk-in" value={text} placeholder="Say something…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} />
        <button type="button" className="osf-tk-photobtn" aria-disabled="true">Photo</button>
      </div>
    </>
  );
}

// ── wr-read ─────────────────────────────────────────────────────────────────

export function WrRead({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push, replace } = useSurface();
  const pieces = usePieces();
  const [big, setBig] = React.useState(false);
  const piece = findPiece(pieces, props.key);
  const top = React.useRef<HTMLSpanElement>(null);
  // A new piece starts at the top of the text. The frame itself does not move or animate.
  React.useEffect(() => {
    const body = top.current?.closest<HTMLElement>(".osf-body");
    if (body) body.scrollTop = 0;
  }, [piece?.key]);
  if (!piece) {
    return (
      <OfferFrame gk="wr" kicker="Writing" title="Writing">
        <p className="osf-note">This piece is not available any more.</p>
      </OfferFrame>
    );
  }
  const i = pieces.findIndex((p) => p.key === piece.key);
  const next = pieces[(i + 1) % pieces.length];
  const replies = repliesOf(piece, env);
  return (
    <OfferFrame
      gk="wr"
      kicker="Writing"
      title={piece.title}
      picture={piece.cover ?? piece.picture}
      status={[piece.minutes ? `${piece.minutes} min` : "", `${replies} replies`].filter(Boolean).join(" · ")}
      primary={{ label: "Open the talk", onClick: () => push(offerDescriptor("talk", piece.key)) }}
      quiet={next && next.key !== piece.key ? { label: "Next ›", onClick: () => replace(offerDescriptor("wr-read", next.key)) } : undefined}
      headAction={{ icon: "Aa", label: big ? "−" : "+", onClick: () => setBig((b) => !b) }}
    >
      <span ref={top} className="osf-rd-top" aria-hidden />
      <ReadBody piece={piece} pieces={pieces} big={big} onPick={(p) => replace(offerDescriptor("wr-read", p.key))} />
    </OfferFrame>
  );
}

// ── talk ────────────────────────────────────────────────────────────────────

export function Talk({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const pieces = usePieces();
  // Exactly what the talk was opened for: a piece, else an offer. No fallback to another item.
  const piece = props.key ? pieces.find((p) => p.key === props.key) : undefined;
  const known = Boolean(piece) || Boolean(env.findOffer(props.key));
  const c = useComments(piece, known);
  // Decision 12: anyone reads, posting needs an account. Signed out, Post asks for one; back here, the post is made.
  const { gate, ask } = useJoinGate("post", props.key, undefined, c.post);
  const post = gate ? () => { if (c.text.trim()) ask(); } : c.post;
  return (
    <OfferFrame gk="talk" kicker="Talk" title={`Talk · ${c.all.length}`} status="Anyone can read" primary={{ label: "Post", onClick: post, disabled: !c.text.trim() }}>
      <TalkBody {...c} post={post} />
    </OfferFrame>
  );
}

// ── docked stage (frames 3b / 4c) ──────────────────────────────────────────

/**
 * wr-read docked into a page: no close button, ‹ › between pieces, a strip of piece cards
 * under it. "Open the talk" pushes talk onto the stage's own stack; the crumb leads back.
 */
export function WritingStage({ startKey }: { startKey?: string }) {
  const env = useOfferEnv();
  const pieces = usePieces();
  const [key, setKey] = React.useState(startKey ?? pieces[0]?.key);
  const [talk, setTalk] = React.useState(false);
  const [big, setBig] = React.useState(false);
  const piece = findPiece(pieces, key);
  const c = useComments(piece);
  const body = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [piece?.key, talk]);
  if (!piece) return null;
  const i = pieces.findIndex((p) => p.key === piece.key);
  const pick = (k: string) => {
    setTalk(false);
    setKey(k);
  };
  const go = (d: number) => pick(pieces[(i + d + pieces.length) % pieces.length]!.key);
  const next = pieces[(i + 1) % pieces.length];
  const gk = talk ? "talk" : "wr";
  const kv = `var(--os-kind-${KIND_VAR[gk]})`;
  const set = env.data.look.icons;
  return (
    <div className="osf-stage">
      <div className="osf-stage-bar">
        <span className="osf-stage-kick">Writing{piece.series ? ` · ${piece.series}` : ""}</span>
        <span className="osf-stage-walk">‹ › WALK · ESC POPS</span>
      </div>
      <div className="osf-stage-row">
        <button type="button" className="osf-stage-arrow" onClick={() => go(-1)} aria-label="Previous piece">‹</button>
        <div className="osf-stage-card" style={{ ["--osf-kc" as string]: kv }}>
          <div className="osf-layer" data-mark="box" key={talk ? "talk" : piece.key}>
            <header className="osf-head">
              <span className="osf-mk osf-mk-box" aria-hidden>
                <SurfaceIcon kind={gk} set={set} size={17} />
              </span>
              <div className="osf-heads">
                <div className="osf-kicker">
                  {talk && (
                    <>
                      <button type="button" className="osf-crumb" onClick={() => setTalk(false)}>‹ {piece.title}</button>
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <span>{talk ? "Talk" : "Writing"}</span>
                </div>
                <h2 className="osf-title">{talk ? `Talk · ${c.all.length}` : piece.title}</h2>
              </div>
              <div className="osf-ctl">
                {!talk && (
                  <button type="button" className="osf-hbtn" onClick={() => setBig((b) => !b)} aria-label="Text size">
                    <span className="osf-ha-icon" aria-hidden>Aa</span>
                    <span className="osf-ha-text">Aa {big ? "−" : "+"}</span>
                  </button>
                )}
              </div>
            </header>
            <div className="osf-body osf-stage-body" ref={body}>
              {talk ? <TalkBody {...c} /> : <ReadBody piece={piece} pieces={pieces} big={big} onPick={(p) => pick(p.key)} />}
            </div>
            <footer className="osf-foot">
              <span className="osf-status">{talk ? "Anyone can read" : [piece.minutes ? `${piece.minutes} min` : "", `${repliesOf(piece, env)} replies`].filter(Boolean).join(" · ")}</span>
              <div className="osf-btns">
                {!talk && next && next.key !== piece.key && (
                  <button type="button" className="osf-btn osf-btn-quiet" onClick={() => pick(next.key)}>Next ›</button>
                )}
                {talk ? (
                  <button type="button" className="osf-btn osf-btn-primary" disabled={!c.text.trim()} onClick={c.post}>Post</button>
                ) : (
                  <button type="button" className="osf-btn osf-btn-primary" onClick={() => setTalk(true)}>Open the talk</button>
                )}
              </div>
            </footer>
          </div>
        </div>
        <button type="button" className="osf-stage-arrow" onClick={() => go(1)} aria-label="Next piece">›</button>
      </div>
      <div className="osf-stage-strip" role="list" style={{ gridTemplateColumns: `repeat(${Math.min(pieces.length, 4)}, minmax(0, 1fr))` }}>
        {pieces.map((p, n) => (
          <button key={p.key} type="button" role="listitem" className={`osf-stage-chip${p.key === piece.key ? " is-on" : ""}`} onClick={() => pick(p.key)}>
            <span className="osf-stage-thumb osf-ph" />
            <span className="osf-stage-chipb">
              <span className="osf-stage-n">{two(p.n ?? pieces.length - n)}</span>
              <span className="osf-stage-t">{p.title}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
