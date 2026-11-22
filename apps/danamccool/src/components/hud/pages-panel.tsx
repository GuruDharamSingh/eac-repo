"use client";

import { PagesPanel as SharedPagesPanel, type PagesPanelSlot } from "@elkdonis/page-builder";
import { listPagesForHud } from "@/lib/hud-actions";

// ============================================================================
// Pages: the shared panel (page-builder `PagesPanel`) in Dana's `dm-hud` look,
// opening pages in her editor (`/studio/<path>`). Shown in the editor's left
// rail and on /hub, so both read the same list.
// ============================================================================

const CLASSES: Partial<Record<PagesPanelSlot, string>> = {
  root: "dm-hud dm-hud-stack",
  spread: "dm-hud-spread",
  muted: "dm-hud-muted",
  error: "dm-hud-error",
  list: "dm-hud-list",
  card: "dm-hud-card",
  cardBody: "dm-hud-card-body",
  cardTitle: "dm-hud-card-title",
  row: "dm-hud-row",
  chip: "dm-hud-chip",
  btn: "dm-hud-btn",
};

const list = async () => {
  const res = await listPagesForHud();
  if ("error" in res) throw new Error(res.error);
  return res.pages;
};
const hrefOf = (slug: string) => `/studio/${slug}`;

export function PagesPanel({ current }: { current?: string }) {
  return <SharedPagesPanel list={list} hrefOf={hrefOf} current={current} hubHref="/hub" classes={CLASSES} />;
}
