'use client';

import { MantineProvider } from '@mantine/core';
import { eacTheme } from '@elkdonis/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={eacTheme}>{children}</MantineProvider>;
}
