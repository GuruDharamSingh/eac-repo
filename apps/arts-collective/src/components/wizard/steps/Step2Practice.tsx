"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_VALUES,
  EXPERIENCE_LABELS,
  EXPERIENCE_VALUES,
  step2Schema,
} from "@/lib/schema";
import { useWizard } from "../WizardProvider";
import { WizardNav } from "../WizardNav";
import { useWizardSaveAndExit } from "../use-wizard-save-exit";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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

type Values = z.infer<typeof step2Schema>;

export function Step2Practice() {
  const { answers, patch, next } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      disciplines: (answers.disciplines ?? []) as Values["disciplines"],
      disciplinesOther: answers.disciplinesOther ?? "",
      experienceLevel:
        (answers.experienceLevel as Values["experienceLevel"]) ??
        "starting_fresh",
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
        <CardTitle className="font-serif text-2xl">Your practice</CardTitle>
        <CardDescription>
          Pick what fits. Anything else you practice can go in the &quot;Other&quot;
          field below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="disciplines"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormLabel>Disciplines</FormLabel>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {DISCIPLINE_VALUES.map((v) => (
                      <FormField
                        key={v}
                        name="disciplines"
                        control={form.control}
                        render={({ field }) => {
                          const checked = field.value?.includes(v) ?? false;
                          return (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-border bg-card px-3 py-2">
                              <FormControl>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    const curr = field.value ?? [];
                                    field.onChange(
                                      c
                                        ? [...curr, v]
                                        : curr.filter((x: string) => x !== v)
                                    );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="cursor-pointer text-sm font-normal">
                                {DISCIPLINE_LABELS[v]}
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
              name="disciplinesOther"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Other (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Anything else you practice..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Free-form — use whatever language you want.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="experienceLevel"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Where are you in your path?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {EXPERIENCE_VALUES.map((v) => (
                        <Label
                          key={v}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 font-normal"
                        >
                          <RadioGroupItem value={v} />
                          <span>{EXPERIENCE_LABELS[v]}</span>
                        </Label>
                      ))}
                    </RadioGroup>
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
