"use client";

import * as React from "react";
import { looksLikeHtml } from "./format";

// Small pieces the layers share. Class names are the kit's own (`osf-*`).

export function Prose({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  const cls = `osf-prose${className ? ` ${className}` : ""}`;
  if (looksLikeHtml(text)) return <div className={cls} dangerouslySetInnerHTML={{ __html: text }} />;
  return (
    <div className={cls}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="osf-label">{children}</span>;
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  multiline?: boolean;
}) {
  return (
    <label className="osf-field">
      <span className="osf-mono-label">{label}</span>
      {multiline ? (
        <textarea className="osf-input" rows={3} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="osf-input" type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function Radio({
  selected,
  onPick,
  children,
  aside,
}: {
  selected: boolean;
  onPick: () => void;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={`osf-radio${selected ? " is-on" : ""}`} onClick={onPick}>
      <i className="osf-dot" aria-hidden />
      <span className="osf-radio-text">{children}</span>
      {aside ? <span className="osf-radio-aside">{aside}</span> : null}
    </button>
  );
}

export function Failure({ error, loginHref }: { error: string | null; loginHref?: string }) {
  if (!error) return null;
  return (
    <p className="osf-error" role="alert">
      {error}
      {loginHref ? (
        <>
          {" "}
          <a href={loginHref}>Sign in</a>
        </>
      ) : null}
    </p>
  );
}

export function Avatar({ src, size = 24, ring }: { src?: string | null; size?: number; ring?: boolean }) {
  const style = { width: size, height: size } as React.CSSProperties;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`osf-av${ring ? " is-ring" : ""}`} style={style} src={src} alt="" loading="lazy" />
  ) : (
    <i className={`osf-av osf-ph${ring ? " is-ring" : ""}`} style={style} aria-hidden />
  );
}

/** A name that opens a profile layer. */
export function NameLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="osf-namelink" onClick={onClick}>
      {children}
    </button>
  );
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
