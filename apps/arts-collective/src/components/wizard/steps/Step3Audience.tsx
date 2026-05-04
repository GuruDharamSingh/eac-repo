"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AUDIENCE_TYPE_LABELS,
  AUDIENCE_TYPE_VALUES,
  CLIENT_BASE_LABELS,
  CLIENT_BASE_VALUES,
  step3Schema,
} from "@/lib/schema";
import { useWizard } from "../WizardProvider";
import { WizardNav } from "../WizardNav";
import { useWizardSaveAndExit } from "../use-wizard-save-exit";
import { Checkbox } from "@/components/ui/checkbox";
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

type Values = z.infer<typeof step3Schema>;

export function Step3Audience() {
  const { answers, patch, next } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      portfolioUrl: answers.portfolioUrl ?? "",
      audienceTypes: (answers.audienceTypes ?? []) as Values["audienceTypes"],
      clientBase: (answers.clientBase ?? []) as Values["clientBase"],
      audienceDescription: answers.audienceDescription ?? "",
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
        <CardTitle className="font-serif text-2xl">Your audience</CardTitle>
        <CardDescription>
          Help us understand who you&apos;re making work for. All fields
          optional — add what feels relevant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="portfolioUrl"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Show us some of your work (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://... (DeviantArt, personal site, article, etc.)"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A link to an existing portfolio, Substack, social, or
                    article — any face of your practice online.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <MultiCheckField
              form={form}
              name="audienceTypes"
              label="Audience types"
              options={AUDIENCE_TYPE_VALUES.map((v) => ({
                value: v,
                label: AUDIENCE_TYPE_LABELS[v],
              }))}
              help="Pick any that apply. Helps us shape features suited to you."
            />

            <MultiCheckField
              form={form}
              name="clientBase"
              label="Client base"
              options={CLIENT_BASE_VALUES.map((v) => ({
                value: v,
                label: CLIENT_BASE_LABELS[v],
              }))}
              help="Who are the people your work is for?"
            />

            <FormField
              name="audienceDescription"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anything else about them? (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="A sentence or two about experience working with them so far, if any."
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

// Multi-check rendered as bordered option cards.
// Typed loosely — only used within this file for a few step-local fields.
/* eslint-disable @typescript-eslint/no-explicit-any */
function MultiCheckField({
  form,
  name,
  label,
  options,
  help,
}: {
  form: any;
  name: string;
  label: string;
  options: { value: string; label: string }[];
  help?: string;
}) {
  return (
    <FormField
      name={name}
      control={form.control}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((opt) => (
              <FormField
                key={opt.value}
                name={name}
                control={form.control}
                render={({ field }) => {
                  const arr = (field.value ?? []) as string[];
                  const checked = arr.includes(opt.value);
                  return (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-border bg-card px-3 py-2">
                      <FormControl>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            field.onChange(
                              c
                                ? [...arr, opt.value]
                                : arr.filter((x) => x !== opt.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer text-sm font-normal">
                        {opt.label}
                      </FormLabel>
                    </FormItem>
                  );
                }}
              />
            ))}
          </div>
          {help && <FormDescription>{help}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
