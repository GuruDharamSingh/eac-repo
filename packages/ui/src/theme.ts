import { createTheme, MantineColorsTuple } from '@mantine/core';

/**
 * EAC shared Mantine theme
 *
 * Use this theme across all apps for consistent styling:
 *
 * ```tsx
 * import { eacTheme } from '@elkdonis/ui';
 *
 * <MantineProvider theme={eacTheme}>
 *   {children}
 * </MantineProvider>
 * ```
 */
export const eacTheme = createTheme({
  primaryColor: 'indigo',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  defaultRadius: 'md',

  // Standardize focus ring behavior
  focusRing: 'auto',

  // Respect user's color scheme preference
  respectReducedMotion: true,

  // Component defaults
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    Select: {
      defaultProps: {
        size: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
      },
    },
  },
});

// Re-export Mantine types for convenience
export type { MantineColorsTuple };
