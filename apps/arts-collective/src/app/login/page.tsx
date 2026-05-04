import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/login-form";
import { SiteShell } from "@/components/site-shell";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/hub");

  return (
    <SiteShell>
      <Suspense fallback={<div className="mx-auto max-w-md py-16" />}>
        <LoginForm />
      </Suspense>
    </SiteShell>
  );
}
