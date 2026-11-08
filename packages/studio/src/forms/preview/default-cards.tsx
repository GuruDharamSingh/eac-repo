'use client';

import * as React from 'react';
import { seriesCardLines } from '@elkdonis/cms-ui/compose';
import { SurfaceCard, fmtPrice } from '@elkdonis/cms-ui/surface';
import type { CardRenderer, CardRendererProps, FormKindId } from '../contract';
import { mediaUrl } from '../fields/MediaField';
import { feedName, paragraphs, parseWallClock, readingMinutes, shortDay, span, text, weekdayPlural, whereLine } from './format';

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

function Picture({ url, ratio }: { url: string | null; ratio?: 'wide' | 'tall' }) {
  return url ? <img className="frm-pvc-img" data-ratio={ratio} src={url} alt="" /> : <span className="frm-pvc-img frm-dots" data-ratio={ratio} aria-hidden="true" />;
}

function Face(props: React.ComponentProps<typeof SurfaceCard>) {
  return (
    <div className="frm-pvc" inert>
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

const series: CardRenderer = (p) => {
  const lines = seriesCardLines(p.answers, { orgName: p.ctx.orgName });
  const w = parseWallClock(p.answers.scheduled_at);
  const kicker = w ? `Series · ${weekdayPlural(w)}, ${span(w, null)}` : lines.kicker || 'Series';
  const count = typeof p.answers.session_count === 'number' ? p.answers.session_count : lines.sessions;
  const blurb = [count ? `${count} sessions` : null, lines.span || null].filter(Boolean).join(', ');
  if (p.mode === 'page') {
    return (
      <article className="frm-pvc-page">
        <span className="frm-pvc-kicker">{kicker}</span>
        <span className="frm-pvc-title">{titleOf(p)}</span>
        <span className="frm-pvc-meta">{[lines.when, whereLine(p.answers)].filter(Boolean).join(' · ')}</span>
        <Picture url={cover(p)} />
        <div className="frm-pvc-body">{paragraphs(p.answers.body ?? p.answers.lede, 3).map((t, i) => <p key={i}>{t}</p>)}</div>
      </article>
    );
  }
  return <Face kind="series" kicker={kicker} title={titleOf(p)} blurb={blurb || lines.when} preview={<Picture url={cover(p)} ratio="wide" />} />;
};

const artwork: CardRenderer = (p) => {
  const a = p.answers;
  const priceMode = text(a.price_mode);
  const price =
    priceMode === 'request' ? 'Price on request' : priceMode === 'nfs' ? 'Not for sale' : fmtPrice(a.price as number | string | null | undefined, text(a.currency) || null) ?? 'Price not set';
  const maker = [text(a.artist_name) || text(a.maker), text(a.medium), text(a.year)].filter(Boolean).join(' · ');
  if (p.mode === 'page') {
    return (
      <article className="frm-pvc-page">
        <Picture url={cover(p)} ratio="tall" />
        <span className="frm-pvc-title">{titleOf(p)}</span>
        {maker && <span className="frm-pvc-meta">{maker}</span>}
        <div className="frm-pvc-tools">
          <span>{price}</span>
          {priceMode !== 'nfs' && <span className="frm-pvc-btn" data-variant="primary">{priceMode === 'request' ? 'Ask' : 'Buy'}</span>}
        </div>
      </article>
    );
  }
  return <Face kind="product" kicker="Artwork" title={titleOf(p)} blurb={maker ? `${maker} · ${price}` : price} preview={<Picture url={cover(p)} ratio="tall" />} />;
};

const service: CardRenderer = (p) => {
  const a = p.answers;
  const price = fmtPrice(a.price as number | string | null | undefined, text(a.currency) || null);
  const line = [text(a.subtitle), price].filter(Boolean).join(' · ');
  if (p.mode === 'page') {
    return (
      <article className="frm-pvc-page">
        <span className="frm-pvc-kicker">Offering</span>
        <span className="frm-pvc-title">{titleOf(p)}</span>
        {line && <span className="frm-pvc-meta">{line}</span>}
        <Picture url={cover(p)} />
        <div className="frm-pvc-body">{paragraphs(a.body, 3).map((t, i) => <p key={i}>{t}</p>)}</div>
      </article>
    );
  }
  return <Face kind="service" kicker="Offering" title={titleOf(p)} blurb={line || undefined} preview={<Picture url={cover(p)} />} />;
};

export const DEFAULT_CARDS: Record<FormKindId | 'series', CardRenderer> = { post, gathering, series, artwork, service };
