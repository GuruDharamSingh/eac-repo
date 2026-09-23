"use client";

import { useCallback, useEffect, useState } from "react";
import { ThemeStudio } from "@/components/studio/theme-studio";
import { NavEditor } from "@/components/studio/nav-editor";
import { loadThemeForEditor, saveThemeAction } from "@/lib/theme-actions";
import { loadNavForEditor, saveNavAction } from "@/lib/navigation-actions";
import { applyThemeToDocument } from "@/lib/theme-preview";
import type { Palette } from "@/lib/theme";
import type { SiteFonts } from "@/lib/fonts";
import type { NavItem } from "@/lib/navigation";

// ============================================================================
// The editor's Theme and Menu tabs — the same editors as /studio/theme and
// /studio/navigation, in Puck's left rail.
//
// THE CANVAS IS THE PREVIEW. Puck draws the page in an iframe
// (#preview-frame) that mirrored the site's <style> when it mounted; the
// Theme tab puts its draft on that iframe's <html> as inline variables, so
// the page being edited wears the new colours and fonts as they are chosen.
//
// A Puck plugin panel unmounts when another tab is opened, so the draft is
// kept here, at module level, for the life of this editor page: switch to
// Blocks, come back, and the unsaved choices are still there (and still on
// the canvas). Leaving the page with an unsaved theme asks first.
// ============================================================================

type Theme = { palette: Palette; fonts: SiteFonts };

let memo: { saved: Theme; draft: Theme; nav: NavItem[] } | null = null;

const canvasDoc = () =>
  (document.getElementById("preview-frame") as HTMLIFrameElement | null)?.contentDocument ?? null;

const warn = (e: BeforeUnloadEvent) => e.preventDefault();
function armLeaveWarning(dirty: boolean) {
  window.removeEventListener("beforeunload", warn);
  if (dirty) window.addEventListener("beforeunload", warn);
}

/**
 * Keep the draft on the canvas. The canvas iframe is rebuilt by Puck now and
 * then (a viewport switch, a remount), which drops anything put on it — so
 * this re-applies whenever the mark is missing. Mounted once by PageEditor.
 */
export function useCanvasTheme() {
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!memo || JSON.stringify(memo.draft) === JSON.stringify(memo.saved)) return;
      const doc = canvasDoc();
      if (doc?.documentElement && !doc.documentElement.hasAttribute("data-dm-theme-draft")) {
        applyThemeToDocument(doc, memo.draft.palette, memo.draft.fonts);
      }
    }, 800);
    return () => window.clearInterval(id);
  }, []);
}

export function ThemeTab() {
  const [state, setState] = useState(memo);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (memo) return;
    loadThemeForEditor().then((res) => {
      if ("error" in res) return setError(res.error);
      const saved = { palette: res.palette, fonts: res.fonts };
      memo = { saved, draft: saved, nav: res.nav };
      setState(memo);
    });
  }, []);

  const onDraft = useCallback((palette: Palette, fonts: SiteFonts) => {
    if (!memo) return;
    memo = { ...memo, draft: { palette, fonts } };
    armLeaveWarning(JSON.stringify(memo.draft) !== JSON.stringify(memo.saved));
    const doc = canvasDoc();
    if (doc?.documentElement) applyThemeToDocument(doc, palette, fonts);
  }, []);

  const onSaved = useCallback((palette: Palette, fonts: SiteFonts) => {
    if (!memo) return;
    memo = { ...memo, saved: { palette, fonts }, draft: { palette, fonts } };
    armLeaveWarning(false);
  }, []);

  if (error) return <p className="dm-hud dm-hud-error">{error}</p>;
  if (!state) return <p className="dm-hud dm-hud-muted">Loading…</p>;
  return (
    <div className="dm-ts-rail">
      <ThemeStudio
        mode="rail"
        initialPalette={state.draft.palette}
        initialFonts={state.draft.fonts}
        saved={state.saved}
        nav={state.nav}
        onSave={saveThemeAction}
        onDraft={onDraft}
        onSaved={onSaved}
      />
      <p className="dm-hud dm-hud-muted" style={{ minHeight: 0 }}>
        More room, and a live preview of any page: <a href="/studio/theme">the full Theme page</a>.
      </p>
    </div>
  );
}

export function MenuTab({ current }: { current: NavItem }) {
  const [state, setState] = useState<{ nav: NavItem[]; candidates: NavItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNavForEditor().then((res) => ("error" in res ? setError(res.error) : setState({ nav: res.nav, candidates: res.candidates })));
  }, []);

  if (error) return <p className="dm-hud dm-hud-error">{error}</p>;
  if (!state) return <p className="dm-hud dm-hud-muted">Loading…</p>;
  return (
    <div>
      <div className="dm-hud" style={{ minHeight: 0, paddingBottom: 0 }}>
        <h2>Menu</h2>
        <p className="dm-hud-muted">The links down the side of every page: titles, order, addresses.</p>
      </div>
      <NavEditor
        initial={state.nav}
        candidates={state.candidates}
        current={current}
        onSave={async (items) => {
          const res = await saveNavAction(items);
          if (res.ok) setState((s) => (s ? { ...s, nav: items } : s));
          return res;
        }}
      />
    </div>
  );
}
