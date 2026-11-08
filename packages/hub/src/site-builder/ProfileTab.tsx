'use client';

// Detail page, Profile tab (1m/1n): the org's identity card, what kind of org it is, and how the network shows it.

import * as React from 'react';
import { Btn, Frame, Tag } from '../ui/primitives';
import type { SiteBuilderHost } from './host';
import type { SiteLive } from './live';
import { ORG_KINDS, type OrgIdentity, type OrgKind, type SiteBuilderDetailData } from './model';
import { NO_KINDS_HINT, Overline, fontStack, kindName } from './parts';

const MAX_LINE = 120;

const same = (a: OrgIdentity, b: OrgIdentity) =>
  a.name === b.name && a.line === b.line && a.where === b.where && a.markUrl === b.markUrl &&
  a.primaryKind === b.primaryKind && a.alsoKinds.join() === b.alsoKinds.join();

function Mark({ identity, data, size, font }: { identity: OrgIdentity; data: SiteBuilderDetailData; size: number; font: number }) {
  const c = data.theme.colors;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
        background: c.accent2, color: c.paper, fontFamily: fontStack(data.theme.headingFont), fontWeight: 700, fontSize: font,
        border: identity.markUrl ? '1px solid var(--hc-n-400)' : '1px dashed var(--hc-n-400)',
      }}
    >
      {identity.markUrl ? <img src={identity.markUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : data.org.mark}
    </span>
  );
}

export function ProfileTab({ data, host, live }: {
  data: SiteBuilderDetailData;
  host: SiteBuilderHost;
  live: SiteLive;
}) {
  const { can } = data;
  const [saved, setSaved] = React.useState<OrgIdentity>(data.identity);
  const [draft, setDraft] = React.useState<OrgIdentity>(data.identity);
  React.useEffect(() => {
    setSaved(data.identity);
    setDraft(data.identity);
  }, [data.identity]);
  const [busy, setBusy] = React.useState(false);
  const [markBusy, setMarkBusy] = React.useState(false);
  const [markErr, setMarkErr] = React.useState('');
  const file = React.useRef<HTMLInputElement>(null);
  const uid = React.useId();

  const dirty = !same(draft, saved);
  const edit = can.editIdentity;
  const kindsOn = can.kinds && edit;
  const set = (patch: Partial<OrgIdentity>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleAlso = (k: OrgKind) =>
    set({ alsoKinds: draft.alsoKinds.includes(k) ? draft.alsoKinds.filter((x) => x !== k) : [...draft.alsoKinds, k] });
  const makeMain = (k: OrgKind) =>
    set({
      primaryKind: k,
      alsoKinds: [...draft.alsoKinds.filter((x) => x !== k), ...(draft.primaryKind && draft.primaryKind !== k ? [draft.primaryKind] : [])],
    });

  async function save() {
    if (!dirty || busy) return;
    const before = saved;
    const input: Record<string, unknown> = { name: draft.name, line: draft.line, where: draft.where };
    // A newly uploaded mark is saved with the card (the identity row's picture).
    if (draft.markUrl && draft.markUrl !== before.markUrl) input.markUrl = draft.markUrl;
    if (can.kinds) {
      if (draft.primaryKind) input.primaryKind = draft.primaryKind;
      input.alsoKinds = draft.alsoKinds;
    }
    setBusy(true);
    setSaved(draft);
    live.say('Identity card saved. The network shows the new card now.');
    const err = await live.call('site-identity-save', input);
    setBusy(false);
    if (err) {
      setSaved(before);
      live.fail(err);
    }
  }

  async function pickMark(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !host.uploadImage) return;
    setMarkBusy(true);
    setMarkErr('');
    try {
      const res = await host.uploadImage(f, 'mark');
      if (res.ok && res.value) set({ markUrl: res.value.url, markName: res.value.name });
      else if (!res.ok) setMarkErr('error' in res && res.error ? res.error : 'That upload didn’t go through.');
    } catch (e2) {
      setMarkErr(e2 instanceof Error && e2.message ? e2.message : 'That upload didn’t go through.');
    }
    setMarkBusy(false);
  }

  const also = draft.alsoKinds.filter((k) => k !== draft.primaryKind);
  const lineLen = draft.line.length;

  return (
    <div>
      <p style={{ margin: '0 0 18px', fontSize: 15, maxWidth: 760 }}>
        How the platform sees {data.org.name}. This identity card travels across the network and says what kind of org this is. It
        replaces the org card form on /center.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 44, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0, flex: '1 1 460px' }}>
          <section>
            <h5 style={{ fontSize: 20 }}>What kind of org this is</h5>
            <p style={{ margin: '4px 0 12px', fontSize: 14, color: 'var(--hc-n-800)' }}>
              One thing it mostly is, and anything it also does. Click a kind to add or remove it.
            </p>
            {!can.kinds ? <p className="hc-hint" style={{ margin: '0 0 12px', fontSize: 13.5 }}>{NO_KINDS_HINT}</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
              {ORG_KINDS.map((k) => {
                const main = can.kinds && draft.primaryKind === k.id;
                const isAlso = can.kinds && !main && draft.alsoKinds.includes(k.id);
                const stateWord = main ? 'mostly' : isAlso ? 'also' : 'off';
                return (
                  <div
                    key={k.id}
                    style={{
                      position: 'relative', minHeight: 124, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column',
                      border: `1px solid ${main ? 'var(--hc-accent)' : isAlso ? 'var(--hc-a-400)' : 'var(--hc-divider)'}`,
                      background: main ? 'var(--hc-accent)' : isAlso ? 'color-mix(in srgb, var(--hc-accent) 7%, transparent)' : 'transparent',
                      color: main ? 'var(--hc-on-accent)' : 'var(--hc-text)',
                      borderRadius: 'var(--hc-radius)',
                      opacity: can.kinds ? 1 : 0.85,
                    }}
                  >
                    {kindsOn ? (
                      <button
                        type="button"
                        aria-pressed={main || isAlso}
                        aria-label={`${k.name}: ${stateWord}`}
                        onClick={() => {
                          if (!main) toggleAlso(k.id);
                        }}
                        style={{ position: 'absolute', inset: 0, background: 'transparent', border: 0, cursor: main ? 'default' : 'pointer', padding: 0 }}
                      />
                    ) : null}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, pointerEvents: 'none' }}>
                      <span style={{ fontFamily: 'var(--hc-font-heading)', fontWeight: 'var(--hc-heading-weight)', fontSize: 22, lineHeight: 1.15 }}>{k.name}</span>
                      {main ? <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Mostly</span> : null}
                      {isAlso ? <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hc-a-700)' }}>Also</span> : null}
                    </div>
                    <div style={{ fontSize: 14, marginTop: 4, color: main ? 'var(--hc-on-accent)' : 'var(--hc-n-800)', pointerEvents: 'none' }}>{k.note}</div>
                    {isAlso && kindsOn ? (
                      <Btn
                        variant="ghost"
                        style={{ marginTop: 'auto', alignSelf: 'flex-start', position: 'relative', fontSize: 13.5 }}
                        onClick={() => makeMain(k.id)}
                      >
                        Make this the main one
                      </Btn>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h5 style={{ fontSize: 20, marginBottom: 12 }}>The card</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '14px 18px' }}>
              <div>
                <label htmlFor={`${uid}-name`} className="hc-label">Name</label>
                <input id={`${uid}-name`} className="hc-input" value={draft.name} disabled={!edit} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-where`} className="hc-label">Where</label>
                <input
                  id={`${uid}-where`}
                  className="hc-input"
                  value={draft.where}
                  disabled={!edit}
                  placeholder="A city, a few cities, or Online"
                  onChange={(e) => set({ where: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label htmlFor={`${uid}-line`} className="hc-label">Short line</label>
                  <span style={{ fontSize: 12, color: lineLen > MAX_LINE ? 'var(--hc-a-800)' : 'var(--hc-n-700)', marginBottom: 5 }}>{lineLen} / {MAX_LINE}</span>
                </div>
                <textarea
                  id={`${uid}-line`}
                  className="hc-input"
                  rows={2}
                  maxLength={MAX_LINE}
                  value={draft.line}
                  disabled={!edit}
                  onChange={(e) => set({ line: e.target.value })}
                />
                <div className="hc-hint">Shown under the name wherever the card appears.</div>
              </div>
              <div>
                <span className="hc-label" id={`${uid}-mark`}>Mark</span>
                <div role="group" aria-labelledby={`${uid}-mark`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mark identity={draft} data={data} size={44} font={16} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: draft.markUrl ? 'var(--hc-text)' : 'var(--hc-n-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {draft.markUrl ? (draft.markName ?? draft.markUrl.slice(draft.markUrl.lastIndexOf('/') + 1)) : 'No mark yet. The initials are used.'}
                  </span>
                  {host.uploadImage && edit ? (
                    <>
                      <input ref={file} type="file" accept="image/*" hidden aria-label="Choose a mark image" onChange={pickMark} />
                      <Btn variant="ghost" disabled={markBusy} onClick={() => file.current?.click()}>
                        {markBusy ? 'Uploading…' : draft.markUrl ? 'Replace' : 'Upload'}
                      </Btn>
                    </>
                  ) : null}
                </div>
                {markErr ? <div className="hc-error" role="alert" style={{ marginTop: 4 }}>{markErr}</div> : null}
              </div>
              <div>
                <label htmlFor={`${uid}-site`} className="hc-label">Website</label>
                <input id={`${uid}-site`} className="hc-input" value={data.org.domain} readOnly style={{ color: 'var(--hc-n-700)' }} />
              </div>
            </div>
          </section>
        </div>

        <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: '0 1 380px', minWidth: 0 }}>
          <Overline>How the network shows it</Overline>
          <Frame style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: 'transparent' }}>
            <Mark identity={draft} data={data} size={52} font={19} />
            {draft.primaryKind ? (
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hc-a-700)' }}>{kindName(draft.primaryKind)}</div>
            ) : null}
            <div style={{ fontFamily: 'var(--hc-font-heading)', fontWeight: 'var(--hc-heading-weight)', fontSize: 23, lineHeight: 1.15 }}>
              {draft.name || data.org.name}
            </div>
            {draft.line ? <div style={{ fontSize: 15 }}>{draft.line}</div> : null}
            <div style={{ fontSize: 13.5, color: 'var(--hc-n-700)' }}>
              {draft.where ? `${draft.where} · ` : ''}{data.org.domain}
            </div>
            {also.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {also.map((k) => <Tag key={k} tone="outline">{kindName(k)}</Tag>)}
              </div>
            ) : null}
          </Frame>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--hc-n-800)' }}>
            Seen in the network directory, in Across the collective on members’ hubs, and in link previews when the site is shared.
          </p>
          {edit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13.5, color: dirty ? 'var(--hc-a-800)' : 'var(--hc-n-700)' }} role="status">
                {dirty ? 'Unsaved changes' : 'Saved'}
              </span>
              <Btn variant="primary" style={{ marginLeft: 'auto' }} disabled={!dirty || busy || !draft.name.trim()} onClick={() => void save()}>
                Save identity card
              </Btn>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
