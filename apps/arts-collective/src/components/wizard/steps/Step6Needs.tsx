"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { NEED_LABELS, NEED_VALUES, step6Schema } from "@/lib/schema";
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

type Values = z.infer<typeof step6Schema>;

export function Step6Needs() {
  const { answers, patch, next } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(step6Schema),
    defaultValues: {
      needs: (answers.needs ?? []) as Values["needs"],
      needsNote: answers.needsNote ?? "",
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
        <CardTitle className="font-serif text-2xl">Where we can help</CardTitle>
        <CardDescription>
          The collective is just probing for where it could be useful. None
          of these have to apply — you can leave everything blank.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="needs"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormLabel>Are you looking for...?</FormLabel>
                  <div className="space-y-2">
                    {NEED_VALUES.map((v) => (
                      <FormField
                        key={v}
                        name="needs"
                        control={form.control}
                        render={({ field }) => {
                          const arr =
                            (field.value ?? []) as (typeof NEED_VALUES)[number][];
                          const checked = arr.includes(v);
                          return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border bg-card px-3 py-2.5">
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
                              <FormLabel className="cursor-pointer text-sm font-normal leading-snug">
                                {NEED_LABELS[v]}
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
              name="needsNote"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anything specific? (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="A line or two about the gap, if you can name it."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Helps us prioritize what to build next.
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
