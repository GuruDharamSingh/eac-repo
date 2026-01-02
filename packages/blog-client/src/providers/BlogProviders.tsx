'use client';

import { MantineProvider, type MantineThemeOverride } from '@mantine/core';

export interface BlogProvidersProps {
  children: React.ReactNode;
  theme?: MantineThemeOverride;
}

export function BlogProviders({ children, theme }: BlogProvidersProps) {
  return (
    <MantineProvider theme={theme}>{children}</MantineProvider>
  );
}
