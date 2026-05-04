"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { step5Schema } from "@/lib/schema";
import { useWizard } from "../WizardProvider";
import { WizardNav } from "../WizardNav";
import { useWizardSaveAndExit } from "../use-wizard-save-exit";
import { KeywordInput } from "../KeywordInput";
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

type Values = z.infer<typeof step5Schema>;

// Kept filename for routing stability; represents the "Your view" step now.
export function Step5World() {
  const { answers, patch, next } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      personalPhilosophy: answers.personalPhilosophy ?? "",
      aestheticKeywords: (answers.aestheticKeywords ?? []) as string[],
      aestheticNotes: answers.aestheticNotes ?? "",
    },
  });

  const onSubmit = (values: Values) => {
    patch(values);
    next();
  };
  const onSaveAndExit = () => saveAndExit(form.getValues());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Your view</CardTitle>
        <CardDescription>
          A short pass at your personal philosophy and aesthetic bearings.
          Helps us relate your corner to others in the collective.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="personalPhilosophy"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal philosophy (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="What you believe your work is doing. What you're after. The stance you make from."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="aestheticKeywords"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aesthetic alignments</FormLabel>
                  <FormControl>
                    <KeywordInput
                      value={(field.value ?? []) as string[]}
                      onChange={field.onChange}
                      placeholder="e.g. solarpunk, brutalist, monochrome..."
                    />
                  </FormControl>
                  <FormDescription>
                    Keywords that describe the look, feel, or movement your
                    work draws from. Comma or Enter to add.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="aestheticNotes"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes on look and feel (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Free-form — references, mood, textures, anti-references."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <WizardNav onSaveAndExit={onSaveAndExit} saving={saving} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
