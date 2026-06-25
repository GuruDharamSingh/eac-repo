"use client";

import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { signInWithGoogle } from "@elkdonis/auth-client";
import type { AuthMode } from "@elkdonis/auth-client";
import { BaroqueAuthModal } from "./BaroqueAuthModal";

/**
 * Slim login / redirect bar shown beneath the Current Work Question. Offers a
 * one-tap "Continue with Google", a "Create account" button that opens the
 * baroque sign-in modal, and a quiet "Sign in" link for returning members.
 */
export function WorkQuestionLoginBar() {
  const [opened, { open, close }] = useDisclosure(false);
  const [mode, setMode] = useState<AuthMode>("signup");

  const launch = (next: AuthMode) => {
    setMode(next);
    open();
  };

  return (
    <div className="cwq-login-bar">
      <span className="cwq-login-prompt">Join the conversation</span>

      <div className="cwq-login-actions">
        <button
          type="button"
          className="cwq-login-btn cwq-login-btn--google"
          onClick={() => signInWithGoogle("/feed")}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          className="cwq-login-btn cwq-login-btn--primary"
          onClick={() => launch("signup")}
        >
          Create account
        </button>

        <button
          type="button"
          className="cwq-login-link"
          onClick={() => launch("signin")}
        >
          Sign in
        </button>
      </div>

      <BaroqueAuthModal opened={opened} onClose={close} initialMode={mode} returnTo="/feed" />
    </div>
  );
}
