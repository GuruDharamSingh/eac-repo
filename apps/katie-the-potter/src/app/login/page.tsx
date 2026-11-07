import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentOrigin, ssoCheckUrl } from "@elkdonis/auth-server";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/auth";

export const metadata = { title: "Sign in — Katie the Potter", robots: { index: false, follow: false } };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; sso?: string; mode?: string }>;
}

/** Only a same-site path is followed: `next` arrives in a URL anyone can craft. */
function safeNext(next: string | undefined): string | undefined {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const viewer = await getViewer();
  if (viewer) redirect(next ?? "/");

  // One silent trip through the network host first: if the visitor already
  // signed in on another site of the collective, this finds that session.
  // `next` and `mode` (signup, from a claim link) ride along.
  if (!sp.sso) {
    const here = await currentOrigin();
    const q = new URLSearchParams({ ...(next ? { next } : {}), ...(sp.mode === "signup" ? { mode: "signup" } : {}), sso: "1" });
    const check = ssoCheckUrl(here, `/login?${q.toString()}`);
    if (check) redirect(check);
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-md py-16" />}>
      <LoginForm />
    </Suspense>
  );
}
