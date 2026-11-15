'use client';

import * as React from 'react';
import type { Answers, CardRendererProps, FormContext, FormHost, FormKindId } from '../contract';
import { Seg } from '../fields/Seg';
import { Icon } from '../theme/context';
import { DEFAULT_CARDS } from './default-cards';
import { feedName } from './format';

// ============================================================================
// PreviewFrame: the preview column (design §1.3). On the forms' surface
// colour: "Preview" · "on <feed>" · Card | Page. Then the SHEET, which is the
// target site's page: host.preview.themeVars are set on it, the breadcrumb
// (org / feed), the kind's card or page from host.preview.cards[kind] or the
// cms-ui defaults, and the faded neighbour from the same feed when the host
// gives one. Then the footnote.
//
// A host card that throws is caught here, so a broken preview never takes the
// form with it.
// ============================================================================

class CardBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? <p className="frm-pv-fail">The preview could not be drawn. The form is unaffected.</p> : this.props.children;
  }
}

/** Only custom properties pass through to the sheet's style. */
function themeStyle(vars: Record<string, string> | undefined): React.CSSProperties | undefined {
  if (!vars) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) if (/^--[a-z0-9-]{1,60}$/i.test(k) && typeof v === 'string') out[k] = v;
  return out as React.CSSProperties;
}

/**
 * Where the item shows on the site, for "on …" and the breadcrumb: a series on the Series
 * page, an artwork in the Store (or the gallery when it is not in the store), the rest on
 * the feed they go on.
 */
export function previewPlace(kind: FormKindId | 'series', answers: Answers, host: Pick<FormHost, 'feeds' | 'preview'>, ctx: FormContext): string | null {
  const named = host.preview?.place?.[kind];
  if (typeof named === 'string' && named) return named;
  if (kind === 'series') return 'Series';
  if (kind === 'artwork') {
    const shows = answers.shows && typeof answers.shows === 'object' ? (answers.shows as { store?: unknown; gallery?: unknown }) : null;
    return shows !== null && shows.store === false && shows.gallery === true ? 'Gallery' : 'Store';
  }
  return feedName(answers, host, ctx);
}

export interface PreviewFrameProps {
  kind: FormKindId | 'series';
  answers: Answers;
  ctx: FormContext;
  host: FormHost;
  mode: 'card' | 'page';
  onMode: (mode: 'card' | 'page') => void;
  /** The item is live: the footnote says so. */
  published?: boolean;
  /** Layout `toggle`: the × that hides the column. */
  onClose?: () => void;
  /** Layout `rail`: the Sections | Preview seg sits above the header. */
  top?: React.ReactNode;
  /** Distinguishes the radios when two previews share a page. */
  scope?: string;
  className?: string;
}

export function PreviewFrame({ kind, answers, ctx, host, mode, onMode, published, onClose, top, scope = '', className }: PreviewFrameProps) {
  const feed = previewPlace(kind, answers, host, ctx);
  const render = host.preview.cards?.[kind] ?? DEFAULT_CARDS[kind];
  const neighbour = host.preview.neighbour?.[kind] ?? null;
  const props: CardRendererProps = { kind, answers, mode, ctx };
  return (
    <aside className={className ? `frm-pv ${className}` : 'frm-pv'} aria-label="Preview">
      {top && <div className="frm-pv-railseg">{top}</div>}
      {onClose && (
        <button type="button" className="frm-btn frm-btn--icon frm-pv-close" aria-label="Hide preview" onClick={onClose}>
          <Icon name="close" size={15} />
        </button>
      )}
      <div className="frm-pv-head">
        <span className="frm-eyebrow">Preview</span>
        {feed && <span className="frm-pv-where">on {feed}</span>}
        <Seg
          name={`frm-${scope}pv-mode`}
          ariaLabel="Preview as"
          size="sm"
          ground="bg"
          value={mode}
          options={[
            { value: 'card', label: 'Card' },
            { value: 'page', label: 'Page' },
          ]}
          onChange={(v) => onMode(v === 'page' ? 'page' : 'card')}
        />
      </div>
      <div className="frm-pv-sheet" style={themeStyle(host.preview.themeVars)}>
        <div className="frm-pv-crumb">
          <b>{ctx.orgName}</b>
          {feed && <span>/ {feed}</span>}
        </div>
        <div className="frm-pv-card" aria-live="off">
          <CardBoundary resetKey={`${kind}:${mode}`}>{render(props)}</CardBoundary>
        </div>
        {mode === 'card' && neighbour && (
          <div className="frm-pv-near" aria-hidden="true">
            <span className="frm-pv-near-label">{neighbour.label}</span>
            <span className="frm-pv-near-title">{neighbour.title}</span>
          </div>
        )}
      </div>
      <p className="frm-pv-note">{published ? 'This is what visitors see now.' : 'Updates as you type. A draft only you can see.'}</p>
    </aside>
  );
}
