"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  bizStep5Schema,
  businessWizardSchema,
} from "@/lib/business-schema";
import { useBusinessWizard } from "../../BusinessWizardProvider";
import { BusinessWizardNav } from "../../BusinessWizardNav";
import { useBusinessWizardSaveAndExit } from "../../use-business-wizard-save-exit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type Values = z.infer<typeof bizStep5Schema>;

export function BizStep5Resources() {
  const router = useRouter();
  const { answers, patch, reset } = useBusinessWizard();
  const { saveAndExit, saving } = useBusinessWizardSaveAndExit();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(bizStep5Schema),
    defaultValues: {
      mainBarrier: answers.mainBarrier ?? "",
      revenueGoal: answers.revenueGoal ?? "",
    },
  });

  const onSubmit = async (values: Values) => {
    patch(values);
    setError(null);

    const full = { ...answers, ...values };
    const parsed = businessWizardSchema.safeParse(full);
    if (!parsed.success) {
      setError(
        "Some earlier steps are incomplete. Use Back to review and fill the required fields."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wizard/business/submit", {
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
        <CardTitle className="font-serif text-2xl">Growth & Sustainability</CardTitle>
        <CardDescription>
          Defining the path forward for your practice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="mainBarrier"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>The Main Barrier (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3} 
                      placeholder="What's the #1 thing preventing your work from being financially sustainable?" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Honest assessment helps the collective know where to build infrastructure.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="revenueGoal"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revenue Goals (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. $1,000 / month" {...field} />
                  </FormControl>
                  <FormDescription>
                    What is your target &quot;minimum viable&quot; monthly income from your art?
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

            <BusinessWizardNav 
              submitting={submitting} 
              continueLabel="Complete Workbook" 
              onSaveAndExit={onSaveAndExit} 
              saving={saving} 
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
