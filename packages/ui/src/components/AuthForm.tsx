'use client';

/**
 * Universal auth UI — default-styled Mantine components for quick authwalls.
 *
 * - `<AuthForm>`     A sign-in / sign-up card, drop onto any page.
 * - `<AuthWall>`     The same form inside a modal — gate an action.
 * - `<RequireAuth>`  Renders children only when signed in, otherwise puts
 *                    up a (non-dismissable) auth wall.
 *
 * All three share the headless `useAuthForm` hook from `@elkdonis/auth-client`,
 * so apps with their own branded login pages can reuse the logic without the
 * default styling — see that hook directly.
 */

import { type ReactNode } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import {
  useAuthForm,
  useUser,
  type AuthMode,
  type AuthSuccess,
} from '@elkdonis/auth-client';

export interface AuthFormProps {
  /** Mode the form starts in. Default `'signin'`. */
  initialMode?: AuthMode;
  /** Show the signin/signup toggle link. Default `true`. */
  allowModeToggle?: boolean;
  /** Collect an optional display name on signup. Default `false`. */
  collectDisplayName?: boolean;
  /** Heading. Defaults to a mode-appropriate string. */
  title?: ReactNode;
  /** Optional contextual note shown under the heading. */
  description?: ReactNode;
  /** Called after successful auth — do redirects / `router.refresh()` here. */
  onSuccess?: (result: AuthSuccess) => void | Promise<void>;
  /** Render without the bordered Paper card (used by `<AuthWall>`). */
  bare?: boolean;
}

export function AuthForm({
  initialMode = 'signin',
  allowModeToggle = true,
  collectDisplayName = false,
  title,
  description,
  onSuccess,
  bare = false,
}: AuthFormProps) {
  const f = useAuthForm({ initialMode, collectDisplayName, onSuccess });
  const isSignup = f.mode === 'signup';

  const content = (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={3}>
          {title ?? (isSignup ? 'Create your account' : 'Welcome back')}
        </Title>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>

      {f.error && (
        <Alert color="red" radius="md" icon={<IconAlertCircle size={16} />}>
          {f.error}
        </Alert>
      )}

      <form onSubmit={(e) => void f.submit(e)}>
        <Stack gap="md">
          {isSignup && collectDisplayName && (
            <TextInput
              label="Display name"
              placeholder="How others see you (optional)"
              value={f.displayName}
              onChange={(e) => f.setDisplayName(e.currentTarget.value)}
            />
          )}
          <TextInput
            required
            type="email"
            label="Email"
            placeholder="your@email.com"
            autoComplete="email"
            value={f.email}
            onChange={(e) => f.setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            required
            label="Password"
            placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={f.password}
            onChange={(e) => f.setPassword(e.currentTarget.value)}
          />
          <Button type="submit" fullWidth loading={f.submitting}>
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </Stack>
      </form>

      {allowModeToggle && (
        <Group justify="center" gap={6}>
          <Text size="sm" c="dimmed">
            {isSignup ? 'Already have an account?' : 'New here?'}
          </Text>
          <Anchor component="button" type="button" size="sm" onClick={f.toggleMode}>
            {isSignup ? 'Sign in' : 'Create an account'}
          </Anchor>
        </Group>
      )}
    </Stack>
  );

  if (bare) return content;

  return (
    <Paper withBorder radius="md" p="xl" shadow="sm" w="100%" maw={420} mx="auto">
      {content}
    </Paper>
  );
}

export interface AuthWallProps extends Omit<AuthFormProps, 'bare'> {
  /** Whether the modal is open. */
  opened: boolean;
  /**
   * Called when the user dismisses the wall. Omit to make the wall
   * non-dismissable (no close button, no click-outside / escape).
   */
  onClose?: () => void;
}

export function AuthWall({ opened, onClose, ...formProps }: AuthWallProps) {
  const dismissable = typeof onClose === 'function';
  return (
    <Modal
      opened={opened}
      onClose={onClose ?? (() => {})}
      centered
      size="md"
      withCloseButton={dismissable}
      closeOnClickOutside={dismissable}
      closeOnEscape={dismissable}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <AuthForm bare {...formProps} />
    </Modal>
  );
}

export interface RequireAuthProps {
  /** Content shown once the user is authenticated. */
  children: ReactNode;
  /** Optional content rendered behind the wall while signed out. */
  fallback?: ReactNode;
  /** Collect an optional display name on signup. */
  collectDisplayName?: boolean;
  /** Heading for the auth wall. */
  title?: ReactNode;
  /** Contextual note for the auth wall. */
  description?: ReactNode;
  /** Mode the wall's form starts in. Default `'signin'`. */
  initialMode?: AuthMode;
}

/**
 * Gate any subtree behind authentication. While the session is loading a
 * spinner is shown; signed-out users get a non-dismissable `<AuthWall>`.
 * On success the page reloads so server components and `useUser` pick up
 * the new session.
 */
export function RequireAuth({
  children,
  fallback,
  collectDisplayName,
  title,
  description,
  initialMode,
}: RequireAuthProps) {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (user) return <>{children}</>;

  return (
    <>
      {fallback}
      <AuthWall
        opened
        collectDisplayName={collectDisplayName}
        title={title}
        description={description}
        initialMode={initialMode}
        onSuccess={() => {
          if (typeof window !== 'undefined') window.location.reload();
        }}
      />
    </>
  );
}
