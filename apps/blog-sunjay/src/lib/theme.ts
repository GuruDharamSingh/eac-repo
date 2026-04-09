'use client';

import { createTheme, MantineColorsTuple } from '@mantine/core';

/**
 * Sunjay's Blog - Dark Medieval Theme
 * 
 * A dark, shadowy theme with stone grays, deep blues,
 * and gold accents evoking medieval castle halls.
 */

// Custom gold color palette
const sacredGold: MantineColorsTuple = [
  '#fef9e7',
  '#fcf0c3',
  '#f7e08a',
  '#e6c040',
  '#c9a227',
  '#a88520',
  '#87691a',
  '#664d14',
  '#45340e',
  '#241a07',
];

// Deep stone/shadow colors
const stoneDeep: MantineColorsTuple = [
  '#eaeaee',
  '#d5d5dd',
  '#ababbb',
  '#81819a',
  '#5a5a72',
  '#45455a',
  '#303042',
  '#1e1e2a',
  '#16161e',
  '#12121a',
];

export const sunjayTheme = createTheme({
  primaryColor: 'sacredGold',
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  headings: {
    fontFamily: '"Cinzel", "Cormorant Garamond", Georgia, serif',
    fontWeight: '500',
  },
  defaultRadius: 'sm',
  
  colors: {
    sacredGold,
    stoneDeep,
  },

  // Dark mode
  primaryShade: { light: 4, dark: 4 },

  // Components customization
  components: {
    Button: {
      defaultProps: {
        size: 'md',
        radius: 'sm',
      },
      styles: {
        root: {
          fontWeight: 500,
          letterSpacing: '0.02em',
        },
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'lg',
        radius: 'sm',
      },
      styles: {
        root: {
          backgroundColor: 'rgba(30, 30, 42, 0.9)',
          borderColor: 'rgba(201, 162, 39, 0.15)',
        },
      },
    },
    Title: {
      styles: {
        root: {
          letterSpacing: '0.03em',
        },
      },
    },
    Text: {
      styles: {
        root: {
          lineHeight: 1.8,
        },
      },
    },
  },
});
