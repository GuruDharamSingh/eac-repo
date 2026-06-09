import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginClient } from "@/components/login-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — ArtDirect" };

type Props = { searchParams: Promise<{ redirect?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { redirect: redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(redirectTo || "/");

  return (
    <main style={{ minHeight: "100vh", background: "#121413", display: "flex", alignItems: "center", padding: "2.5rem 1.5rem" }}>
      <div style={{ width: "100%" }}>
        <Suspense fallback={<div style={{ maxWidth: 420, margin: "0 auto" }} />}>
          <LoginClient />
        </Suspense>
      </div>
    </main>
  );
}
