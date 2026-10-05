'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { COLLECT_PATH, type CollectPayload } from './index';

/**
 * Sends a page view for every route the visitor opens (first load and client
 * navigations) and, when the page is left or hidden, how long it was visible.
 * Render once in the root layout:
 *
 *   <AnalyticsBeacon />                       // basePath apps: endpoint="/books/api/pulse"
 *
 * It sends nothing when the browser sends Do Not Track or Global Privacy
 * Control, and sets no cookie or storage; the collector derives a daily
 * anonymous visitor id on the server.
 */
export function AnalyticsBeacon({ endpoint = COLLECT_PATH }: { endpoint?: string }) {
  const pathname = usePathname();
  const current = useRef<{ id: string; shownAt: number; visibleMs: number; visibleSince: number | null } | null>(null);
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (optedOut()) return;
    const send = (payload: CollectPayload) => post(endpoint, payload);

    const flush = () => {
      const c = current.current;
      if (!c) return;
      const ms = c.visibleMs + (c.visibleSince ? Date.now() - c.visibleSince : 0);
      current.current = null;
      if (ms >= 500) send({ type: 'leave', id: c.id, path: '/', duration: Math.min(ms, 30 * 60_000) });
    };

    const onVisibility = () => {
      const c = current.current;
      if (!c) return;
      if (document.visibilityState === 'hidden') {
        if (c.visibleSince) c.visibleMs += Date.now() - c.visibleSince;
        c.visibleSince = null;
        // Report now: a hidden tab may never come back. A later return keeps
        // counting into the same view; the collector keeps the largest value.
        send({ type: 'leave', id: c.id, path: '/', duration: Math.min(c.visibleMs, 30 * 60_000) });
      } else {
        c.visibleSince = Date.now();
      }
    };

    // Let the page settle first: redirects and instant bounces are not views,
    // and a post's <AnalyticsThread> marker has mounted by then.
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'prerender' as string) return;
      const referrer = previousPath.current ? location.origin + previousPath.current : document.referrer;
      const id = uuid();
      current.current = { id, shownAt: Date.now(), visibleMs: 0, visibleSince: document.visibilityState === 'visible' ? Date.now() : null };
      previousPath.current = location.pathname;
      send({
        type: 'pageview',
        id,
        path: location.pathname,
        referrer,
        search: location.search,
        thread: document.querySelector<HTMLElement>('[data-eac-thread]')?.dataset.eacThread,
      });
    }, 120);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [pathname, endpoint]);

  // Remember the endpoint for trackEvent().
  useEffect(() => {
    (window as unknown as { __eacPulse?: string }).__eacPulse = endpoint;
  }, [endpoint]);

  return null;
}

/**
 * Records a named action (an RSVP, a sign-up, a purchase, a search) against the
 * current page. Safe to call anywhere on the client; does nothing without the
 * beacon mounted or when the visitor opted out.
 */
export function trackEvent(name: string, props?: CollectPayload['props']): void {
  if (typeof window === 'undefined' || optedOut()) return;
  const endpoint = (window as unknown as { __eacPulse?: string }).__eacPulse;
  if (!endpoint) return;
  post(endpoint, {
    type: 'event',
    id: uuid(),
    path: location.pathname,
    name,
    props,
    thread: document.querySelector<HTMLElement>('[data-eac-thread]')?.dataset.eacThread,
  });
}

/** crypto.randomUUID needs a secure context and Safari 15.4+; fall back to getRandomValues. */
function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true;
}

function post(endpoint: string, payload: CollectPayload): void {
  const body = JSON.stringify(payload);
  try {
    // text/plain keeps this a simple request: no CORS preflight, and the
    // beacon survives page unload.
    if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'text/plain' }))) return;
  } catch {
    /* fall through to fetch */
  }
  fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
}
