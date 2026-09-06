import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { LoginForm } from "@/components/login-form";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Sign in — IFAC" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const session = await getServerSession();
  // Already signed in — nothing to do here. Honour ?next so a claim-prompt
  // or /manage-style round trip lands where it meant to.
  if (session.user) redirect(next ?? "/hub");

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
