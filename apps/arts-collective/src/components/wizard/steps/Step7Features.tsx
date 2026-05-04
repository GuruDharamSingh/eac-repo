"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FEATURE_LABELS, FEATURE_VALUES, step7Schema } from "@/lib/schema";
import { useWizard } from "../WizardProvider";
import { WizardNav } from "../WizardNav";
import { useWizardSaveAndExit } from "../use-wizard-save-exit";
import { Checkbox } from "@/components/ui/checkbox";
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

type Values = z.infer<typeof step7Schema>;

export function Step7Features() {
  const { answers, patch, next } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(step7Schema),
    defaultValues: {
      featuresRequested: (answers.featuresRequested ??
        []) as Values["featuresRequested"],
      featuresOther: answers.featuresOther ?? "",
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
        <CardTitle className="font-serif text-2xl">
          Features for your site
        </CardTitle>
        <CardDescription>
          Pick anything you&apos;d want from the start. Availability varies,
          but this shapes what the team sets up for you first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="featuresRequested"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormLabel>Features</FormLabel>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {FEATURE_VALUES.map((v) => (
                      <FormField
                        key={v}
                        name="featuresRequested"
                        control={form.control}
                        render={({ field }) => {
                          const arr =
                            (field.value ??
                              []) as (typeof FEATURE_VALUES)[number][];
                          const checked = arr.includes(v);
                          return (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-border bg-card px-3 py-2">
                              <FormControl>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) =>
                                    field.onChange(
                                      c
                                        ? [...arr, v]
                                        : arr.filter((x) => x !== v)
                                    )
                                  }
                                />
                              </FormControl>
                              <FormLabel className="cursor-pointer text-sm font-normal">
                                {FEATURE_LABELS[v]}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="featuresOther"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anything else? (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="A custom feature, integration, or specific workflow you need..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    No guarantees, but if it&apos;s a common-enough ask we may
                    prioritize it.
                  </FormDescription>
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
