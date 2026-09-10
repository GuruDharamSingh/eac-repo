import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const viewer = await getViewer();
  // Already signed in — nothing to do here. Honour ?next so the /manage gate's
  // round trip lands where it meant to.
  if (viewer) redirect(next ?? "/");

  return (
    <Suspense fallback={<div className="mx-auto max-w-md py-16" />}>
      <LoginForm />
    </Suspense>
  );
}
