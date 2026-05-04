"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { step1Schema } from "@/lib/schema";
import { useWizard } from "../WizardProvider";
import { WizardNav } from "../WizardNav";
import { useWizardSaveAndExit } from "../use-wizard-save-exit";
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

type Values = z.infer<typeof step1Schema>;

export function Step1Identity() {
  const { answers, patch, next } = useWizard();
  const { saveAndExit, saving } = useWizardSaveAndExit();
  const form = useForm<Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      displayName: answers.displayName ?? "",
      pronouns: answers.pronouns ?? "",
      city: answers.city ?? "",
      bio: answers.bio ?? "",
      photoUrl: answers.photoUrl ?? "",
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
        <CardTitle className="font-serif text-2xl">Who are you?</CardTitle>
        <CardDescription>
          These answers seed your public page. You can refine anything later
          from your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              name="displayName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Mira Delacroix" {...field} />
                  </FormControl>
                  <FormDescription>
                    How the collective will refer to you.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="pronouns"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pronouns (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. she/her, they/them" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="city"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City / region</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Toronto, ON" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="bio"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short bio</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormDescription>
                    A few sentences the collective can use to introduce you.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="photoUrl"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Portrait URL (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Media upload (via Nextcloud) is coming soon — for now,
                    paste a link if you have one.
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
