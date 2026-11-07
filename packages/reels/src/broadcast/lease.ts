'use client';

import * as React from 'react';
import type { BroadcastClaim } from './types';

/** Tab id: one session is one tab, so a second tab of the same person is refused too. */
export function newTabId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

/**
 * Claim the one OBS session for this tab and renew it every 5 s. null: not
 * asked yet; then the agent's answer. The lease lapses 20 s after the last
 * renewal, so a crashed tab frees itself; a closed tab releases it at once.
 */
export function useBroadcastLease(
  claim: (tabId: string) => Promise<BroadcastClaim>,
  tabId: string,
  releaseEndpoint: string
): BroadcastClaim | null {
  const [state, setState] = React.useState<BroadcastClaim | null>(null);
  React.useEffect(() => {
    let stop = false;
    const tick = async () => {
      const c = await claim(tabId);
      if (!stop) setState(c);
    };
    void tick();
    const t = window.setInterval(tick, 5000);
    const release = () => navigator.sendBeacon?.(releaseEndpoint, tabId);
    window.addEventListener('pagehide', release);
    return () => {
      stop = true;
      window.clearInterval(t);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [claim, tabId, releaseEndpoint]);
  return state;
}
