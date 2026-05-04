"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FULFILLMENT_LABELS,
  FULFILLMENT_VALUES,
  bizStep3Schema,
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

type Values = z.infer<typeof bizStep3Schema>;

export function BizStep3Logistics() {
  const { answers, patch, next } = useBusinessWizard();
  const { saveAndExit, saving } = useBusinessWizardSaveAndExit();

  const form = useForm<Values>({
    resolver: zodResolver(bizStep3Schema),
    defaultValues: {
      tools: answers.tools ?? "",
      fulfillment: (answers.fulfillment as Values["fulfillment"]) ?? "self",
      inventoryManagement: answers.inventoryManagement ?? "",
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
        <CardTitle className="font-serif text-2xl">Logistics & Operations</CardTitle>
        <CardDescription>
          Managing the flow of your work to your audience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              name="tools"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Toolkit (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Etsy, Shopify, Square..." {...field} />
                  </FormControl>
                  <FormDescription>
                    What tools are you already using to manage your practice?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="fulfillment"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fulfillment</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 gap-2"
                    >
                      {FULFILLMENT_VALUES.map((v) => (
                        <Label
                          key={v}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 font-normal"
                        >
                          <RadioGroupItem value={v} />
                          <span>{FULFILLMENT_LABELS[v]}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="inventoryManagement"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory Tracking (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      rows={3} 
                      placeholder="How do you track available work?" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Briefly describe how you manage your stock.
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
