'use client';

import { useEffect, useState, useCallback } from 'react';

type SiteConfig = Record<string, unknown>;

const KEYS = ['fundraising', 'featured_artist', 'initiative', 'featured_events'] as const;
type ConfigKey = (typeof KEYS)[number];

const KEY_LABELS: Record<ConfigKey, string> = {
  fundraising: 'Fundraising',
  featured_artist: 'Featured Artist',
  initiative: 'Current Initiative',
  featured_events: 'Featured Events',
};

interface ThreadOption {
  id: string;
  kind: string;
  title: string;
  authorName: string | null;
  avatarUrl: string | null;
  dateTime: string | null;
}

export default function AdminPage() {
  const [config, setConfig] = useState<Record<ConfigKey, SiteConfig>>({
    fundraising: {},
    featured_artist: {},
    initiative: {},
    featured_events: {},
  });
  const [threadOptions, setThreadOptions] = useState<ThreadOption[]>([]);
  const [threadQuery, setThreadQuery] = useState('');
  const [saving, setSaving] = useState<ConfigKey | null>(null);
  const [saved, setSaved] = useState<ConfigKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/site-config');
      if (res.status === 401) { setAuthError(true); return; }
      const data = await res.json();
      const next: Record<ConfigKey, SiteConfig> = { fundraising: {}, featured_artist: {}, initiative: {}, featured_events: {} };
      for (const row of data.config ?? []) {
        if (KEYS.includes(row.key)) next[row.key as ConfigKey] = row.value;
      }
      setConfig(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (threadQuery.trim()) params.set('q', threadQuery.trim());
    fetch(`/api/admin/featured-events/options${params.size ? `?${params.toString()}` : ''}`)
      .then((res) => res.ok ? res.json() : { threads: [] })
      .then((data) => setThreadOptions(Array.isArray(data.threads) ? data.threads : []))
      .catch(() => setThreadOptions([]));
  }, [threadQuery]);

  const patch = async (key: ConfigKey, value: SiteConfig) => {
    setSaving(key);
    setSaved(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/site-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaved(key);
      setTimeout(() => setSaved(null), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const set = (key: ConfigKey, field: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  if (authError) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.h2}>Access denied</h2>
        <p style={styles.muted}>You need to be signed in as an admin to access this page.</p>
        <a href="/api/auth/session" style={styles.link}>Check session →</a>
      </div>
    </div>
  );

  if (loading) return (
    <div style={styles.page}><p style={styles.muted}>Loading…</p></div>
  );

  const f = config.fundraising as any;
  const fa = config.featured_artist as any;
  const ini = config.initiative as any;
  const fe = config.featured_events as any;
  const featuredThreadIds = Array.isArray(fe.threadIds) ? fe.threadIds as string[] : [];

  const toggleFeaturedThread = (threadId: string) => {
    const nextIds = featuredThreadIds.includes(threadId)
      ? featuredThreadIds.filter((id) => id !== threadId)
      : [...featuredThreadIds, threadId];
    setConfig((prev) => ({
      ...prev,
      featured_events: { ...prev.featured_events, threadIds: nextIds },
    }));
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Elkdonis Arts Collective</p>
        <h1 style={styles.h1}>Site Admin</h1>
        <hr style={styles.rule} />
      </header>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* ── Fundraising ─────────────────────────────────── */}
      <section style={styles.card}>
        <h2 style={styles.h2}>Fundraising</h2>
        <p style={styles.muted}>Controls the fundraising section on the public landing page.</p>

        <Field label="Goal (CAD)">
          <input style={styles.input} type="number" value={f.goal ?? ''} onChange={(e) => set('fundraising', 'goal', Number(e.target.value))} />
        </Field>
        <Field label="Raised so far (CAD)">
          <input style={styles.input} type="number" value={f.raised ?? ''} onChange={(e) => set('fundraising', 'raised', Number(e.target.value))} />
        </Field>
        <Field label="Status note">
          <textarea style={styles.textarea} value={f.status ?? ''} onChange={(e) => set('fundraising', 'status', e.target.value)} rows={3} />
        </Field>
        <Field label="External link (Linktree / donation page)">
          <input style={styles.input} type="url" value={f.url ?? ''} onChange={(e) => set('fundraising', 'url', e.target.value)} />
        </Field>
        <Field label="Button label">
          <input style={styles.input} value={f.cta ?? ''} onChange={(e) => set('fundraising', 'cta', e.target.value)} placeholder="Support Our Work" />
        </Field>
        <ProgressBar goal={Number(f.goal) || 25000} raised={Number(f.raised) || 0} />
        <SaveRow keyName="fundraising" saving={saving} saved={saved} onSave={() => patch('fundraising', config.fundraising)} />
      </section>

      {/* ── Featured Artist ─────────────────────────────── */}
      <section style={styles.card}>
        <h2 style={styles.h2}>Featured Artist</h2>

        <Field label="Section eyebrow">
          <input style={styles.input} value={fa.eyebrow ?? ''} onChange={(e) => set('featured_artist', 'eyebrow', e.target.value)} placeholder="Featured Arts" />
        </Field>
        <Field label="Artist name">
          <input style={styles.input} value={fa.name ?? ''} onChange={(e) => set('featured_artist', 'name', e.target.value)} />
        </Field>
        <Field label="Description / discipline">
          <input style={styles.input} value={fa.description ?? ''} onChange={(e) => set('featured_artist', 'description', e.target.value)} />
        </Field>
        <Field label="Image URL (in /public)">
          <input style={styles.input} value={fa.image_url ?? ''} onChange={(e) => set('featured_artist', 'image_url', e.target.value)} placeholder="/danamccool.jpg" />
        </Field>
        <Field label="CTA label">
          <input style={styles.input} value={fa.cta ?? ''} onChange={(e) => set('featured_artist', 'cta', e.target.value)} placeholder="Make an Inquiry" />
        </Field>
        <SaveRow keyName="featured_artist" saving={saving} saved={saved} onSave={() => patch('featured_artist', config.featured_artist)} />
      </section>

      {/* ── Current Initiative ──────────────────────────── */}
      <section style={styles.card}>
        <h2 style={styles.h2}>Current Initiative</h2>

        <Field label="Eyebrow">
          <input style={styles.input} value={ini.eyebrow ?? ''} onChange={(e) => set('initiative', 'eyebrow', e.target.value)} />
        </Field>
        <Field label="Heading">
          <input style={styles.input} value={ini.heading ?? ''} onChange={(e) => set('initiative', 'heading', e.target.value)} />
        </Field>
        <Field label="Body copy">
          <textarea style={styles.textarea} value={ini.body ?? ''} onChange={(e) => set('initiative', 'body', e.target.value)} rows={5} />
        </Field>
        <Field label="CTA label">
          <input style={styles.input} value={ini.cta ?? ''} onChange={(e) => set('initiative', 'cta', e.target.value)} placeholder="Make an Inquiry" />
        </Field>
        <SaveRow keyName="initiative" saving={saving} saved={saved} onSave={() => patch('initiative', config.initiative)} />
      </section>

      {/* ── Featured Events ────────────────────────────── */}
      <section style={styles.card}>
        <h2 style={styles.h2}>Featured Events</h2>
        <p style={styles.muted}>Choose the Inner Gathering threads shown in the public featured events table.</p>

        <Field label="Search threads">
          <input style={styles.input} value={threadQuery} onChange={(e) => setThreadQuery(e.target.value)} placeholder="Search by title, body, or author" />
        </Field>

        <div style={styles.threadList}>
          {threadOptions.length === 0 ? (
            <p style={styles.muted}>No threads found.</p>
          ) : threadOptions.map((thread) => {
            const selected = featuredThreadIds.includes(thread.id);
            return (
              <label key={thread.id} style={selected ? styles.threadOptionSelected : styles.threadOption}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleFeaturedThread(thread.id)}
                />
                <span style={styles.threadOptionMain}>
                  <strong>{thread.title}</strong>
                  <small>{thread.kind}{thread.authorName ? ` · ${thread.authorName}` : ''}</small>
                </span>
              </label>
            );
          })}
        </div>
        <p style={styles.muted}>{featuredThreadIds.length} selected.</p>
        <SaveRow keyName="featured_events" saving={saving} saved={saved} onSave={() => patch('featured_events', config.featured_events)} />
      </section>

      <footer style={{ textAlign: 'center', padding: '3rem 0', color: '#555', fontSize: '0.75rem' }}>
        Elkdonis Arts Collective admin — content changes appear live on the public site within 60 seconds.
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function ProgressBar({ goal, raised }: { goal: number; raised: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return (
    <div style={{ margin: '1.25rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
        <span>CAD ${raised.toLocaleString()} raised</span>
        <span>Goal: ${goal.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #c9a962, #f0db9d)', borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function SaveRow({ keyName, saving, saved, onSave }: { keyName: ConfigKey; saving: ConfigKey | null; saved: ConfigKey | null; onSave: () => void }) {
  const isSaving = saving === keyName;
  const isSaved = saved === keyName;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
      <button onClick={onSave} disabled={isSaving} style={isSaving ? styles.btnDisabled : styles.btn}>
        {isSaving ? 'Saving…' : 'Save'}
      </button>
      {isSaved && <span style={{ color: '#6ee7b7', fontSize: '0.85rem' }}>Saved ✓</span>}
    </div>
  );
}

const styles = {
  page: { maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem', fontFamily: 'var(--font-sans)', color: '#f3f4f6', background: '#050505', minHeight: '100vh' } as React.CSSProperties,
  header: { textAlign: 'center' as const, marginBottom: '3rem' },
  h1: { fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: '2.5rem', margin: '0.5rem 0', color: '#f3f4f6' },
  h2: { fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: '1.5rem', margin: '0 0 0.5rem', color: '#e2d9c9' },
  eyebrow: { fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#c6a45a', margin: 0 },
  rule: { border: 'none', borderTop: '1px solid #c6a45a44', margin: '1.5rem auto', width: 60 },
  card: { background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 12, padding: '2rem', marginBottom: '1.5rem' },
  muted: { color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem' },
  label: { display: 'block', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#9ca3af', marginBottom: '0.4rem' },
  input: { width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#f3f4f6', padding: '0.6rem 0.8rem', fontSize: '0.9rem', boxSizing: 'border-box' as const, outline: 'none' },
  textarea: { width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#f3f4f6', padding: '0.6rem 0.8rem', fontSize: '0.9rem', boxSizing: 'border-box' as const, resize: 'vertical' as const, outline: 'none' },
  btn: { background: '#c6a45a', color: '#07070b', border: 'none', borderRadius: 6, padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  btnDisabled: { background: '#4b4b4b', color: '#888', border: 'none', borderRadius: 6, padding: '0.6rem 1.5rem', fontSize: '0.85rem', cursor: 'not-allowed' },
  link: { color: '#c6a45a', textDecoration: 'none', fontSize: '0.9rem' },
  errorBanner: { background: '#3b0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '0.75rem 1rem', color: '#fca5a5', marginBottom: '1.5rem', fontSize: '0.875rem' },
  threadList: { display: 'grid', gap: '0.55rem', maxHeight: 360, overflowY: 'auto' as const, paddingRight: '0.35rem', margin: '1rem 0' },
  threadOption: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: '1px solid #2a2a2a', borderRadius: 8, background: '#111', cursor: 'pointer' },
  threadOptionSelected: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: '1px solid #c6a45a', borderRadius: 8, background: '#17140b', cursor: 'pointer' },
  threadOptionMain: { display: 'grid', gap: '0.2rem', minWidth: 0 },
};
