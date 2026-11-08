'use client';

// The collapsed Site Builder card (1a IFAC, 1b Book Readers). Clicking the card opens the pop-up.

import * as React from 'react';
import type { HubCardProps } from '../contract';
import { Btn, Frame, Icon, Thumb, stop } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import type { SiteBuilderFaceData } from './model';
import {
  SwatchRow, editHref, editedLine, fontStack, go, kindSplitText, lastEditorPage, leaveIntent, lookName,
} from './parts';

export function Face({ data, host, nav }: HubCardProps<SiteBuilderFaceData, SiteBuilderHost>) {
  const { pages, theme, lastEdited } = data;
  const n = pages.length;
  const editorPage = lastEditorPage(pages);
  const firstTemplate = pages.find((p) => p.kind === 'template') ?? null;
  const open = () => nav.openPopup();

  // "Open page editor" needs an editor page and a host editor; with no editor pages it is "Edit copy".
  const editorHref = editorPage ? editHref(host, editorPage.path) : null;
  const primary =
    editorPage
      ? editorHref
        ? { label: 'Open page editor', run: () => go(host, editorHref) }
        : null
      : firstTemplate
        ? {
            label: 'Edit copy',
            run: () => {
              leaveIntent({ expand: firstTemplate.id });
              nav.openPopup();
            },
          }
        : null;

  return (
    <Frame
      className="hc-card"
      role="button"
      tabIndex={0}
      aria-label="Site builder"
      onClick={open}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      style={{ minHeight: 372 }}
    >
      <div className="hc-card-head">
        <span className="hc-icon-accent"><Icon name="panels-top-left" size={20} /></span>
        <span className="hc-card-title">Site builder</span>
        <span className="hc-go"><Icon name="external" size={18} /></span>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="hc-num" style={{ fontSize: 52 }}>{n}</span>
          <span className="hc-heading" style={{ fontSize: 19 }}>{n === 1 ? 'page' : 'pages'}</span>
        </div>
        {n > 0 ? <div style={{ fontSize: 15, color: 'var(--hc-n-800)', marginTop: 4 }}>{kindSplitText(pages)}</div> : null}
      </div>

      {lastEdited ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Thumb url={lastEdited.thumbnailUrl} title={lastEdited.title} width={120} height={75} />
          <div style={{ minWidth: 0 }}>
            <div className="hc-overline" style={{ fontSize: 12 }}>Last edited</div>
            <div
              style={{
                fontSize: 19, fontWeight: 600, lineHeight: 1.25, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {lastEdited.title}
            </div>
            <div style={{ fontSize: 15, color: 'var(--hc-n-800)' }}>{editedLine(lastEdited)}</div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <SwatchRow colors={theme.colors} />
        <span
          aria-hidden="true"
          style={{ fontFamily: fontStack(theme.headingFont), fontWeight: 700, fontSize: 21, lineHeight: 1, flex: 'none' }}
        >
          Aa
        </span>
        <span
          style={{ fontSize: 15, color: 'var(--hc-n-800)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {lookName(theme.look)} · {theme.headingFont}
        </span>
      </div>

      <div className="hc-card-actions">
        {primary ? (
          <Btn
            variant="primary"
            icon="square-pen"
            style={{ fontSize: 15 }}
            onClick={(e) => {
              stop(e);
              primary.run();
            }}
          >
            {primary.label}
          </Btn>
        ) : null}
        <Btn
          variant="secondary"
          icon="list"
          style={{ fontSize: 15 }}
          onClick={(e) => {
            stop(e);
            open();
          }}
        >
          List pages
        </Btn>
      </div>
    </Frame>
  );
}
