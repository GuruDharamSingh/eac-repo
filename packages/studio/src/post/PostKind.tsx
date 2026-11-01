'use client';

// ============================================================================
// The Studio's Post kind (2026-10-31): write a post for Facebook, Instagram
// and Threads, add pictures, see each platform's rendering, post it to a
// connected account. One text serves every platform unless a platform gets
// its own in the settings column. Registered by the host as a StudioExtension
// (postExtension in ./index.ts), like Video.
//
// Layout: drawer = the posts; main = the text, pictures, link and the three
// previews; settings = where to post, per-platform text, delete.
// ============================================================================

import * as React from 'react';
import { StudioColumns, StudioTopActions, StudioTopStatus, useStudioFrame } from '../frame';
import type { StudioShare, StudioShareTarget } from '../types';
import { POST_LIMITS, POST_PLATFORM_LABEL, type PostImage, type PostKindProps, type PostPlatform, type SocialPostView } from './types';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const isJpeg = (url: string) => /\.jpe?g($|\?)/i.test(url);

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** The text a platform gets: its own, else the shared one. */
function textFor(post: SocialPostView, platform: PostPlatform): string {
  return post.variants[platform]?.text?.trim() ? post.variants[platform]!.text! : post.body;
}

function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

/** What stops a target from taking this post right now. */
function blocker(post: SocialPostView, kind: StudioShareTarget['kind']): string | null {
  const platform: PostPlatform = kind === 'page' ? 'facebook' : kind;
  const text = textFor(post, platform);
  if (!text.trim() && post.images.length === 0) return 'Write something or add a picture first.';
  if (text.length > POST_LIMITS[platform]) return `${POST_PLATFORM_LABEL[platform]} takes ${POST_LIMITS[platform].toLocaleString()} characters.`;
  if (platform === 'instagram') {
    if (post.images.length === 0) return 'Instagram needs a picture.';
    if (!isJpeg(post.images[0]!.url)) return 'Instagram takes JPEG pictures only; the first picture is not one.';
  }
  return null;
}

export function PostKind(props: PostKindProps) {
  const frame = useStudioFrame();
  const { actions, uploadEndpoint, links } = props;
  const orgId = frame.orgId;
  const setError = frame.setError;
  const [posts, setPosts] = React.useState<SocialPostView[]>(props.initialPosts);
  const [current, setCurrent] = React.useState<SocialPostView | null>(
    props.initialPosts.find((p) => p.id === props.initialPostId) ?? null
  );
  const [save, setSave] = React.useState<SaveState>('saved');
  const [uploading, setUploading] = React.useState(0);
  const [targets, setTargets] = React.useState<StudioShareTarget[] | null>(null);
  const [posting, setPosting] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [ownText, setOwnText] = React.useState<Record<PostPlatform, boolean>>({ facebook: false, instagram: false, threads: false });
  const timer = React.useRef<number | null>(null);
  const pending = React.useRef<Partial<SocialPostView>>({});

  // The list follows the acting org.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    actions.listPosts(orgId).then((list) => {
      setPosts(list);
      setCurrent(null);
    }).catch(() => setError('Could not load your posts.'));
  }, [orgId, actions, setError]);

  React.useEffect(() => {
    actions.listShareTargets().then(setTargets).catch(() => setTargets([]));
  }, [actions]);

  React.useEffect(() => {
    if (!current) return;
    setOwnText({
      facebook: Boolean(current.variants.facebook?.text),
      instagram: Boolean(current.variants.instagram?.text),
      threads: Boolean(current.variants.threads?.text),
    });
    setNote(null);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: edits merge into `pending` and flush 700 ms after the last one.
  const flush = React.useCallback(async () => {
    if (!current) return;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    setSave('saving');
    const r = await actions.savePost(current.id, patch).catch(() => ({ ok: false as const, error: 'Could not reach the server.' }));
    if (r.ok === false) {
      setSave('error');
      setError(r.error);
      return;
    }
    setSave(Object.keys(pending.current).length ? 'dirty' : 'saved');
    setPosts((list) => list.map((p) => (p.id === r.value.id ? { ...r.value, shares: p.shares } : p)));
  }, [current, actions, setError]);

  const edit = React.useCallback(
    (patch: Partial<Pick<SocialPostView, 'title' | 'body' | 'link' | 'images' | 'variants'>>) => {
      if (!current) return;
      setCurrent((c) => (c ? { ...c, ...patch } : c));
      pending.current = { ...pending.current, ...patch };
      setSave('dirty');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 700);
    },
    [current, flush]
  );
  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  async function newPost() {
    const r = await actions.createPost(orgId).catch(() => ({ ok: false as const, error: 'Could not reach the server.' }));
    if (r.ok === false) return setError(r.error);
    setPosts((list) => [r.value, ...list]);
    setCurrent(r.value);
  }

  async function remove() {
    if (!current || !window.confirm('Delete this post? Anything already posted outside stays there.')) return;
    const r = await actions.archivePost(current.id).catch(() => ({ ok: false as const, error: 'Could not reach the server.' }));
    if (r.ok === false) return setError(r.error);
    setPosts((list) => list.filter((p) => p.id !== current.id));
    setCurrent(null);
  }

  async function addFiles(files: FileList | null) {
    if (!current || !files || files.length === 0) return;
    const orgSlug = frame.orgs.find((o) => o.orgId === orgId)?.slug ?? orgId;
    const room = 10 - current.images.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length === 0) return setError('A post takes up to ten pictures.');
    setUploading((n) => n + picked.length);
    const added: PostImage[] = [];
    for (const file of picked) {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('orgSlug', orgSlug);
      fd.set('context', 'social');
      try {
        const res = await fetch(uploadEndpoint, { method: 'POST', body: fd });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) setError(data.error ?? `Upload failed (${res.status}).`);
        else added.push({ url: data.url, alt: null });
      } catch {
        setError('Upload failed: connection lost.');
      }
      setUploading((n) => n - 1);
    }
    if (added.length) edit({ images: [...(current.images ?? []), ...added] });
  }

  function removeImage(i: number) {
    if (!current) return;
    edit({ images: current.images.filter((_, j) => j !== i) });
  }
  function moveImage(i: number, dir: -1 | 1) {
    if (!current) return;
    const next = [...current.images];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    edit({ images: next });
  }

  function setVariant(platform: PostPlatform, text: string) {
    if (!current) return;
    edit({ variants: { ...current.variants, [platform]: { text } } });
  }
  function toggleOwn(platform: PostPlatform, on: boolean) {
    setOwnText((s) => ({ ...s, [platform]: on }));
    if (!on && current) edit({ variants: { ...current.variants, [platform]: { text: null } } });
  }

  async function publish(t: StudioShareTarget) {
    if (!current) return;
    if (timer.current) {
      window.clearTimeout(timer.current);
      await flush();
    }
    setPosting(t.id);
    setNote(null);
    const r = await actions.publishPost(current.id, t.id).catch(() => ({ ok: false as const, error: 'Could not reach the server.' }));
    setPosting(null);
    if (r.ok === false) return setNote(r.error);
    const share: StudioShare = r.value;
    setCurrent((c) => (c ? { ...c, shares: [...c.shares, share] } : c));
    setPosts((list) => list.map((p) => (p.id === current.id ? { ...p, shares: [...p.shares, share] } : p)));
    setNote(`Posted to ${share.label}.`);
  }

  const drawer = (
    <>
      <div className="studio-panel__h">
        <span>Posts</span>
        <button type="button" className="studio-btn studio-btn--primary" onClick={() => void newPost()}>
          New post
        </button>
      </div>
      {posts.length === 0 ? (
        <p className="studio-hint">Nothing yet. A post here goes to your Facebook Page, Instagram or Threads.</p>
      ) : (
        <div className="studio-list">
          {posts.map((p) => (
            <button key={p.id} type="button" className={`sp-row ${current?.id === p.id ? 'is-current' : ''}`} onClick={() => setCurrent(p)}>
              {p.images[0] ? <img src={p.images[0].url} alt="" /> : <span className="sp-row__noimg" aria-hidden>Aa</span>}
              <span className="sp-row__text">
                <span className="sp-row__title">{p.title || p.body.split('\n')[0] || 'Untitled post'}</span>
                <span className="sp-row__meta">
                  {fmtDate(p.updatedAt)}
                  {p.shares.length > 0 && ` · posted ${p.shares.length}×`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  const main = current ? (
    <div className="sp-main">
      <input
        className="sp-title"
        value={current.title}
        placeholder="A name for this post (only you see it)"
        onChange={(e) => edit({ title: e.target.value })}
      />
      <textarea
        className="sp-body"
        value={current.body}
        placeholder="What do you want to say?"
        rows={6}
        onChange={(e) => edit({ body: e.target.value })}
      />
      <div className="sp-counts">
        {(['facebook', 'instagram', 'threads'] as PostPlatform[]).map((pl) => {
          const n = textFor(current, pl).length;
          return (
            <span key={pl} className={n > POST_LIMITS[pl] ? 'is-over' : ''}>
              {POST_PLATFORM_LABEL[pl]} {n.toLocaleString()}/{POST_LIMITS[pl].toLocaleString()}
            </span>
          );
        })}
      </div>
      <div className="sp-pictures">
        {current.images.map((img, i) => (
          <figure key={img.url + i} className="sp-pic">
            <img src={img.url} alt={img.alt ?? ''} />
            {!isJpeg(img.url) && <span className="sp-pic__flag" title="Instagram takes JPEG only">not JPEG</span>}
            <span className="sp-pic__tools">
              <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => moveImage(i, -1)}>←</button>
              <button type="button" aria-label="Move right" disabled={i === current.images.length - 1} onClick={() => moveImage(i, 1)}>→</button>
              <button type="button" aria-label="Remove picture" onClick={() => removeImage(i)}>×</button>
            </span>
          </figure>
        ))}
        <label className="sp-add">
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => void addFiles(e.target.files)} />
          {uploading > 0 ? `Uploading ${uploading}…` : current.images.length ? '+ Add' : '+ Add pictures'}
        </label>
      </div>
      <input
        className="sp-link"
        type="url"
        value={current.link ?? ''}
        placeholder="A link (optional): Facebook shows its card, Threads attaches it when there is no picture"
        onChange={(e) => edit({ link: e.target.value })}
      />
      <div className="sp-previews">
        <FacebookPreview post={current} name={targets?.find((t) => t.kind === 'page')?.label.replace(/ \(Facebook Page\)$/, '') ?? 'Your Page'} />
        <InstagramPreview post={current} name={targets?.find((t) => t.kind === 'instagram')?.label.replace(/ \(Instagram\)$/, '') ?? '@you'} />
        <ThreadsPreview post={current} name={targets?.find((t) => t.kind === 'threads')?.label.replace(/ \(Threads\)$/, '') ?? '@you'} />
      </div>
    </div>
  ) : (
    <div className="sp-empty">
      <p>Write a post for Facebook, Instagram or Threads: text, pictures, a link, and a preview of each before it goes out.</p>
      <button type="button" className="studio-btn studio-btn--primary" onClick={() => void newPost()}>
        New post
      </button>
    </div>
  );

  const settings = current ? (
    <>
      <div className="studio-panel__h">
        <span>Post to</span>
      </div>
      {targets === null ? (
        <p className="studio-hint">Looking up your accounts…</p>
      ) : targets.length === 0 ? (
        <p className="studio-hint">
          No account connected yet.{' '}
          {links.connectionsHref && <a href={links.connectionsHref}>Connect Facebook, Instagram or Threads</a>}
        </p>
      ) : (
        <div className="studio-shares__list">
          {targets.map((t) => {
            const done = current.shares.filter((s) => s.targetId === t.id);
            const last = done[done.length - 1];
            const why = t.disabledReason ?? blocker(current, t.kind);
            return (
              <div key={t.id} className="studio-shares__row">
                <span className="studio-shares__label">{t.label}</span>
                {last?.url ? (
                  <a className="studio-addr" href={last.url} target="_blank" rel="noreferrer">
                    posted {fmtDate(last.at)}
                  </a>
                ) : last ? (
                  <span className="studio-hint">posted {fmtDate(last.at)}</span>
                ) : null}
                <button type="button" className="studio-fbtn" disabled={Boolean(why) || posting === t.id} title={why ?? undefined} onClick={() => void publish(t)}>
                  {posting === t.id ? 'Posting…' : last ? 'Post again' : 'Post'}
                </button>
                {why && <span className="studio-hint sp-why">{why}</span>}
              </div>
            );
          })}
          {links.connectionsHref && (
            <a className="studio-hint" href={links.connectionsHref}>
              Manage connections
            </a>
          )}
        </div>
      )}
      {note && (
        <p className="studio-hint" role="status">
          {note}
        </p>
      )}
      <div className="studio-panel__h">
        <span>Text per platform</span>
      </div>
      {(['facebook', 'instagram', 'threads'] as PostPlatform[]).map((pl) => (
        <div key={pl} className="studio-field">
          <label className="studio-check studio-check--row">
            <input type="checkbox" checked={ownText[pl]} onChange={(e) => toggleOwn(pl, e.target.checked)} />
            Own text for {POST_PLATFORM_LABEL[pl]}
          </label>
          {ownText[pl] && (
            <textarea
              className="studio-field__text"
              rows={4}
              value={current.variants[pl]?.text ?? ''}
              placeholder={`What ${POST_PLATFORM_LABEL[pl]} gets instead`}
              onChange={(e) => setVariant(pl, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="studio-panel__h">
        <span>History</span>
      </div>
      <div className="studio-history">
        <div>
          <span>Updated</span>
          <span>{fmtDate(current.updatedAt)}</span>
        </div>
        <div>
          <span>Created</span>
          <span>{fmtDate(current.createdAt)}</span>
        </div>
      </div>
      <button type="button" className="studio-btn studio-btn--dangertext" onClick={() => void remove()}>
        Delete this post
      </button>
    </>
  ) : null;

  return (
    <>
      <StudioTopStatus>{save === 'saving' ? 'Saving…' : save === 'dirty' ? 'Unsaved' : save === 'error' ? 'Not saved' : current ? 'Saved' : ''}</StudioTopStatus>
      <StudioTopActions>
        <button type="button" className="studio-btn studio-btn--primary" onClick={() => void newPost()}>
          New post
        </button>
      </StudioTopActions>
      <StudioColumns drawer={drawer} main={main} settings={settings} wideSettings />
    </>
  );
}

// ── previews ─────────────────────────────────────────────────────────────────

function Pictures({ images, square }: { images: PostImage[]; square?: boolean }) {
  if (images.length === 0) return null;
  if (square) return <div className="sp-pv__square"><img src={images[0]!.url} alt="" /></div>;
  const shown = images.slice(0, 4);
  return (
    <div className={`sp-pv__grid sp-pv__grid--${Math.min(shown.length, 4)}`}>
      {shown.map((img, i) => (
        <div key={img.url + i} className="sp-pv__cell">
          <img src={img.url} alt="" />
          {i === 3 && images.length > 4 && <span className="sp-pv__more">+{images.length - 4}</span>}
        </div>
      ))}
    </div>
  );
}

function Clamp({ text, at, more = 'See more' }: { text: string; at: number; more?: string }) {
  const [open, setOpen] = React.useState(false);
  if (!text.trim()) return null;
  const long = text.length > at;
  const shown = open || !long ? text : text.slice(0, at).replace(/\s+\S*$/, '') + '…';
  return (
    <p className="sp-pv__text">
      {shown}
      {long && !open && (
        <>
          {' '}
          <button type="button" className="sp-pv__more-btn" onClick={() => setOpen(true)}>
            {more}
          </button>
        </>
      )}
    </p>
  );
}

function FacebookPreview({ post, name }: { post: SocialPostView; name: string }) {
  const text = textFor(post, 'facebook');
  return (
    <article className="sp-pv sp-pv--fb" aria-label="Facebook preview">
      <header className="sp-pv__head">
        <span className="sp-pv__avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>{name}</strong>
          <small>Just now · 🌐</small>
        </span>
      </header>
      <Clamp text={text} at={400} />
      <Pictures images={post.images} />
      {post.link && post.images.length === 0 && (
        <div className="sp-pv__linkcard">
          <small>{hostOf(post.link).toUpperCase()}</small>
          <span>Facebook draws this card from the page&rsquo;s own title and image.</span>
        </div>
      )}
      <footer className="sp-pv__foot">
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗ Share</span>
      </footer>
    </article>
  );
}

function InstagramPreview({ post, name }: { post: SocialPostView; name: string }) {
  const text = textFor(post, 'instagram');
  const handle = name.replace(/^@/, '');
  return (
    <article className="sp-pv sp-pv--ig" aria-label="Instagram preview">
      <header className="sp-pv__head">
        <span className="sp-pv__avatar sp-pv__avatar--ring">{handle.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>{handle}</strong>
        </span>
      </header>
      {post.images.length ? (
        <Pictures images={post.images} square />
      ) : (
        <div className="sp-pv__square sp-pv__square--empty">Instagram needs a picture</div>
      )}
      <div className="sp-pv__icons">
        <span>♡</span>
        <span>◯</span>
        <span>➤</span>
      </div>
      {text.trim() && (
        <p className="sp-pv__text">
          <strong>{handle}</strong> <Clamp text={text} at={125} more="more" />
        </p>
      )}
    </article>
  );
}

function ThreadsPreview({ post, name }: { post: SocialPostView; name: string }) {
  const text = textFor(post, 'threads');
  const handle = name.replace(/^@/, '');
  return (
    <article className="sp-pv sp-pv--th" aria-label="Threads preview">
      <header className="sp-pv__head">
        <span className="sp-pv__avatar">{handle.slice(0, 1).toUpperCase()}</span>
        <span>
          <strong>{handle}</strong>
          <small>now</small>
        </span>
      </header>
      <p className={`sp-pv__text ${text.length > POST_LIMITS.threads ? 'is-over' : ''}`}>{text}</p>
      {post.images.length > 0 && <Pictures images={post.images.slice(0, 1)} />}
      {post.link && post.images.length === 0 && (
        <div className="sp-pv__linkcard">
          <small>{hostOf(post.link)}</small>
        </div>
      )}
      <div className="sp-pv__icons">
        <span>♡</span>
        <span>◯</span>
        <span>↻</span>
        <span>➤</span>
      </div>
    </article>
  );
}
