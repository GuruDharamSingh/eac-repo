"use client";

import { NavEditor as SharedNavEditor, type MenuSlot } from "@elkdonis/page-builder";
import type { NavItem } from "@/lib/navigation";

/**
 * Her navigation editor: the shared one (@elkdonis/page-builder's NavEditor)
 * dressed in her own `dm-*` classes, so hud.css styles it exactly as before.
 *
 * Used by the full /studio/navigation page and, through MenuTab, the page
 * editor's narrow Menu tab. How the menu LOOKS (colours, font, size) is the
 * theme's — see /studio/theme.
 */
const CLASSES: Partial<Record<MenuSlot, string>> = {
  row: "dm-hud-row",
  primary: "dm-hud-primary",
  muted: "dm-hud-muted",
  list: "dm-nav-list",
  card: "dm-nav-card",
  cardSub: "dm-nav-card dm-nav-card--sub",
  n: "dm-nav-n",
  fields: "dm-nav-fields",
  title: "dm-nav-title",
  href: "dm-nav-href",
  tools: "dm-nav-tools",
  icon: "dm-hud-icon",
};

export function NavEditor({
  initial,
  candidates,
  onSave,
  current,
}: {
  initial: NavItem[];
  candidates: NavItem[];
  onSave: (items: NavItem[]) => Promise<{ ok: boolean; error?: string }>;
  /** The page being edited, offered first when it is not in the menu yet. */
  current?: NavItem;
}) {
  return (
    <SharedNavEditor
      className="dm-hud dm-hud-stack dm-nav-editor"
      classNames={CLASSES}
      initial={initial}
      candidates={candidates}
      onSave={onSave}
      current={current}
      footer={
        <p className="dm-hud-muted">
          How the menu looks — its colours, font and size — is in <a href="/studio/theme">Theme</a>.
        </p>
      }
    />
  );
}
