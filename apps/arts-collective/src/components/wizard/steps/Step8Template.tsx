"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  TEMPLATE_LABELS,
  TEMPLATE_VALUES,
  step8Schema,
  wizardSchema,
} from "@/lib/schema";
import { useWizard } from "../WizardProvider";
import { WizardNav } from "../WizardNav";
import { useWizardSaveAndExit } from "../use-wizard-save-exit";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Values = z.infer<typeof step8Schema>;

export function Step8Template() {
  const router = useRouter();
  const { answers, patch, reset } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(step8Schema),
    defaultValues: {
      templatePreference:
        (answers.templatePreference as Values["templatePreference"]) ??
        "article",
      palettePreference: answers.palettePreference ?? "",
    },
  });

  const onSubmit = async (values: Values) => {
    patch(values);
    setError(null);

    const full = { ...answers, ...values };
    const parsed = wizardSchema.safeParse(full);
    if (!parsed.success) {
      setError(
        "Some earlier steps are incomplete. Use Back to review and fill the required fields."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wizard/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? `Submission failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      reset();
      router.push("/hub");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setSubmitting(false);
    }
  };

  const onSaveAndExit = () => saveAndExit(form.getValues());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">
          Templates & aesthetics
        </CardTitle>
        <CardDescription>
          This is a preliminary pick — it shapes the first pass of your page.
          The dedicated Web Design step (coming soon) is where real layout and
          styling happens. Nothing is locked in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="templatePreference"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Archetype</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      {TEMPLATE_VALUES.map((v) => {
                        const selected = field.value === v;
                        return (
                          <label
                            key={v}
                            className={cn(
                              "cursor-pointer rounded-lg border p-4 transition",
                              selected
                                ? "border-primary bg-accent"
                                : "border-border bg-card hover:bg-secondary/60"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={v} />
                              <span className="font-serif text-lg">
                                {TEMPLATE_LABELS[v].title}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {TEMPLATE_LABELS[v].blurb}
                            </p>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="palettePreference"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Palette / vibe (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. warm earthy, high-contrast b&w, sun-faded pastels"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Free-form — the team uses this as a starting brief.
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

            <WizardNav
              submitting={submitting}
              continueLabel="Complete"
              onSaveAndExit={onSaveAndExit}
              saving={saving}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
