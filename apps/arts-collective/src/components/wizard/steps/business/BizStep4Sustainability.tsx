"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  RESOURCE_HELP_LABELS,
  RESOURCE_HELP_VALUES,
  bizStep4Schema,
} from "@/lib/business-schema";
import { useBusinessWizard } from "../../BusinessWizardProvider";
import { BusinessWizardNav } from "../../BusinessWizardNav";
import { useBusinessWizardSaveAndExit } from "../../use-business-wizard-save-exit";
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

type Values = z.infer<typeof bizStep4Schema>;

export function BizStep4Sustainability() {
  const { answers, patch, next } = useBusinessWizard();
  const { saveAndExit, saving } = useBusinessWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(bizStep4Schema),
    defaultValues: {
      desiredResources: (answers.desiredResources ?? []) as Values["desiredResources"],
      revenueSharing: answers.revenueSharing ?? "",
      skillShare: answers.skillShare ?? "",
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
        <CardTitle className="font-serif text-2xl">Collective Cohesion</CardTitle>
        <CardDescription>
          Aligning with the group through shared resources and skills.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="desiredResources"
              control={form.control}
              render={() => (
                <FormItem>
                  <FormLabel>Shared Resources</FormLabel>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {RESOURCE_HELP_VALUES.map((v) => (
                      <FormField
                        key={v}
                        name="desiredResources"
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
                                {RESOURCE_HELP_LABELS[v]}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormDescription>
                    Which collective assets would help you most?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="revenueSharing"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revenue Sharing Interest (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Open to 10% on portal sales" {...field} />
                  </FormControl>
                  <FormDescription>
                    Are you open to contributing back to the collective fund?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="skillShare"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skills Exchange (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3} 
                      placeholder="What 'business' skills can you offer the group?" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    e.g. Spreadsheets, legal contracts, social media management.
                  </FormDescription>
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
