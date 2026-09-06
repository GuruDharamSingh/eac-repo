"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSection } from "@/lib/manage/actions";

interface Field {
  name: string;
  label: string;
  multiline?: boolean;
}

/** One org_site_sections row, edited field by field. */
export function SectionEditor({
  sectionKey,
  title,
  fields,
  content,
}: {
  sectionKey: string;
  title: string;
  fields: Field[];
  content: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, content[f.name] ?? ""]))
  );
  const [pending, startTransition] = useTransition();

  const dirty = fields.some((f) => values[f.name] !== (content[f.name] ?? ""));

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>

      <div className="mt-4 space-y-4">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={`${sectionKey}-${f.name}`}>{f.label}</Label>
            {f.multiline ? (
              <Textarea
                id={`${sectionKey}-${f.name}`}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                rows={4}
              />
            ) : (
              <Input
                id={`${sectionKey}-${f.name}`}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <Button
        className="mt-4"
        size="sm"
        disabled={pending || !dirty}
        onClick={() =>
          startTransition(async () => {
            const res = await saveSection(sectionKey, values);
            if (res.ok) toast.success(`${title} saved.`);
            else toast.error(res.error ?? "Couldn't save that.");
          })
        }
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </section>
  );
}
