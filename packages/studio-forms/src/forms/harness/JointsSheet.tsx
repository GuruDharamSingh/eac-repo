'use client';

// ============================================================================
// The pass 2 joints on their own (harness page `joints`, and `joints-m` at
// 390): GridRows in its row states and its narrow reflow, PicturesField with
// and without pictures, CreditRows with several roles. Drawn with the real
// components and live state, framed as a kind frames them, so every state can
// be seen even where a kind does not use it yet (artwork stores no variants
// in pass 2, so no kind draws a stacked grid).
// ============================================================================

import * as React from 'react';
import type { FormTheme } from '../contract';
import { CreditRows, type CreditValue } from '../fields/CreditRows';
import { Field } from '../fields/Field';
import { GridRows, type GridRow } from '../fields/GridRows';
import { Input } from '../fields/Input';
import { PicturesField, type PictureValue } from '../fields/PicturesField';
import type { MediaSlot } from '../fields/MediaField';
import { SAMPLE_PICTURE } from '../kinds/post';
import { FormRoot, Icon } from '../theme/context';

function dotPicture(fill: string, w: number, h: number): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><pattern id='d' width='4' height='4' patternUnits='userSpaceOnUse'><circle cx='2' cy='2' r='1.2' fill='#201e1d' fill-opacity='0.2'/></pattern></defs><rect width='100%' height='100%' fill='${fill}'/><rect width='100%' height='100%' fill='url(#d)'/></svg>`
    )
  );
}

const PICTURES: PictureValue[] = [
  { url: dotPicture('#d7d3d3', 400, 500), alt: 'Tidewater, No. 3: dark tide lines crossing a pale ground', focal: { x: 50, y: 40 } },
  { url: dotPicture('#cfcaca', 300, 300), alt: 'Detail of the aquatint grain' },
  { url: dotPicture('#dcd8d7', 300, 300), alt: 'The print framed in oak' },
  { url: dotPicture('#c9c4c3', 300, 300), alt: '' },
];

const stubMedia: MediaSlot = ({ onChange }) => (
  <button type="button" className="frm-btn frm-btn--secondary frm-btn--sm" onClick={() => onChange({ url: SAMPLE_PICTURE, alt: '' })}>
    Use the sample picture
  </button>
);

const SESSIONS = [
  { date: 'Thu 19 Nov', no: '1', title: 'Monotype basics', note: 'Aprons provided. Wear old shoes.' },
  { date: 'Thu 24 Dec', no: '6', title: '', note: '', skipped: 'Christmas Eve' },
  { date: 'Thu 7 Jan', no: '8', title: 'Drypoint on acetate', note: '' },
  { date: 'Thu 28 Jan', no: '11', title: '', note: '', added: true },
];

type Variant = { name: string; price: string; stock: string };

function Cell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <span className="frm-eyebrow">{title}</span>
      {children}
    </section>
  );
}

export function JointsSheet({ theme }: { theme: FormTheme }) {
  const [skipped, setSkipped] = React.useState<Record<string, boolean>>({ 'Thu 24 Dec': true });
  const [variants, setVariants] = React.useState<Variant[]>([
    { name: 'Unframed sheet', price: '180', stock: '14' },
    { name: 'Framed in oak', price: '320', stock: '4' },
  ]);
  const [pics, setPics] = React.useState<PictureValue[]>(PICTURES);
  const [none, setNone] = React.useState<PictureValue[]>([]);
  const [credits, setCredits] = React.useState<CreditValue[]>([
    { role: 'artist', userId: 'sample-mara', name: 'Mara Okafor' },
    { role: 'printer', name: 'Elkdonis Lab' },
  ]);
  const addVariant = React.useRef<HTMLButtonElement>(null);

  const sessionRows: GridRow[] = SESSIONS.map((s) => {
    const off = skipped[s.date] === true;
    return {
      key: s.date,
      state: off ? 'muted' : s.added === true ? 'highlighted' : 'normal',
      cells: {
        no: <span style={{ fontSize: 15, fontWeight: 600 }}>{s.no}</span>,
        date: <span style={{ fontSize: 13 }}>{s.date}</span>,
        title: off ? (
          <span style={{ fontStyle: 'italic' }}>Skipped: {s.skipped ?? 'by hand'}</span>
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={s.title ? undefined : { fontStyle: 'italic', color: 'var(--frm-muted)' }}>{s.title || `Session ${s.no}, no title yet`}</span>
            {s.note ? <span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--frm-muted)' }}>{s.note}</span> : null}
            {s.added === true ? <span className="frm-tag frm-tag--accent" style={{ alignSelf: 'flex-start' }}>New</span> : null}
          </span>
        ),
      },
      action: off
        ? { icon: 'restore', label: `Put ${s.date} back`, tone: 'accent', onClick: () => setSkipped((m) => ({ ...m, [s.date]: false })) }
        : { icon: 'skip', label: `Skip ${s.date}`, onClick: () => setSkipped((m) => ({ ...m, [s.date]: true })) },
    };
  });

  const variantRows: GridRow[] = variants.map((v, i) => {
    const set = (k: keyof Variant, x: string) => setVariants((list) => list.map((y, j) => (j === i ? { ...y, [k]: x } : y)));
    return {
      key: String(i),
      cells: {
        name: <Input id={`j-v${i}-name`} aria-label={`Variant ${i + 1}, name`} value={v.name} placeholder="Unframed sheet" onChange={(e) => set('name', e.target.value)} />,
        price: <Input id={`j-v${i}-price`} aria-label={`Variant ${i + 1}, price`} type="number" prefix="$" value={v.price} onChange={(e) => set('price', e.target.value)} />,
        stock: <Input id={`j-v${i}-stock`} aria-label={`Variant ${i + 1}, in stock`} type="number" value={v.stock} onChange={(e) => set('stock', e.target.value)} />,
      },
      action: { icon: 'close', label: `Remove ${v.name || `variant ${i + 1}`}`, onClick: () => setVariants((list) => list.filter((_, j) => j !== i)) },
    };
  });

  return (
    <FormRoot theme={theme} style={{ minHeight: '100%', padding: '28px clamp(16px, 4vw, 36px) 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, maxWidth: 600 }}>
        <Cell title="GridRows: normal, muted (skipped), highlighted (new)">
          <GridRows
            id="j-sessions"
            label="Sessions"
            columns={[
              { id: 'no', label: 'No.', strikeWhenMuted: true },
              { id: 'date', label: 'Date', strikeWhenMuted: true },
              { id: 'title', label: 'Title and note' },
            ]}
            template="24px 82px minmax(0,1fr)"
            rows={sessionRows}
          />
        </Cell>

        <Cell title="GridRows with inputs; at 390 Price and In stock move under the name">
          <GridRows
            id="j-variants"
            label="Variants"
            columns={[
              { id: 'name', label: 'Variant' },
              { id: 'price', label: 'Price', narrow: 'stack' },
              { id: 'stock', label: 'In stock', narrow: 'stack' },
            ]}
            template="minmax(0,1fr) 84px 64px"
            rows={variantRows}
            afterRef={addVariant}
            empty="No variants: the piece sells at its own price."
          />
          <button
            ref={addVariant}
            type="button"
            className="frm-btn frm-btn--ghost"
            style={{ alignSelf: 'flex-start', marginLeft: -5, fontSize: 13 }}
            onClick={() => setVariants((list) => [...list, { name: '', price: '', stock: '' }])}
          >
            <Icon name="plus" size={14} />
            Add a variant
          </button>
        </Cell>

        <Cell title="PicturesField: four pictures, focal point on">
          <Field id="j-pics" label="Pictures" labelAsText inlineHint="Drag to reorder. The first is the one on cards.">
            <PicturesField id="j-pics" value={pics} onChange={setPics} slot={stubMedia} />
          </Field>
        </Cell>

        <Cell title="PicturesField: none yet, Publish pressed">
          <Field id="j-pics0" label="Pictures" labelAsText problem={{ tone: 'error', message: 'Add at least one picture. The first is the one on cards.' }}>
            <PicturesField id="j-pics0" value={none} onChange={setNone} slot={stubMedia} tone="error" focal={false} describedBy="j-pics0-msg" />
          </Field>
        </Cell>

        <Cell title="CreditRows: a member and a typed name">
          <Field id="j-credits" label="Maker and credits" labelAsText>
            <CreditRows
              id="j-credits"
              value={credits}
              onChange={setCredits}
              people={[
                { value: 'sample-mara', label: 'Mara Okafor' },
                { value: 'sample-teo', label: 'Teo Lindqvist' },
              ]}
              max={4}
            />
          </Field>
        </Cell>
      </div>
    </FormRoot>
  );
}
