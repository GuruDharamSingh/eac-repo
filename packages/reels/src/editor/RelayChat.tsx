'use client';

// Viewer chat from the stream's destinations in one list (2026-11-01): the
// stream-chat service collects it (Twitch first; @elkdonis/services/stream-chat)
// and this panel polls for messages newer than the last one it has. Shown to
// the people running the stream only, not on the broadcast. Text only.
// YouTube since 2026-11-01 (phase 2), read through a connected account.

import * as React from 'react';
import type { RelayChatMessage, RelayResult } from './relay-types';

export interface RelayChatProps {
  chat(sinceId: number | null): Promise<RelayResult<RelayChatMessage[]>>;
  /** Poll interval; default 2 s. */
  everyMs?: number;
}

const PLATFORM: Record<RelayChatMessage['platform'], string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  facebook: 'Facebook',
  kick: 'Kick',
};

const KEEP = 300;

export function RelayChat({ chat, everyMs = 2000 }: RelayChatProps) {
  const [messages, setMessages] = React.useState<RelayChatMessage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const last = React.useRef<number | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  // Follow new messages only while the list is scrolled to the bottom.
  const pinned = React.useRef(true);

  React.useEffect(() => {
    let alive = true;
    let busy = false;
    const pull = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await chat(last.current);
        if (!alive) return;
        if (!r.ok) return setError((r as { error: string }).error);
        setError(null);
        const fresh = (r as { value: RelayChatMessage[] }).value ?? [];
        if (fresh.length) {
          last.current = fresh[fresh.length - 1].id;
          setMessages((m) => [...m, ...fresh].slice(-KEEP));
        }
      } catch (err) {
        if (alive) setError((err as Error).message);
      } finally {
        busy = false;
      }
    };
    void pull();
    const t = window.setInterval(() => void pull(), everyMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [chat, everyMs]);

  React.useLayoutEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="vs-relay-chat">
      <div
        ref={box}
        className="vs-relay-chat__list"
        role="log"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {messages.length === 0 && <p className="vs-faint">No chat yet. Messages from the destinations' chat channels appear here.</p>}
        {messages.map((m) => (
          <p key={m.id} className="vs-relay-chat__msg">
            <span className={`vs-relay-chat__badge is-${m.platform}`} title={m.platform === 'youtube' ? undefined : `#${m.channel}`}>{PLATFORM[m.platform] ?? m.platform}</span>
            <span className="vs-relay-chat__time">{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <strong className="vs-relay-chat__author" style={m.colour ? ({ '--chat-colour': m.colour } as React.CSSProperties) : undefined}>{m.author}</strong>
            {m.amount && <span className="vs-relay-chat__amount">{m.amount}</span>}
            <span className="vs-relay-chat__body">{m.body}</span>
          </p>
        ))}
      </div>
      {error && <p className="studio-err">{error}</p>}
    </div>
  );
}
