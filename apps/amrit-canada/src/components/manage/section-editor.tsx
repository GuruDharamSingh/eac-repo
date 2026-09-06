"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { saveSectionAction } from "@/lib/cms/actions";

interface SectionField {
  name: string;
  label: string;
  multiline?: boolean;
}

export function SectionEditor({
  sectionKey,
  title,
  hint,
  fields,
  values,
}: {
  sectionKey: string;
  title: string;
  hint: string;
  fields: SectionField[];
  values: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, values[f.name] ?? ""]))
  );

  function save() {
    startTransition(async () => {
      // Drop empty fields so a cleared value falls back to the code default
      // rather than rendering an empty heading.
      const content = Object.fromEntries(
        Object.entries(state).filter(([, v]) => v.trim() !== "")
      );
      const res = await saveSectionAction(sectionKey, content);
      if (res.ok) {
        toast.success("Saved.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="font-serif text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>

        {fields.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={`${sectionKey}-${field.name}`}>{field.label}</Label>
            {field.multiline ? (
              <Textarea
                id={`${sectionKey}-${field.name}`}
                value={state[field.name]}
                onChange={(e) => setState((s) => ({ ...s, [field.name]: e.target.value }))}
                rows={3}
              />
            ) : (
              <Input
                id={`${sectionKey}-${field.name}`}
                value={state[field.name]}
                onChange={(e) => setState((s) => ({ ...s, [field.name]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <Button onClick={save} disabled={pending} size="sm">
          {pending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
