"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthForm } from "@elkdonis/auth-client";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function LoginInner() {
  const searchParams = useSearchParams();
  // Accept both `next` (used by the studio/admin guards) and `returnTo`.
  // Only honour same-origin relative paths to avoid open redirects.
  const rawReturn = searchParams.get("next") ?? searchParams.get("returnTo");
  const returnTo =
    rawReturn && rawReturn.startsWith("/") && !rawReturn.startsWith("//")
      ? rawReturn
      : null;
  const initialMode =
    searchParams.get("mode") === "signup" ? "signup" : "signin";

  // Shared, UI-agnostic auth logic from @elkdonis/auth-client.
  const f = useAuthForm({
    initialMode,
    collectDisplayName: true,
    onSuccess: () => {
      // Full-page nav so the freshly set session cookie is sent with the next
      // request (server-rendered guards rely on it).
      window.location.href = returnTo ?? "/";
    },
  });

  const isSignup = f.mode === "signup";

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {siteConfig.name}
          </p>
          <h1 className="font-serif text-3xl tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "Register to bid in auctions and follow the artists you love."
              : "Sign in to bid, check out, and track your orders."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {f.error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {f.error}
            </div>
          )}

          <form onSubmit={(e) => void f.submit(e)} className="space-y-4">
            {isSignup && (
              <Field label="Display name" htmlFor="displayName">
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  placeholder="How others see you (optional)"
                  value={f.displayName}
                  onChange={(e) => f.setDisplayName(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}

            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                value={f.email}
                onChange={(e) => f.setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                required
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder={
                  isSignup ? "At least 6 characters" : "Your password"
                }
                value={f.password}
                onChange={(e) => f.setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={f.submitting}
            >
              {f.submitting
                ? "Working…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isSignup
              ? "Already have an account? "
              : `New to ${siteConfig.name}? `}
            <button
              type="button"
              onClick={() => f.setMode(isSignup ? "signin" : "signup")}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          One account works across the Elkdonis Arts network.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
