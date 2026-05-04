"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithPassword, signUp } from "@elkdonis/auth-client";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "signup" || m === "signin") setMode(m);
  }, [searchParams]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: Values) => {
    setError(null);
    setSubmitting(true);
    const fn = mode === "signin" ? signInWithPassword : signUp;
    const { user, error: err } = await fn(values.email, values.password);

    if (err) {
      setSubmitting(false);
      setError(err);
      return;
    }
    if (!user) {
      setSubmitting(false);
      return;
    }

    const orgSlug = searchParams.get("org");
    if (orgSlug) {
      try {
        await fetch("/api/org/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: orgSlug }),
        });
      } catch {
        // non-fatal — user can still proceed
      }
      const host = window.location.host;
      const rootHost = host.replace(/^[^.]+\./, "");
      const subdomainHost = host.startsWith(`${orgSlug}.`)
        ? host
        : `${orgSlug}.${rootHost === host ? host : rootHost}`;
      window.location.href = `${window.location.protocol}//${subdomainHost}/`;
      return;
    }

    if (mode === "signup") {
      router.push("/signup/setup");
    } else {
      router.push("/hub");
    }
    router.refresh();
  };

  const orgSlug = searchParams.get("org");

  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription className="space-y-1.5">
            <span className="block">
              {orgSlug
                ? mode === "signin"
                  ? `Sign in to join ${orgSlug}.`
                  : `Create an account and join ${orgSlug}.`
                : mode === "signin"
                  ? "Sign in to continue your onboarding."
                  : "We'll set up your corner of the collective next."}
            </span>
            {mode === "signup" && (
              <span className="block text-xs text-muted-foreground">
                {orgSlug
                  ? `Your account is part of the Elkdonis Arts Collective network — one sign-in works across all spaces. You're joining ${orgSlug} now; you can connect with other groups later.`
                  : "One account across the whole network. Artists, facilitators, and members share a single sign-in — your role in each space is set separately."}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete={
                          mode === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting
                  ? "Working..."
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "signin"
                  ? "New here?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setError(null);
                    setMode(mode === "signin" ? "signup" : "signin");
                  }}
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
