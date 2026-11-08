'use client';

// Shared hub card primitives (README "Shared hub patterns"). Client-only, no
// next/*, no data. Every colour is a --hc-* token (theme/hub-cards.css).

import * as React from 'react';
import { loadFonts } from '@elkdonis/fonts';
import type { HubIconMap, HubIconName, HubRole } from '../contract';

// ── icon ────────────────────────────────────────────────────────────────────

const IconsContext = React.createContext<HubIconMap | null>(null);

export function Icon({ name, size = 16, className }: { name: HubIconName; size?: number; className?: string }) {
  const icons = React.useContext(IconsContext);
  const C = icons?.[name];
  if (!C) return null;
  return <C size={size} strokeWidth={1.5} className={className} aria-hidden="true" />;
}

// ── root: theme + tokens + icons ──────────────────────────────────────────

export interface HubRootProps {
  /** A subtree theme ('industry'), or none to wear the org's palette. */
  theme?: string | null;
  /** The org's resolved vars (site_themes + deriveRoleRamps), set inline on the root. */
  vars?: Record<string, string>;
  icons: HubIconMap;
  className?: string;
  children: React.ReactNode;
}

const THEME_FONTS: Record<string, string[]> = { industry: ['Barlow', 'Barlow Condensed'] };

export function HubRoot({ theme, vars, icons, className, children }: HubRootProps) {
  React.useEffect(() => {
    const fonts = theme ? THEME_FONTS[theme] : undefined;
    if (fonts) loadFonts(fonts);
  }, [theme]);
  return (
    <IconsContext.Provider value={icons}>
      <div
        className={['hc', className].filter(Boolean).join(' ')}
        data-hub-theme={theme ?? undefined}
        style={vars as React.CSSProperties | undefined}
      >
        {children}
      </div>
    </IconsContext.Provider>
  );
}

// ── frame (blueprint) ────────────────────────────────────────────────────

export function Corners() {
  return (
    <>
      <i className="hc-corner tl" />
      <i className="hc-corner tr" />
      <i className="hc-corner bl" />
      <i className="hc-corner br" />
    </>
  );
}

type FrameProps<T extends React.ElementType> = {
  as?: T;
  elev?: 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export function Frame<T extends React.ElementType = 'div'>({ as, elev, className, children, ...rest }: FrameProps<T>) {
  const Tag = (as ?? 'div') as React.ElementType;
  const cls = ['hc-frame', elev ? `hc-elev-${elev}` : '', className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} {...rest}>
      <Corners />
      {children}
    </Tag>
  );
}

// ── buttons ──────────────────────────────────────────────────────────────

export type BtnVariant = 'primary' | 'secondary' | 'ghost';

export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  icon?: HubIconName;
  iconSize?: number;
  small?: boolean;
  /** Icon-only square button (34×34). Needs aria-label. */
  square?: boolean;
}

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = 'secondary', icon, iconSize = 16, small, square, className, children, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'hc-btn',
    `hc-btn-${variant}`,
    small ? 'hc-btn-sm' : '',
    square ? 'hc-btn-icon' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {variant === 'primary' ? <Corners /> : null}
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
    </button>
  );
});

/** A link styled as a button (View ↗, Open page ↗). */
export function BtnLink({
  variant = 'ghost', icon, className, children, ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: BtnVariant; icon?: HubIconName }) {
  return (
    <a className={['hc-btn', `hc-btn-${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </a>
  );
}

/** Stop a click inside a card from opening the card's pop-up. */
export const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// ── tags and chips ──────────────────────────────────────────────────────

export function Tag({ tone = 'neutral', className, children, ...rest }: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'editor' | 'template' | 'outline' | 'neutral' | 'accent';
}) {
  return <span className={['hc-tag', `hc-tag-${tone}`, className].filter(Boolean).join(' ')} {...rest}>{children}</span>;
}

const ROLE_WORD: Record<HubRole, string> = { owner: 'Owner', guide: 'Guide', member: 'Member', viewer: 'Viewer' };

export function RoleChip({ role, reason }: { role: HubRole; reason?: string | null }) {
  return <span className={`hc-tag hc-role-${role}`} title={reason ?? undefined}>{ROLE_WORD[role]}</span>;
}

// ── segmented ──────────────────────────────────────────────────────────

export interface SegOption<V extends string> {
  value: V;
  label: React.ReactNode;
  count?: number;
  icon?: HubIconName;
  disabled?: boolean;
  title?: string;
}

export function Segmented<V extends string>({ value, options, onChange, label, className }: {
  value: V;
  options: Array<SegOption<V>>;
  onChange(v: V): void;
  label: string;
  className?: string;
}) {
  return (
    <div className={['hc-seg', className].filter(Boolean).join(' ')} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? <Icon name={o.icon} size={15} /> : null}
          {o.label}
          {o.count !== undefined ? <span className="hc-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ── square toggle ──────────────────────────────────────────────────────

export function Toggle({ checked, onChange, disabled, label, title }: {
  checked: boolean;
  onChange?(next: boolean): void;
  disabled?: boolean;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="hc-toggle"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
    />
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <span className="hc-chev" data-open={open}>
      <Icon name="chevron-right" size={16} />
    </span>
  );
}

// ── tabs ───────────────────────────────────────────────────────────────

export interface TabDef {
  id: string;
  label: string;
  count?: number;
  /** Shown instead of the count when the tab is locked (guides: Visitors "Owners only"). */
  locked?: string;
}

export function Tabs({ tabs, active, onChange, size }: {
  tabs: TabDef[];
  active: string;
  onChange(id: string): void;
  /** Tab font size: 19 (Site Builder) or 17 (Members). */
  size?: number;
}) {
  return (
    <div className="hc-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          className="hc-tab"
          aria-selected={t.id === active}
          disabled={Boolean(t.locked)}
          style={size ? { fontSize: size } : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.locked ? (
            <span className="hc-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'var(--hc-font-body)' }}>
              <Icon name="lock" size={13} />
              {t.locked}
            </span>
          ) : t.count !== undefined ? (
            <span className="hc-pill">{t.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ── pop-up ─────────────────────────────────────────────────────────────

export function Popup({ icon, title, titleSize = 24, width, top = 104, onClose, onOpenPage, children, footer, meta }: {
  icon: HubIconName;
  title: string;
  /** Beside the title ("16 people"). */
  meta?: React.ReactNode;
  titleSize?: number;
  width: number;
  top?: number;
  onClose(): void;
  onOpenPage?(): void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="hc-scrim" style={{ top: 52 }} onClick={onClose} aria-hidden="true" />
      <Frame elev="lg" className="hc-popup" role="dialog" aria-label={title} style={{ width, top }}>
        <div className="hc-popup-head">
          <span style={{ display: 'flex', color: 'var(--hc-accent)' }}><Icon name={icon} size={20} /></span>
          <span className="hc-title" style={{ fontSize: titleSize, marginRight: meta ? 0 : undefined }}>{title}</span>
          {meta ? <span className="hc-muted" style={{ fontSize: 13, marginRight: 'auto' }}>{meta}</span> : null}
          {onOpenPage ? <Btn variant="ghost" onClick={onOpenPage}>Open page ↗</Btn> : null}
          <Btn variant="ghost" square icon="close" iconSize={18} aria-label="Close" onClick={onClose} />
        </div>
        {children}
        {footer ? <div className="hc-popup-foot">{footer}</div> : null}
      </Frame>
    </>
  );
}

// ── confirm dialog ─────────────────────────────────────────────────────

export function ConfirmDialog({ title, body, note, action, onCancel, onConfirm, busy }: {
  title: string;
  body: React.ReactNode;
  /** The storage-effect strip (cloud icon). */
  note?: React.ReactNode;
  action: string;
  onCancel(): void;
  onConfirm(): void;
  busy?: boolean;
}) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="hc-dialog-backdrop" onClick={onCancel}>
      <Frame elev="lg" className="hc-dialog" role="alertdialog" aria-label={title} onClick={stop}>
        <div className="hc-dialog-title">{title}</div>
        <div style={{ fontSize: 15 }}>{body}</div>
        {note ? (
          <div className="hc-info">
            <Icon name="cloud" size={16} />
            <span>{note}</span>
          </div>
        ) : null}
        <div className="hc-dialog-actions">
          <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
          <Btn ref={confirmRef} variant="primary" onClick={onConfirm} disabled={busy}>{action}</Btn>
        </div>
      </Frame>
    </div>
  );
}

// ── toast ──────────────────────────────────────────────────────────────

export interface ToastState {
  text: string;
  icon: 'check' | 'spinner';
  id: number;
}

/** README: Site Builder 3.2 s with a check; Members 3.4 s with a spinner. */
export function useToast(ms: number) {
  const [toast, setToast] = React.useState<ToastState | null>(null);
  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), ms);
    return () => window.clearTimeout(t);
  }, [toast, ms]);
  const show = React.useCallback((text: string, icon: ToastState['icon'] = 'check') => {
    setToast({ text, icon, id: Date.now() });
  }, []);
  const node = toast ? (
    <Frame elev="md" className="hc-toast" role="status" key={toast.id}>
      <span className={['hc-icon-accent', toast.icon === 'spinner' ? 'hc-spin' : ''].join(' ')}>
        <Icon name={toast.icon} size={16} />
      </span>
      {toast.text}
    </Frame>
  ) : null;
  return { show, node };
}

// ── avatar ─────────────────────────────────────────────────────────────

export function Avatar({ initials, size = 30, arrival }: { initials: string; size?: number; arrival?: boolean }) {
  return (
    <span
      className="hc-avatar"
      data-arrival={arrival ? 'true' : undefined}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="hc-spin"><Icon name="spinner" size={size} /></span>;
}

// ── thumbnail + placeholder (README 1c) ─────────────────────────────────

export function Thumb({ url, title, width, height, large }: {
  url: string | null;
  title: string;
  width: number | string;
  height: number;
  /** Large sizes (grid card and up) draw the title and the note; small ones a file icon. */
  large?: boolean;
}) {
  if (url) {
    return (
      <span className="hc-thumb hc-frame" style={{ width, height }}>
        <img src={url} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="hc-thumb hc-thumb-empty hc-frame" style={{ width, height }} aria-label={`${title}: no preview yet`}>
      <span className="hc-thumb-inner">
        {large ? (
          <>
            <span className="hc-thumb-title">{title}</span>
            <span className="hc-thumb-note">No preview yet. One is taken the next time this page is saved.</span>
          </>
        ) : (
          <span style={{ width: '26%', display: 'flex' }}>
            <Icon name="file" size={typeof width === 'number' ? Math.round(width * 0.26) : 22} />
          </span>
        )}
      </span>
    </span>
  );
}

// ── misc ───────────────────────────────────────────────────────────────

/** "Anna Dahl" → "AD". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
