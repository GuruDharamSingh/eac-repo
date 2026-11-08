'use client';

import * as React from 'react';
import { seriesCardLines } from '@elkdonis/cms-ui/compose';
import { SurfaceCard } from '@elkdonis/cms-ui/surface';
import type { CardRenderer, CardRendererProps, FormKindId } from '../contract';
import { mediaUrl } from '../fields/MediaField';
import { feedName, paragraphs, parseWallClock, readingMinutes, shortDay, span, text, whereLine } from './format';
import { artworkLines, seriesLines, serviceLines } from './kind-lines';

// ============================================================================
// The default preview cards: the network's own cms-ui face (SurfaceCard),
// the card the hub and the sites already print, filled from the answers.
// Owner ruling (PLAN §8 Q3): the preview shows the target site's real cards
// in its own theme, so there is no Broadsheet card here; a site with its own
// cards (hidden-enneagram's record blocks) passes FormHost.preview.cards.
//
// The faces are drawn inert (no hit target, no focus) inside the sheet, which
// carries the site's theme vars. The page view is a plain article from the
// surface tokens: plain text only, never the stored HTML, so a preview can
// never run markup.
// ============================================================================

function Picture({ url, ratio, tag }: { url: string | null; ratio?: 'wide' | 'tall' | 'square'; tag?: string | null }) {
  const img = url ? <img className="frm-pvc-img" data-ratio={ratio} src={url} alt="" /> : <span className="frm-pvc-img frm-dots" data-ratio={ratio} aria-hidden="true" />;
  if (!tag) return img;
  return (
    <span className="frm-pvc-pic">
      {img}
      <span className="frm-pvc-tag" data-tone="accent">
        {tag}
      </span>
    </span>
  );
}

/** A cms-ui face, inert. `lines`: the blurb keeps its line breaks (a second line such as "First: …"). */
function Face({ lines, ...props }: React.ComponentProps<typeof SurfaceCard> & { lines?: boolean }) {
  return (
    <div className="frm-pvc" data-lines={lines === true ? '' : undefined} inert>
      <SurfaceCard {...props} cue="" />
    </div>
  );
}

function titleOf(p: CardRendererProps): string {
  return text(p.answers.title) || 'Untitled';
}

function cover(p: CardRendererProps): string | null {
  return mediaUrl(p.answers.cover_image_url ?? p.answers.imageUrl ?? p.answers.image_url ?? null);
}

function feedFrom(p: CardRendererProps): string | null {
  return feedName(p.answers, { feeds: [] }, p.ctx);
}

const post: CardRenderer = (p) => {
  const body = paragraphs(p.answers.body, 3);
  const lede = text(p.answers.excerpt) || text(p.answers.lede) || body[0] || '';
  const minutes = readingMinutes(p.answers.body);
  const kicker = feedFrom(p);
  if (p.mode === 'page') {
    return (
      <article className="frm-pvc-page">
        {kicker && <span className="frm-pvc-kicker">{kicker}</span>}
        <span className="frm-pvc-title">{titleOf(p)}</span>
        <span className="frm-pvc-meta">{`${minutes} min read`}</span>
        <Picture url={cover(p)} />
        <div className="frm-pvc-body">{(body.length ? body : ['Start writing and the page fills in here.']).map((t, i) => <p key={i}>{t}</p>)}</div>
      </article>
    );
  }
  return <Face kind="post" kicker={kicker} title={titleOf(p)} blurb={lede ? `${lede.slice(0, 180)}${lede.length > 180 ? '…' : ''}` : `${minutes} min read`} preview={<Picture url={cover(p)} />} />;
};

const gathering: CardRenderer = (p) => {
  const w = parseWallClock(p.answers.scheduled_at);
  const when = w ? `${shortDay(w)} · ${span(w, p.answers.duration_minutes)}` : 'Date to be set';
  const where = whereLine(p.answers);
  const cap = typeof p.answers.attendee_limit === 'number' ? `${p.answers.attendee_limit} places` : null;
  if (p.mode === 'page') {
    return (
      <article className="frm-pvc-page">
        <span className="frm-pvc-kicker">{when}</span>
        <span className="frm-pvc-title">{titleOf(p)}</span>
        <span className="frm-pvc-meta">{where}</span>
        <Picture url={cover(p)} />
        {p.answers.is_rsvp_enabled !== false && (
          <div className="frm-pvc-tools">
            <span className="frm-pvc-btn" data-variant="primary">I’m coming</span>
            <span className="frm-pvc-btn" data-variant="secondary">Maybe</span>
            {cap && <span>{cap}</span>}
          </div>
        )}
        <div className="frm-pvc-body">{paragraphs(p.answers.body, 3).map((t, i) => <p key={i}>{t}</p>)}</div>
      </article>
    );
  }
  return <Face kind="meeting" kicker={when} title={titleOf(p)} blurb={cap ? `${where} · ${cap}` : where} preview={<Picture url={cover(p)} ratio="wide" />} />;
};

/** Who hosts a gathering or a series, by name, from the host candidates the context lists. */
function hostName(p: CardRendererProps): string {
  const id = text(p.answers.host_user_id);
  const list = (p.ctx.fields.hostCandidates as Array<{ userId: string; displayName: string }> | undefined) ?? [];
  return list.find((h) => h.userId === id)?.displayName ?? '';
}

const series: CardRenderer = (p) => {
  const l = seriesLines(p.answers);
  const fallback = seriesCardLines(p.answers, { orgName: p.ctx.orgName });
  if (p.mode === 'page') {
    const on = l.sessions.filter((s) => !s.skipped);
    const host = hostName(p);
    return (
      <article className="frm-pvc-page">
        <span className="frm-pvc-kicker">{l.kicker}</span>
        <span className="frm-pvc-title">{titleOf(p)}</span>
        <span className="frm-pvc-meta">{[l.span || fallback.when, host ? `hosted by ${host}` : ''].filter(Boolean).join(' · ')}</span>
        <Picture url={cover(p)} />
        {p.answers.is_rsvp_enabled !== false && (
          <div className="frm-pvc-tools">
            <span className="frm-pvc-btn" data-variant="primary">Join the series</span>
            <span>or come to single evenings</span>
          </div>
        )}
        <div className="frm-pvc-body">{paragraphs(p.answers.body ?? p.answers.lede, 2).map((t, i) => <p key={i}>{t}</p>)}</div>
        {on.length > 0 && (
          <ol className="frm-pvc-sessions">
            {on.slice(0, 5).map((s) => (
              <li key={s.date}>
                <span className="frm-pvc-sessions-no">{s.no}</span>
                <span className="frm-pvc-sessions-day">{s.day}</span>
                <span className="frm-pvc-sessions-title" data-empty={s.title ? undefined : ''}>
                  {s.title || `Session ${s.no}`}
                </span>
              </li>
            ))}
            {on.length > 5 && <li className="frm-pvc-sessions-more">{`and ${on.length - 5} more`}</li>}
          </ol>
        )}
      </article>
    );
  }
  const blurb = [l.span || fallback.span, l.first ? `First: ${l.first}` : ''].filter(Boolean).join('\n');
  return (
    <Face
      kind="series"
      lines
      kicker={l.kicker}
      title={titleOf(p)}
      blurb={blurb || fallback.when || undefined}
      preview={<Picture url={cover(p)} ratio="wide" tag={l.starts} />}
    />
  );
};

/**
 * Artwork: the network's gallery label (commerce's ProductCard "wall" face: the piece, then
 * title, maker, price), drawn from the surface tokens. The studio package does not depend on
 * commerce, so a host that wants the real ProductCard passes it as preview.cards.artwork.
 */
const artwork: CardRenderer = (p) => {
  const l = artworkLines(p.answers);
  const tag = l.availability ? (
    <span className="frm-pvc-tag" data-tone={l.availability.tone}>
      {l.availability.label}
    </span>
  ) : null;
  if (p.mode === 'page') {
    const sold = l.availability !== null && l.availability.label !== 'Available';
    const action = l.mode === 'nfs' || sold ? null : l.mode === 'request' ? 'Ask about it' : 'Buy';
    return (
      <article className="frm-pvc-page">
        <div className="frm-pvc-gallery">
          <Picture url={l.pictures[0] ?? null} ratio="tall" />
          <div className="frm-pvc-gallery-thumbs">
            {[1, 2, 3].map((i) => (
              <Picture key={i} url={l.pictures[i] ?? null} ratio="square" />
            ))}
          </div>
        </div>
        <span className="frm-pvc-title" data-size="md">
          {titleOf(p)}
        </span>
        {l.creditLine && <span className="frm-pvc-line">{l.creditLine}</span>}
        {l.detailsLine && <span className="frm-pvc-meta">{l.detailsLine}</span>}
        {l.mode === 'price' && l.variants.length > 1 ? (
          <div className="frm-pvc-variants">
            {l.variants.map((v, i) => (
              <span key={i} className="frm-pvc-variant" data-on={i === 0 ? '' : undefined}>
                {[v.name, v.price].filter(Boolean).join(' ')}
              </span>
            ))}
          </div>
        ) : null}
        <div className="frm-pvc-tools">
          <span className="frm-pvc-price">{l.price}</span>
          {tag}
        </div>
        {action && (
          <span className="frm-pvc-btn" data-variant="primary" data-align="start">
            {action}
          </span>
        )}
        <div className="frm-pvc-body">{paragraphs(p.answers.description ?? p.answers.body, 2).map((t, i) => <p key={i}>{t}</p>)}</div>
      </article>
    );
  }
  return (
    <div className="frm-pvc frm-pvc-wall" inert>
      <Picture url={l.pictures[0] ?? null} ratio="tall" />
      <span className="frm-pvc-wall-title">{titleOf(p)}</span>
      {l.makerLine && <span className="frm-pvc-line">{l.makerLine}</span>}
      <span className="frm-pvc-tools">
        <span className="frm-pvc-price">{l.price}</span>
        {tag}
      </span>
    </div>
  );
};

const service: CardRenderer = (p) => {
  const a = p.answers;
  const l = serviceLines(a);
  if (p.mode === 'page') {
    return (
      <article className="frm-pvc-page">
        <span className="frm-pvc-kicker">Offering</span>
        <span className="frm-pvc-title">{titleOf(p)}</span>
        {l.lede && <span className="frm-pvc-line">{l.lede}</span>}
        {l.meta && <span className="frm-pvc-meta">{l.meta}</span>}
        <Picture url={cover(p)} />
        <div className="frm-pvc-tools">
          <span className="frm-pvc-btn" data-variant={l.open ? 'primary' : 'secondary'}>
            {l.action}
          </span>
          {l.price && <span>{l.price}</span>}
        </div>
        <div className="frm-pvc-body">{paragraphs(a.body, 3).map((t, i) => <p key={i}>{t}</p>)}</div>
      </article>
    );
  }
  const blurb = [l.lede, l.meta].filter(Boolean).join('\n');
  return <Face kind="service" lines kicker="Offering" title={titleOf(p)} blurb={blurb || undefined} preview={<Picture url={cover(p)} />} />;
};

export const DEFAULT_CARDS: Record<FormKindId | 'series', CardRenderer> = { post, gathering, series, artwork, service };
