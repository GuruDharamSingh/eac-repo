import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentOrigin, ssoCheckUrl } from "@elkdonis/auth-server";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/auth";
import { BASE_PATH, withBase } from "@/lib/base-path";

export const metadata: Metadata = { title: "Sign in" };

/** Only same-site paths are honoured as a return target — never a full URL. */
function safeNext(next: string | undefined): string | undefined {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sso?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const viewer = await getViewer();
  if (viewer) redirect(next ?? "/");

  // One silent trip through the network host before showing the form: someone
  // already signed in elsewhere on the collective lands back here signed in.
  // `sso` marks that we already tried, so the chain can never loop.
  if (!params.sso) {
    const here = await currentOrigin();
    const loginPath = `/login?${new URLSearchParams({ ...(next ? { next } : {}), sso: "1" }).toString()}`;
    // `here` is a bare origin, and this app lives under a sub-path of it, so
    // both halves must carry the base: the origin so the network host builds
    // OUR accept route, the path so it lands back on OUR login page.
    const check = ssoCheckUrl(`${here}${BASE_PATH}`, withBase(loginPath));
    if (check) redirect(check);
  }

  return (
    <Suspense fallback={<div style={{ minHeight: 420 }} />}>
      <LoginForm />
    </Suspense>
  );
}
