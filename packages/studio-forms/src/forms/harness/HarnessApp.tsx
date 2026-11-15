'use client';

// ============================================================================
// The harness app (scripts/forms-harness): one canvas id, in one look, on
// sample data, through the real FormShell and the bone's useFormState. The
// steps before the screenshot (a save, a Publish press) are replayed as state
// events, so what shows is what the shell draws for that state.
// ============================================================================

import * as React from 'react';
import { useFormState } from '../state';
import { FormShell } from '../shell/FormShell';
import { useFormUi } from '../shell/ui';
import { broadsheetFormTheme, defaultFormTheme, ledgerDarkFormTheme, ledgerFormTheme, quickFormTheme } from '../theme/icons';
import type { FormTheme } from '../contract';
import { DARK_SITE_VARS, STUB_ACTIONS, harnessHost, type HarnessTheme } from './host';
import { HARNESS_PAGES, PUBLISHED_AT, SAVED_AT, harnessPresets, type HarnessPage } from './pages';
import { StatesSheet } from './StatesSheet';
import { JointsSheet } from './JointsSheet';

/** The look's form theme: Broadsheet, Ledger (light or dark), or none (plain, dark site). */
function themeOf(theme: HarnessTheme): FormTheme {
  if (theme === 'broadsheet') return broadsheetFormTheme;
  if (theme === 'ledger') return ledgerFormTheme;
  if (theme === 'ledger-dark') return ledgerDarkFormTheme;
  if (theme === 'ledger-quick') return quickFormTheme;
  return defaultFormTheme;
}

function FormPage({ page, theme }: { page: HarnessPage; theme: HarnessTheme }) {
  const schema = page.schema;
  const feeds = (page.ctx.fields.feeds as Array<{ slug: string; name: string }> | undefined) ?? [];
  const host = React.useMemo(() => harnessHost(theme, feeds), [theme, feeds]);
  const ctl = useFormState({
    schema,
    ctx: page.ctx,
    orgId: page.ctx.orgId,
    actions: STUB_ACTIONS,
    init: { answers: page.answers, openSections: page.open, presetId: page.presetId ?? null },
    autosaveMs: null,
  });
  const [ui, setUi] = useFormUi(page.ui);

  React.useEffect(() => {
    const record = { id: 'sample-1', slug: 'notes-from-the-first-press-weekend' };
    for (const step of page.steps) {
      if (step === 'attempt') ctl.dispatch({ type: 'attemptPublish' });
      if (step === 'saved') ctl.dispatch({ type: 'saveDone', id: 'sample-1', record, at: SAVED_AT, published: false });
      if (step === 'published') ctl.dispatch({ type: 'saveDone', id: 'sample-1', record, at: PUBLISHED_AT, published: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FormShell
      schema={schema}
      state={ctl.state}
      ui={ui}
      host={host}
      ctx={page.ctx}
      theme={themeOf(theme)}
      tier={page.tier ?? 'focus'}
      presets={harnessPresets(page.kind)}
      kinds={['post', 'meeting', 'artwork', 'service']}
      on={{
        patch: ctl.patch,
        toggleSection: ctl.toggleSection,
        ui: setUi,
        saveDraft: ctl.saveDraft,
        publish: ctl.publish,
        applyPreset: ctl.applyPreset,
        unpublish: () => ctl.dispatch({ type: 'unpublish' }),
        switchKind: () => undefined,
        makeAnother: () => undefined,
      }}
    />
  );
}

export function HarnessApp({ page, theme }: { page: string; theme: HarnessTheme }) {
  // A dark SITE sets its vars at :root (site_themes); the forms read them through the hooks.
  React.useLayoutEffect(() => {
    if (theme !== 'dark') return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(DARK_SITE_VARS)) root.style.setProperty(k, v);
    document.body.style.background = DARK_SITE_VARS['--eac-surface-bg'] ?? '';
  }, [theme]);

  if (page === '1i') return <StatesSheet theme={themeOf(theme)} />;
  if (page === 'joints' || page === 'joints-m') return <JointsSheet theme={themeOf(theme)} />;
  const p = HARNESS_PAGES[page];
  if (!p) return <p style={{ padding: 24 }}>No harness page "{page}".</p>;
  return <FormPage page={p} theme={theme} />;
}
