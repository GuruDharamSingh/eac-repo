'use client';

// The Members card's optimistic write state, shared by the pop-up and the detail page.
// Every write: apply locally, toast, `await host.act(...)`, `host.refresh?.()` on success,
// revert + toast the error string on `{ ok: false }`. Permissions are never decided here;
// callers only offer what `member.can` and `data.can` allow.

import * as React from 'react';
import type { HubRole } from '../contract';
import { Frame, Icon, useToast } from '../ui/primitives';
import type { MembersHost } from './host';
import type { Arrival, Member, MembersFaceData } from './model';
import { ROLE_LABEL } from './model';

export interface Live {
  /** Patched people (the base list plus local changes). */
  people: Member[];
  /** Oldest first, minus the ones handled locally. */
  arrivals: Arrival[];
  /** Waiting count, adjusted for local welcomes and dismissals. */
  waiting: number;
  total: number;
  /** Syncs in flight; null when storage isn't tracked. */
  syncs: number | null;
  setRole(m: Member, role: HubRole): Promise<void>;
  setListed(m: Member, listed: boolean): Promise<void>;
  remove(m: Member): Promise<void>;
  welcome(a: Arrival, role: HubRole): Promise<void>;
  dismiss(a: Arrival): Promise<void>;
  /** Toasts (success and error). Render once, anywhere inside the card root. */
  toast: React.ReactNode;
}

const lower = (r: HubRole) => ROLE_LABEL[r].toLowerCase();

export function useMembersLive(data: MembersFaceData, host: MembersHost, base: Member[]): Live {
  const [patch, setPatch] = React.useState<Record<string, Partial<Member>>>({});
  const [gone, setGone] = React.useState<ReadonlySet<string>>(() => new Set());
  const [goneArr, setGoneArr] = React.useState<ReadonlySet<string>>(() => new Set());
  const [added, setAdded] = React.useState<Member[]>([]);
  const [syncDelta, setSyncDelta] = React.useState(0);
  const ok = useToast(3400);
  const [error, setError] = React.useState<{ text: string; id: number } | null>(null);

  // Fresh server data (after host.refresh) replaces everything optimistic.
  React.useEffect(() => {
    setPatch({});
    setGone(new Set());
    setGoneArr(new Set());
    setAdded([]);
    setSyncDelta(0);
  }, [data]);

  React.useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
  }, [error]);

  const storageTracked = base.some((p) => p.storage !== null);

  const people = React.useMemo(() => {
    const ids = new Set(base.map((p) => p.id));
    return [...base, ...added.filter((a) => !ids.has(a.id))]
      .filter((p) => !gone.has(p.id))
      .map((p) => (patch[p.id] ? { ...p, ...patch[p.id] } : p));
  }, [base, added, gone, patch]);

  const arrivals = React.useMemo(
    () =>
      [...data.arrivals]
        .filter((a) => !goneArr.has(a.id))
        .sort((a, b) => new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime()),
    [data.arrivals, goneArr],
  );

  const merge = (id: string, fields: Partial<Member>) => setPatch((p) => ({ ...p, [id]: { ...p[id], ...fields } }));
  const toggleSet = (setter: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>, id: string, on: boolean) =>
    setter((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  async function run(
    actionId: string,
    input: Record<string, unknown>,
    optimistic: () => void,
    revert: () => void,
    message: { text: string; icon: 'check' | 'spinner' } | null,
  ) {
    optimistic();
    if (message) ok.show(message.text, message.icon);
    let error = 'That didn’t go through. Try again.';
    try {
      const res = await host.act(actionId, input);
      if (res.ok) {
        host.refresh?.();
        return;
      }
      error = res.error;
    } catch (e) {
      if (e instanceof Error && e.message) error = e.message;
    }
    revert();
    setError({ text: error, id: Date.now() });
  }

  const live: Live = {
    people,
    arrivals,
    waiting: Math.max(0, data.arrivalsWaiting - goneArr.size),
    total: data.total + added.length - gone.size,
    syncs: data.syncsInFlight === null && !storageTracked ? null : Math.max(0, (data.syncsInFlight ?? 0) + syncDelta),

    setRole: (m, role) => {
      const before = { role: m.role, storage: m.storage };
      const bump = m.storage !== null && m.storage !== 'pending' ? 1 : 0;
      return run(
        'org-person-role',
        { userId: m.id, role },
        () => {
          merge(m.id, { role, storage: m.storage === null ? null : 'pending' });
          setSyncDelta((d) => d + bump);
        },
        () => {
          merge(m.id, before);
          setSyncDelta((d) => d - bump);
        },
        { text: `${m.name} is now ${lower(role)} · syncing shared storage`, icon: 'spinner' },
      );
    },

    setListed: (m, listed) =>
      run(
        'org-person-listed',
        { userId: m.id, listed },
        () => merge(m.id, { listed }),
        () => merge(m.id, { listed: m.listed }),
        null,
      ),

    remove: (m) =>
      run(
        'org-person-remove',
        { userId: m.id },
        () => toggleSet(setGone, m.id, true),
        () => toggleSet(setGone, m.id, false),
        { text: `Removed ${m.name} · storage access revoked in the next sync`, icon: 'spinner' },
      ),

    welcome: (a, role) => {
      const template = base.find((p) => !p.isYou && p.can.roles.length > 0);
      const member: Member = {
        id: a.userId,
        name: a.name,
        handle: a.handle,
        initials: a.initials,
        role,
        listed: false,
        storage: storageTracked ? 'pending' : null,
        joinedAt: new Date().toISOString(),
        lastSeenAt: null,
        arrivedFrom: a.fromSite,
        isYou: false,
        can: template
          ? { roles: template.can.roles, reason: null, list: template.can.list, remove: template.can.remove }
          : { roles: [], reason: null, list: false, remove: false },
      };
      const bump = storageTracked ? 1 : 0;
      return run(
        'org-arrival-welcome',
        { arrivalId: a.id, role },
        () => {
          toggleSet(setGoneArr, a.id, true);
          setAdded((l) => [...l, member]);
          setSyncDelta((d) => d + bump);
        },
        () => {
          toggleSet(setGoneArr, a.id, false);
          setAdded((l) => l.filter((x) => x.id !== member.id));
          setSyncDelta((d) => d - bump);
        },
        { text: `${a.name} welcomed as ${lower(role)} · syncing shared storage`, icon: 'spinner' },
      );
    },

    dismiss: (a) =>
      run(
        'org-arrival-dismiss',
        { arrivalId: a.id },
        () => toggleSet(setGoneArr, a.id, true),
        () => toggleSet(setGoneArr, a.id, false),
        { text: `Dismissed ${a.name}`, icon: 'check' },
      ),

    toast: (
      <>
        {ok.node}
        {error ? (
          <Frame elev="md" className="hc-toast" role="alert" key={error.id} style={{ top: 112 }}>
            <span className="hc-icon-accent">
              <Icon name="error" size={16} />
            </span>
            {error.text}
          </Frame>
        ) : null}
      </>
    ),
  };
  return live;
}
