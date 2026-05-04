"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GOALS_OPTION_LABELS,
  GOALS_OPTION_VALUES,
  step4Schema,
} from "@/lib/schema";
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

type Values = z.infer<typeof step4Schema>;

export function Step4Goals() {
  const { answers, patch, next } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      goalsOptions: (answers.goalsOptions ?? []) as Values["goalsOptions"],
      goalsNote: answers.goalsNote ?? "",
      mutualAidMedia: Boolean(answers.mutualAidMedia),
      mutualAidAuthoring: Boolean(answers.mutualAidAuthoring),
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
          Your goals with the collective
        </CardTitle>
        <CardDescription>
          Pick any that resonate. This is preliminary — none of it fully
          obligates you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="goalsOptions"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormLabel>What are you here for?</FormLabel>
                  <div className="space-y-2">
                    {GOALS_OPTION_VALUES.map((v) => (
                      <FormField
                        key={v}
                        name="goalsOptions"
                        control={form.control}
                        render={({ field }) => {
                          const arr =
                            (field.value ?? []) as (typeof GOALS_OPTION_VALUES)[number][];
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
                                {GOALS_OPTION_LABELS[v]}
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

            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
              <div>
                <h3 className="font-serif text-base">Mutual aid (optional)</h3>
                <p className="text-xs text-muted-foreground">
                  Preliminary interest. Deeper partnerships with Elkdonis are
                  opt-in and walked through in a separate legal/contracts
                  step. Common-sense defaults apply until then.
                </p>
              </div>
              <FormField
                name="mutualAidMedia"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer text-sm font-normal leading-snug">
                      I&apos;m open to giving other collective artists access
                      to my media / fanbase.
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                name="mutualAidAuthoring"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer text-sm font-normal leading-snug">
                      I&apos;m interested in authoring content under the
                      Elkdonis Arts Collective name.
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name="goalsNote"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Anything specific you want to say here? (optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Assets, skills, specific asks..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A short, honest note — whatever you&apos;d want the team
                    to know.
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
