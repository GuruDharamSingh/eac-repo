"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_VALUES,
  LEGAL_STATUS_LABELS,
  LEGAL_STATUS_VALUES,
  bizStep1Schema,
} from "@/lib/business-schema";
import { useBusinessWizard } from "../../BusinessWizardProvider";
import { BusinessWizardNav } from "../../BusinessWizardNav";
import { useBusinessWizardSaveAndExit } from "../../use-business-wizard-save-exit";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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

type Values = z.infer<typeof bizStep1Schema>;

export function BizStep1Economic() {
  const { answers, patch, next } = useBusinessWizard();
  const { saveAndExit, saving } = useBusinessWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(bizStep1Schema),
    defaultValues: {
      entityType: (answers.entityType as Values["entityType"]) ?? "individual",
      entityName: answers.entityName ?? "",
      mission: answers.mission ?? "",
      legalStatus: (answers.legalStatus as Values["legalStatus"]) ?? "just_starting",
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
        <CardTitle className="font-serif text-2xl">The Creative Entity</CardTitle>
        <CardDescription>
          Defining how you show up as a business or individual creator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="entityType"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                    >
                      {ENTITY_TYPE_VALUES.map((v) => (
                        <Label
                          key={v}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 font-normal"
                        >
                          <RadioGroupItem value={v} />
                          <span>{ENTITY_TYPE_LABELS[v]}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="entityName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity / Business Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Blue Heron Studios" {...field} />
                  </FormControl>
                  <FormDescription>
                    If different from your personal name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="mission"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mission & Principles (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3} 
                      placeholder="The 'why' behind your practice..." 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Helps align your goals with the Collective’s principles.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="legalStatus"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Legal Status</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {LEGAL_STATUS_VALUES.map((v) => (
                        <Label
                          key={v}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 font-normal"
                        >
                          <RadioGroupItem value={v} />
                          <span>{LEGAL_STATUS_LABELS[v]}</span>
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
