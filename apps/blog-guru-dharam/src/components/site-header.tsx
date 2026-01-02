'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BlogConfig } from '@elkdonis/blog-client';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface SiteHeaderProps {
  config: BlogConfig;
  isAuthenticated?: boolean;
}

export function SiteHeader({ config, isAuthenticated }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = config.navLinks ?? [];

  return (
    <header className="relative z-20 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <svg width="28" height="28" viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path
                d="M5 21V8l7-5 7 5v13M5 13h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Collective</p>
            <p className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {config.orgName}
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noreferrer' : undefined}
              className="transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href={isAuthenticated ? '/admin' : '/login'}>
              {isAuthenticated ? 'Admin' : 'Author sign in'}
            </Link>
          </Button>
          {config.hero?.ctaHref && config.hero?.ctaLabel ? (
            <Button size="sm" asChild>
              <Link href={config.hero.ctaHref}>{config.hero.ctaLabel}</Link>
            </Button>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Toggle navigation menu"
          className="lg:hidden"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/70">
            <span className="relative flex h-4 w-6 flex-col justify-between">
              <span
                className={cn(
                  'block h-0.5 w-full rounded bg-foreground transition',
                  menuOpen && 'translate-y-1.5 rotate-45'
                )}
              />
              <span
                className={cn(
                  'block h-0.5 w-full rounded bg-foreground transition',
                  menuOpen && 'opacity-0'
                )}
              />
              <span
                className={cn(
                  'block h-0.5 w-full rounded bg-foreground transition',
                  menuOpen && '-translate-y-1.5 -rotate-45'
                )}
              />
            </span>
          </div>
        </button>
      </div>

      {menuOpen ? (
        <div className="lg:hidden">
          <div className="mx-4 mb-4 rounded-3xl border border-border/80 bg-card p-6 shadow-2xl">
            <div className="flex flex-col gap-4 text-base font-semibold text-muted-foreground">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noreferrer' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-2xl px-4 py-3 transition hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <Button variant="outline" onClick={() => setMenuOpen(false)} asChild>
                <Link href={isAuthenticated ? '/admin' : '/login'}>
                  {isAuthenticated ? 'Go to admin' : 'Author sign in'}
                </Link>
              </Button>
              {config.hero?.ctaHref && config.hero?.ctaLabel ? (
                <Button onClick={() => setMenuOpen(false)} asChild>
                  <Link href={config.hero.ctaHref}>{config.hero.ctaLabel}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
