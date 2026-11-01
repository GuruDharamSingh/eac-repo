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
import { networkHostLabel } from "@/lib/org-url";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const schema = z.object({
  title: z.string().trim().min(2, "At least 2 characters").max(120, "120 characters max"),
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

export type SetupTier = "free" | "supported" | "partner";

/**
 * Creates the org. `tier` is what the person is asking for; the org starts
 * unconfirmed on every tier and an admin confirms it after the intake
 * conversation, so a supported/partner request is a real org from the first
 * minute — not a dead-end link.
 *
 * Asks for a name and an address (2026-10-30). Until then the one field was
 * the subdomain and the org was named after it, so every new org was called
 * "my-group". The address follows the name until the person edits it, the
 * same rule as the Center's "Create a collective" journey.
 */
export function SetupForm({ tier = "free" }: { tier?: SetupTier }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", subdomain: "" },
  });
  const [addressTouched, setAddressTouched] = useState(false);

  const subdomainLive = form.watch("subdomain");
  const host = networkHostLabel();

  const onSubmit = async (values: Values) => {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/org/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain: values.subdomain, title: values.title.trim(), tier }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? `Setup failed (${res.status})`);
      setSubmitting(false);
      return;
    }
    const slug = typeof data?.slug === "string" ? data.slug : values.subdomain;
    router.push(`/hub/organization?org=${encodeURIComponent(slug)}`);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl">
          Name it and choose its address
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              name="title"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="The name of your group or practice"
                      autoComplete="organization"
                      autoFocus
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!addressTouched) {
                          form.setValue("subdomain", slugify(e.target.value), { shouldValidate: false });
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>Shown on your site and in the network directory. You can change it later.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="subdomain"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="your-name"
                      autoComplete="off"
                      {...field}
                      onChange={(e) => {
                        setAddressTouched(true);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Your site will live at{" "}
                    <code className="font-mono text-foreground">
                      {subdomainLive || "your-name"}.{host}
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
              {submitting
                ? "Setting up..."
                : tier === "free"
                ? "Continue to your hub"
                : "Set it up and start the conversation"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
