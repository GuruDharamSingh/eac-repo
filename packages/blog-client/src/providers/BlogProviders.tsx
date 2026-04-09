'use client';

import { MantineProvider, type MantineThemeOverride } from '@mantine/core';
import { eacTheme } from '@elkdonis/ui';

export interface BlogProvidersProps {
  children: React.ReactNode;
  theme?: MantineThemeOverride;
}

export function BlogProviders({ children, theme }: BlogProvidersProps) {
  // Use shared EAC theme as default, allow overrides
  const mergedTheme = theme ? { ...eacTheme, ...theme } : eacTheme;
  return (
    <MantineProvider theme={mergedTheme}>{children}</MantineProvider>
  );
}
