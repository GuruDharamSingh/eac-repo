"use client";

import type { ReactNode } from "react";
import "./web.css";

// Shared pieces for the elktours WEB mocks (tour and experience page blocks). The markup and class names
// are copied from apps/elktours (blocks/tour/blocks.tsx, components/tours/tour-card.tsx, components/experiences/*);
// the app's providers, server data and "@/" imports are replaced by the invented sample in ./data.

/** Wrapper: elktours' colours (web.css) and a page-width column. */
export function WebFrame({ children }: { children: ReactNode }) {
  return <div className="em-web">{children}</div>;
}

export const Anchor = ({ className, children }: { className?: string; children: ReactNode }) => (
  <a href="#" onClick={(e) => e.preventDefault()} className={className}>
    {children}
  </a>
);

export function Facts({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
      {items.map((f) => (
        <div key={f.k} className="flex items-baseline gap-2">
          <dt className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{f.k}</dt>
          <dd>{f.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Initials({ name, size }: { name: string; size: number }) {
  const t = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return (
    <span style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }} className="inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-muted-foreground" aria-hidden>
      {t}
    </span>
  );
}

export function TourCardMock({ title, excerpt, meta, price, next, src }: { title: string; excerpt: string; meta: string; price: string; next: string; src: string }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="tour-card group block overflow-hidden border border-border bg-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{meta}</p>
        <h3 className="mt-1 font-serif text-xl leading-snug">{title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>
        <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">{price}</span>
          <span className="text-muted-foreground">{next}</span>
        </div>
      </div>
    </a>
  );
}

export function ExperienceCardMock({ title, excerpt, facts, artist, price, where, src }: { title: string; excerpt: string; facts: string; artist: string; price: string; where: string; src: string }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="group block overflow-hidden border border-border bg-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{facts}</p>
        <h3 className="mt-1 font-serif text-xl leading-snug">{title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-sm">
            <Initials name={artist} size={24} />
            <span className="truncate">
              <span className="text-muted-foreground">with </span>
              {artist}
            </span>
          </span>
          {price && <span className="shrink-0 text-sm font-medium">{price}</span>}
        </div>
        <p className="mt-2 truncate text-sm text-muted-foreground">{where}</p>
      </div>
    </a>
  );
}

/** A schematic route: dots on a line over a map-coloured panel (the real stage and story draw Google 3D tiles). */
export function RouteSketch({ stops, className }: { stops: number; className?: string }) {
  const pts = Array.from({ length: stops }, (_, i) => [40 + (i * 220) / Math.max(stops - 1, 1), 150 - Math.sin(i * 1.3) * 55 - i * 8]);
  return (
    <svg viewBox="0 0 300 200" className={`em-route-map w-full ${className ?? ""}`} role="img" aria-label="Route sketch">
      <path d="M0 170 Q60 130 120 160 T300 120 V200 H0Z" fill="hsl(var(--card))" opacity=".6" />
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="5 4" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="9" fill="hsl(var(--background))" stroke="hsl(var(--primary))" />
          <text x={p[0]} y={(p[1] ?? 0) + 3.5} textAnchor="middle" fontSize="10" fill="hsl(var(--primary))">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function BookBox({ priceLine, label, children, note }: { priceLine: ReactNode; label: string; children: ReactNode; note?: string }) {
  return (
    <aside className="mt-12 lg:mt-0">
      <div className="top-24 border border-border bg-card p-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1 font-serif text-2xl">{priceLine}</p>
        {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </aside>
  );
}
