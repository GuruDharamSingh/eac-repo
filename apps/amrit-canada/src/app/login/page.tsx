import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentOrigin, ssoCheckUrl } from "@elkdonis/auth-server";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; sso?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, sso } = await searchParams;
  const viewer = await getViewer();
  // Already signed in — nothing to do here. Honour ?next so the /manage gate's
  // round trip lands where it meant to.
  if (viewer) redirect(next ?? "/");

  // One silent trip through the network host before showing the form: if the
  // person signed in on another site of the collective, this finds that
  // session and lands them back here already signed in — see
  // mirrorLoginHref/ssoCheckUrl. `sso` marks that we already tried, so the
  // chain never loops: whatever the network host finds, we render below.
  if (!sso) {
    const here = await currentOrigin();
    const loginPath = `/login?${new URLSearchParams({ ...(next ? { next } : {}), sso: "1" }).toString()}`;
    const check = ssoCheckUrl(here, loginPath);
    if (check) redirect(check);
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-md py-16" />}>
      <LoginForm />
    </Suspense>
  );
}
