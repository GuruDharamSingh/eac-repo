import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentOrigin, ssoCheckUrl } from "@elkdonis/auth-server";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/auth";

export const metadata = { title: "Sign in — Dana McCool" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; sso?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, sso } = await searchParams;
  const viewer = await getViewer();
  if (viewer) redirect(next ?? "/");

  // One silent trip through the network host first — if the visitor already
  // signed in on another site of the collective, this finds that session.
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
