import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/login-form";
import { SiteShell } from "@/components/site-shell";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) {
    const { next } = await searchParams;
    // Same rule as the form's returnTo, on the server: a path stays here, an
    // absolute URL leaves through the handoff (which itself refuses origins
    // outside the network).
    if (next && next.startsWith("/") && !next.startsWith("//")) redirect(next);
    if (next && /^https?:\/\//.test(next)) redirect(`/api/auth/handoff?to=${encodeURIComponent(next)}`);
    redirect("/hub");
  }

  return (
    <SiteShell>
      <Suspense fallback={<div className="mx-auto max-w-md py-16" />}>
        <LoginForm />
      </Suspense>
    </SiteShell>
  );
}
