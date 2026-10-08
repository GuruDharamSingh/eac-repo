import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginClient } from "@/components/login-client";
import { DirectoryShell } from "@/components/shell/DirectoryShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — ArtDirect" };

type Props = { searchParams: Promise<{ redirect?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { redirect: redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(redirectTo || "/");

  return (
    <DirectoryShell current="login">
      <div className="ad-desk">
        <Suspense fallback={<div className="ad-sheet" data-size="narrow" />}>
          <LoginClient />
        </Suspense>
      </div>
    </DirectoryShell>
  );
}
