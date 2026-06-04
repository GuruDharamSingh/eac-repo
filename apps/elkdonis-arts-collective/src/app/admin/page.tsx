'use client';

import { useEffect, useState, useCallback } from 'react';

type SiteConfig = Record<string, unknown>;

const KEYS = ['fundraising', 'featured_artist', 'initiative', 'featured_events', 'image_spaces'] as const;
type ConfigKey = (typeof KEYS)[number];

interface ThreadOption {
  id: string;
  kind: string;
  title: string;
  authorName: string | null;
  avatarUrl: string | null;
  dateTime: string | null;
}

interface MediaGalleryItem {
  filename: string;
  basename: string;
  size: number;
  type: 'file' | 'directory';
  mime?: string;
}

const IMAGE_SPACE_OPTIONS = [
  { key: 'intro_banner', label: 'Intro Banner (below Work Question)' },
  { key: 'featured_artist', label: 'Featured Artist Image' },
] as const;

type ImageSpaceKey = (typeof IMAGE_SPACE_OPTIONS)[number]['key'];

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i;

export default function AdminPage() {
  const [config, setConfig] = useState<Record<ConfigKey, SiteConfig>>({
    fundraising: {},
    featured_artist: {},
    initiative: {},
    featured_events: {},
    image_spaces: {},
  });
  const [threadOptions, setThreadOptions] = useState<ThreadOption[]>([]);
  const [threadQuery, setThreadQuery] = useState('');
  const [saving, setSaving] = useState<ConfigKey | null>(null);
  const [saved, setSaved] = useState<ConfigKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mediaPath, setMediaPath] = useState('EAC_Network');
  const [mediaItems, setMediaItems] = useState<MediaGalleryItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageSpaceKey, setImageSpaceKey] = useState<ImageSpaceKey>('intro_banner');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/site-config');
      if (res.status === 401) { setAuthError(true); return; }
      const data = await res.json();
      const next: Record<ConfigKey, SiteConfig> = { fundraising: {}, featured_artist: {}, initiative: {}, featured_events: {}, image_spaces: {} };
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

  const loadMediaItems = useCallback(async (path: string) => {
    setMediaLoading(true);
    try {
      const res = await fetch('/api/admin/media-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (res.ok) {
        setMediaPath(data.path || path);
        setMediaItems(Array.isArray(data.files) ? data.files : []);
      } else {
        setError(data.error || 'Failed to load media gallery');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMediaItems(mediaPath);
  }, [loadMediaItems]);

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
  const imageSpaces = (config.image_spaces ?? {}) as Record<string, { path?: string; alt?: string }>;
  const featuredThreadIds = Array.isArray(fe.threadIds) ? fe.threadIds as string[] : [];
  const selectedSpace = imageSpaces[imageSpaceKey] ?? {};

  const buildMediaSrc = (path?: string) => {
    if (!path) return '';
    return `/api/media/file?path=${encodeURIComponent(path)}`;
  };

  const assignImageToSpace = (path: string) => {
    setConfig((prev) => ({
      ...prev,
      image_spaces: {
        ...(prev.image_spaces as Record<string, { path?: string; alt?: string }>),
        [imageSpaceKey]: {
          path,
          alt: imageSpaceKey === 'intro_banner'
            ? 'Collective banner image'
            : 'Featured artist image',
        },
      },
    }));
  };

  const clearImageSpace = () => {
    setConfig((prev) => ({
      ...prev,
      image_spaces: {
        ...(prev.image_spaces as Record<string, { path?: string; alt?: string }>),
        [imageSpaceKey]: { path: '', alt: '' },
      },
    }));
  };

  const goUpFolder = () => {
    const parts = mediaPath.replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    void loadMediaItems(parts.join('/'));
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', mediaPath);

      const res = await fetch('/api/admin/media-gallery/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      await loadMediaItems(mediaPath);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const folderItems = mediaItems.filter((item) => item.type === 'directory');
  const imageItems = mediaItems.filter((item) => item.type === 'file' && IMAGE_EXT_RE.test(item.basename));

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
        <Field label="Goals &amp; current work">
          <textarea style={styles.textarea} value={fa.goals ?? ''} onChange={(e) => set('featured_artist', 'goals', e.target.value)} rows={4} placeholder="Describe the artist's current projects or goals..." />
        </Field>
        <Field label="Link 1 — label">
          <input style={styles.input} value={fa.link1_label ?? ''} onChange={(e) => set('featured_artist', 'link1_label', e.target.value)} placeholder="Visit Website" />
        </Field>
        <Field label="Link 1 — URL">
          <input style={styles.input} type="url" value={fa.link1_url ?? ''} onChange={(e) => set('featured_artist', 'link1_url', e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Link 2 — label">
          <input style={styles.input} value={fa.link2_label ?? ''} onChange={(e) => set('featured_artist', 'link2_label', e.target.value)} placeholder="Make an Inquiry" />
        </Field>
        <Field label="Link 2 — URL">
          <input style={styles.input} type="url" value={fa.link2_url ?? ''} onChange={(e) => set('featured_artist', 'link2_url', e.target.value)} placeholder="https://..." />
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

      {/* ── Image Spaces + Media Gallery ───────────────────── */}
      <section style={styles.card}>
        <h2 style={styles.h2}>Homepage Image Spaces</h2>
        <p style={styles.muted}>Choose images from group folders in Nextcloud for image slots used on the public homepage.</p>

        <Field label="Image space target">
          <select
            style={styles.input}
            value={imageSpaceKey}
            onChange={(e) => setImageSpaceKey(e.target.value as ImageSpaceKey)}
          >
            {IMAGE_SPACE_OPTIONS.map((space) => (
              <option key={space.key} value={space.key}>{space.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Current selected image path">
          <input style={styles.input} value={selectedSpace.path ?? ''} readOnly placeholder="No image selected" />
        </Field>

        <div style={styles.folderBar}>
          <button type="button" onClick={goUpFolder} style={styles.smallBtn}>Up one folder</button>
          <button type="button" onClick={() => loadMediaItems('EAC_Network')} style={styles.smallBtn}>Go to groups root</button>
          <label style={uploadingImage ? styles.smallBtnDisabled : styles.smallBtn}>
            {uploadingImage ? 'Uploading…' : 'Upload image'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif"
              hidden
              disabled={uploadingImage}
              onChange={handleGalleryUpload}
            />
          </label>
          <button type="button" onClick={clearImageSpace} style={styles.smallBtnMuted}>Clear target image</button>
        </div>

        <p style={{ ...styles.muted, marginBottom: '0.35rem' }}>Browsing: {mediaPath}</p>
        <p style={{ ...styles.muted, marginBottom: '0.75rem' }}>Allowed upload types: JPG, JPEG, PNG, WEBP, GIF, AVIF.</p>

        {mediaLoading ? (
          <p style={styles.muted}>Loading gallery…</p>
        ) : (
          <>
            <div style={styles.galleryFolderGrid}>
              {folderItems.map((folder) => (
                <button
                  key={folder.filename}
                  type="button"
                  style={styles.folderTile}
                  onClick={() => loadMediaItems(folder.filename.replace(/^\/+/, ''))}
                >
                  {folder.basename}
                </button>
              ))}
            </div>

            <div style={styles.galleryImageGrid}>
              {imageItems.length === 0 ? (
                <p style={styles.muted}>No image files found in this folder.</p>
              ) : imageItems.map((file) => {
                const normalizedPath = file.filename.replace(/^\/+/, '');
                const assigned = selectedSpace.path === normalizedPath;
                return (
                  <div key={file.filename} style={assigned ? styles.galleryCardSelected : styles.galleryCard}>
                    <img
                      src={buildMediaSrc(normalizedPath)}
                      alt={file.basename}
                      style={styles.galleryThumb}
                      loading="lazy"
                    />
                    <p style={styles.galleryLabel}>{file.basename}</p>
                    <button type="button" style={styles.smallBtn} onClick={() => assignImageToSpace(normalizedPath)}>
                      {assigned ? 'Assigned' : 'Use this image'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <SaveRow keyName="image_spaces" saving={saving} saved={saved} onSave={() => patch('image_spaces', config.image_spaces)} />
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
  folderBar: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginBottom: '1rem' },
  smallBtn: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: 6, padding: '0.45rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' },
  smallBtnDisabled: { background: '#374151', color: '#9ca3af', border: '1px solid #4b5563', borderRadius: 6, padding: '0.45rem 0.75rem', fontSize: '0.75rem', cursor: 'not-allowed' },
  smallBtnMuted: { background: '#111827', color: '#d1d5db', border: '1px solid #374151', borderRadius: 6, padding: '0.45rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' },
  galleryFolderGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.55rem', marginBottom: '1rem' },
  folderTile: { background: '#151515', border: '1px solid #2a2a2a', borderRadius: 999, color: '#e5e7eb', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.76rem' },
  galleryImageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.8rem' },
  galleryCard: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '0.55rem', display: 'grid', gap: '0.55rem' },
  galleryCardSelected: { background: '#17140b', border: '1px solid #c6a45a', borderRadius: 8, padding: '0.55rem', display: 'grid', gap: '0.55rem' },
  galleryThumb: { width: '100%', height: 120, borderRadius: 6, objectFit: 'cover' as const, border: '1px solid #2a2a2a', background: '#080808' },
  galleryLabel: { margin: 0, fontSize: '0.72rem', color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
};
