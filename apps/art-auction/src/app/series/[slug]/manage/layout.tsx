import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Newsreader } from "next/font/google";
import { siteConfig } from "@/config/site";
import { loadWorkspace } from "./load";
import { cormorant, jost } from "../series-fonts";
import { WorkspaceNav, StatusControl } from "./workspace-chrome";
import "./workspace.css";

export const dynamic = "force-dynamic";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Workspace · ${slug}`, robots: { index: false } };
}

const PHASE: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "is-warn" },
  announced: { label: "Announced", tone: "is-accent" },
  silent: { label: "Silent bidding", tone: "is-ok" },
  live: { label: "Live close", tone: "is-bad" },
  closed: { label: "Settling / closed", tone: "is-plain" },
};

/**
 * The series workspace (2026-10-28), after mock-up 1 of
 * https://claude.ai/artifact/JJaM9ksambaDQXAZiuQsEX: its own top bar and side
 * menu (the marketplace header and footer are hidden by SiteChrome), for a
 * presenting org's desk to run one series from set-up through settling.
 */
export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const phase = PHASE[series.phase] ?? { label: series.phase, tone: "is-plain" };
  return (
    <div className={`sw ${newsreader.variable} ${cormorant.variable} ${jost.variable}`}>
      <header className="sw-top">
        <div className="sw-top-left">
          <Link href="/" className="sw-brand">{siteConfig.name}</Link>
          <span className="sw-sep">/</span>
          <Link href={`/series/${series.slug}/manage`} className="sw-crumb">{series.title}</Link>
          <span className={`sw-pill ${phase.tone}`}>{phase.label}</span>
        </div>
        <div className="sw-top-right">
          <a className="sw-btn is-quiet" href={`/series/${series.slug}`} target="_blank" rel="noopener">View page ↗</a>
          <StatusControl seriesId={series.id} slug={series.slug} status={series.status} />
        </div>
      </header>
      <div className="sw-frame">
        <WorkspaceNav slug={series.slug} lotCount={series.lotCount} />
        <main className="sw-main">
          <div className="sw-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
