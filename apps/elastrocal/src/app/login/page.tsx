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
  // redirect() applies basePath itself; a bare path is correct here.
  if (await getViewer()) redirect(next ?? "/charts");

  return (
    <Suspense fallback={<div className="mx-auto max-w-md py-16" />}>
      <LoginForm />
    </Suspense>
  );
}
