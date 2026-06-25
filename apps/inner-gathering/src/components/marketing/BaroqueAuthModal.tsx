"use client";

import { Modal } from "@mantine/core";
import { BaroqueSignup } from "@elkdonis/ui";
import type { AuthMode } from "@elkdonis/auth-client";

interface BaroqueAuthModalProps {
  opened: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  /** Where to send the browser after a successful sign-in / sign-up. */
  returnTo?: string;
}

/**
 * Mantine Modal wrapper around the gilt-framed BaroqueSignup card. Cloudflare
 * Turnstile and the "Continue with Google" button are provided by BaroqueSignup
 * itself (Turnstile renders when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set).
 */
export function BaroqueAuthModal({
  opened,
  onClose,
  initialMode = "signup",
  returnTo,
}: BaroqueAuthModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="auto"
      withCloseButton={false}
      padding={0}
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.7, blur: 4 }}
      styles={{ content: { background: "transparent", boxShadow: "none" } }}
    >
      <BaroqueSignup
        initialMode={initialMode}
        googleRedirectTo={returnTo}
        onSuccess={({ mode }) => {
          if (returnTo) {
            window.location.href = returnTo;
          } else {
            window.location.href = mode === "signup" ? "/feed?welcome=1" : "/feed";
          }
        }}
      />
    </Modal>
  );
}
