'use client';

import { useState } from 'react';
import { MantineProvider, type MantineThemeOverride } from '@mantine/core';
import { SessionContextProvider, type Session } from '@supabase/auth-helpers-react';
import { getClientAuth } from '@elkdonis/auth-client';

export interface BlogProvidersProps {
  children: React.ReactNode;
  theme?: MantineThemeOverride;
  initialSession?: Session | null;
}

export function BlogProviders({ children, theme, initialSession }: BlogProvidersProps) {
  const [supabaseClient] = useState(() => getClientAuth());

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={initialSession}>
      <MantineProvider theme={theme}>{children}</MantineProvider>
    </SessionContextProvider>
  );
}
