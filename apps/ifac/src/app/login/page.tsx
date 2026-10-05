import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentOrigin, getServerSession, joinOrgsOnSignIn, ssoCheckUrl } from "@elkdonis/auth-server";
import { LoginForm } from "@/components/login-form";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Sign in — IFAC" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; sso?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, sso } = await searchParams;
  const session = await getServerSession();
  // Already signed in — nothing to do here. Honour ?next so a claim-prompt
  // or /manage-style round trip lands where it meant to.
  // A session found here — typically by the silent network check below —
  // is a sign-in through IFAC, so the account joins as a viewer (an existing
  // row keeps its role), same as the password and Google routes.
  if (session.user) {
    await joinOrgsOnSignIn(session.user.id, [{ id: siteConfig.orgId, role: "viewer" }], "login");
    redirect(next ?? "/hub");
  }

  // One silent trip through the network host before showing the form: if the
  // person signed in on another site of the collective, this finds that
  // session and lands them back here already signed in. `sso` marks that we
  // already tried, so the chain never loops.
  if (!sso) {
    const here = await currentOrigin();
    const loginPath = `/login?${new URLSearchParams({ ...(next ? { next } : {}), sso: "1" }).toString()}`;
    const check = ssoCheckUrl(here, loginPath);
    if (check) redirect(check);
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <p className="kicker">{siteConfig.shortName}</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
