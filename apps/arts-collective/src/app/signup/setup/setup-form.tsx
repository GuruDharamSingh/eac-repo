"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  subdomain: z
    .string()
    .min(3, "At least 3 characters")
    .max(40, "40 characters max")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Lowercase letters, numbers, and hyphens only"
    ),
});

type Values = z.infer<typeof schema>;

export function SetupForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { subdomain: "" },
  });

  const subdomainLive = form.watch("subdomain");

  const onSubmit = async (values: Values) => {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/org/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain: values.subdomain, title: values.subdomain }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? `Setup failed (${res.status})`);
      setSubmitting(false);
      return;
    }
    router.push("/hub");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl">
          Choose your subdomain
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              name="subdomain"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subdomain</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="your-name"
                      autoComplete="off"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Your site will live at{" "}
                    <code className="font-mono text-foreground">
                      {subdomainLive || "your-name"}.artscollective.org
                    </code>
                    . You can change this later from your account.
                  </FormDescription>
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
              {submitting ? "Setting up..." : "Continue to your hub"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
