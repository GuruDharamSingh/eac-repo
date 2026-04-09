'use client';

import { createTheme, type MantineColorsTuple } from '@mantine/core';

const saffron: MantineColorsTuple = [
  '#fffde7',
  '#fff9c4',
  '#fff176',
  '#ffee58',
  '#f4c430',
  '#e6b422',
  '#d4a017',
  '#b8860b',
  '#8d6708',
  '#5c4405',
];

const terracotta: MantineColorsTuple = [
  '#fdf2ee',
  '#fae3d9',
  '#f2a080',
  '#e88060',
  '#e67e50',
  '#d16b47',
  '#b85a38',
  '#8c3e28',
  '#5f2a1b',
  '#321510',
];

const charcoal: MantineColorsTuple = [
  '#f0f2f3',
  '#d8dcdf',
  '#adb5bb',
  '#7f8d96',
  '#5a6a73',
  '#46555d',
  '#36454f',
  '#2c3840',
  '#1e2b31',
  '#111c22',
];

export const amritTheme = createTheme({
  primaryColor: 'saffron',
  primaryShade: { light: 4, dark: 4 },
  fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
  headings: {
    fontFamily: "'Cinzel', 'Palatino Linotype', Palatino, serif",
    fontWeight: '600',
  },
  defaultRadius: 'md',
  colors: {
    saffron,
    terracotta,
    charcoal,
  },
  components: {
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
  },
});
