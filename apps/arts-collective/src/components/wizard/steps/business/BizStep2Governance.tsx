"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  REVENUE_STREAM_LABELS,
  REVENUE_STREAM_VALUES,
  PRICING_LABELS,
  PRICING_VALUES,
  bizStep2Schema,
} from "@/lib/business-schema";
import { useBusinessWizard } from "../../BusinessWizardProvider";
import { BusinessWizardNav } from "../../BusinessWizardNav";
import { useBusinessWizardSaveAndExit } from "../../use-business-wizard-save-exit";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Values = z.infer<typeof bizStep2Schema>;

export function BizStep2Governance() {
  const { answers, patch, next } = useBusinessWizard();
  const { saveAndExit, saving } = useBusinessWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(bizStep2Schema),
    defaultValues: {
      primaryRevenue: (answers.primaryRevenue ?? []) as Values["primaryRevenue"],
      capacity: answers.capacity ?? "",
      pricingPhilosophy: (answers.pricingPhilosophy as Values["pricingPhilosophy"]) ?? "materials_plus_labor",
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
        <CardTitle className="font-serif text-2xl">Offerings & Value</CardTitle>
        <CardDescription>
          What you create and how you value your work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="primaryRevenue"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormLabel>Primary Revenue Streams</FormLabel>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {REVENUE_STREAM_VALUES.map((v) => (
                      <FormField
                        key={v}
                        name="primaryRevenue"
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
                                {REVENUE_STREAM_LABELS[v]}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormDescription>
                    Select any that apply to your current practice.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="capacity"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Production Capacity (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 4 original pieces / month" {...field} />
                  </FormControl>
                  <FormDescription>
                    How much &quot;output&quot; can you realistically maintain?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="pricingPhilosophy"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing Philosophy</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 gap-2"
                    >
                      {PRICING_VALUES.map((v) => (
                        <Label
                          key={v}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 font-normal"
                        >
                          <RadioGroupItem value={v} />
                          <span>{PRICING_LABELS[v]}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <BusinessWizardNav onSaveAndExit={onSaveAndExit} saving={saving} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
