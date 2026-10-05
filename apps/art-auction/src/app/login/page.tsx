import { redirect } from "next/navigation";
import { currentOrigin, getServerSession, ssoCheckUrl } from "@elkdonis/auth-server";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ next?: string; returnTo?: string; mode?: string; sso?: string; error?: string }>;
}

/** Same-origin relative paths only, so ?next cannot become an open redirect. */
function safePath(raw: string | undefined): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safePath(params.next ?? params.returnTo);

  const session = await getServerSession();
  if (session.user) redirect(next ?? "/");

  // One silent trip through the network host before showing the form: a
  // member signed in on IFAC or another site of the collective comes back
  // here already signed in. `sso` marks that the trip was made, and `error`
  // that a handoff was refused (handleHandoffAccept), so it never loops.
  // Same pattern as apps/ifac/src/app/login/page.tsx.
  if (!params.sso && !params.error) {
    const here = await currentOrigin();
    const q = new URLSearchParams({
      ...(next ? { next } : {}),
      ...(params.mode ? { mode: params.mode } : {}),
      sso: "1",
    });
    const check = ssoCheckUrl(here, `/login?${q.toString()}`);
    if (check) redirect(check);
  }

  return <LoginForm />;
}
