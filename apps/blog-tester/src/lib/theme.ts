'use client';

import { createTheme } from '@mantine/core';

export const minimalTheme = createTheme({
  primaryColor: 'dark',
  fontFamily: '"Inter", sans-serif',
  headings: {
    fontFamily: '"Merriweather", Georgia, serif',
    fontWeight: '700',
  },
  defaultRadius: 'xs',
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
        variant: 'outline',
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'none',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'transparent',
          borderColor: '#eaeaea',
        },
      },
    },
  },
});
