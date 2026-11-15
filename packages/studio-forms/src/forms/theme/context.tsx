'use client';

// ============================================================================
// @elkdonis/studio/forms: the theme in React (pass 1, Tendons).
//
// A theme is two things: CSS that redefines --frm-* under [data-form-theme]
// (forms.css computes the defaults; broadsheet.css is one theme), and an icon
// map. Components ask for icons by FormIconName through <Icon>, never a
// library, so a theme can swap the set without touching a component.
// ============================================================================

import * as React from 'react';
import type { FormIconName, FormTheme } from '../contract';
import { defaultFormTheme } from './icons';

const FormThemeContext = React.createContext<FormTheme>(defaultFormTheme);

export function FormThemeProvider({ theme, children }: { theme?: FormTheme | null; children: React.ReactNode }) {
  return <FormThemeContext.Provider value={theme ?? defaultFormTheme}>{children}</FormThemeContext.Provider>;
}

export function useFormTheme(): FormTheme {
  return React.useContext(FormThemeContext);
}

/** One icon from the active theme's map. Decorative: the text beside it carries the meaning. */
export function Icon({ name, size = 16, className }: { name: FormIconName; size?: number; className?: string }) {
  const { icons } = useFormTheme();
  const C = icons[name];
  return C ? <C size={size} className={className} /> : null;
}

/**
 * The root every forms surface draws inside: it is where --frm-* are computed
 * (forms.css) and where a theme attribute redefines them. Anything portalled
 * out of the shell (StudioTopActions) needs its own root to keep the tokens.
 */
export function FormRoot({
  theme,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: {
  theme?: FormTheme | null;
  as?: 'div' | 'span' | 'section';
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  const t = theme ?? defaultFormTheme;
  return (
    <FormThemeProvider theme={t}>
      <Tag className={className ? `frm ${className}` : 'frm'} data-form-theme={t.attr || undefined} {...rest}>
        {children}
      </Tag>
    </FormThemeProvider>
  );
}
