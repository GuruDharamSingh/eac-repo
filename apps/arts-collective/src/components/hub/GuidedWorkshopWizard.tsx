"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TemplateWizard, type TemplateWizardStep, type WizardFieldSpec } from "@elkdonis/cms-ui";
import {
  wizardAnswersToColumns,
  type WizardUiStep,
  type WizardUiField,
} from "@elkdonis/cms-bindings";
import { saveWorkshopAction } from "@/lib/cms/actions";

import { CoverImageUpload } from "@/components/hub/CoverImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The save action's result, restated at the client boundary.
 *
 * `actions.ts` is a `"use server"` module, and its exported `SaveWorkshopResult`
 * union does not survive the import into a client component with its
 * discriminant intact — narrowing on `ok` stops working. Declaring the contract
 * here keeps the branch types usable; it must stay in step with
 * `SaveWorkshopResult` in `@/lib/cms/actions`.
 */
type SaveResult =
  | { ok: true; thread_id: string; slug: string; attendeeChangeWarning?: string[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ============================================================================
// The guided (default) workshop authoring surface.
//
// Steps are derived from the template manifest on the server and handed down —
// this component only supplies the controls the generic wizard can't render on
// its own: the `custom` slots (image / media / gallery / compound).
//
// Why this and not a hand-written form: WorkshopForm is ~880 lines whose field
// list drifted away from both the field registry and the save schema (see
// scripts/check-workshop-fields.mjs). Here the field list *is* the registry, so
// adding a field to the registry adds it here with no component change.
// ============================================================================

type Props = {
  orgSlug: string;
  steps: WizardUiStep[];
  threadId?: string;
  initialAnswers?: Record<string, unknown>;
  serverUpdatedAt?: string | null;
};

type GalleryItem = { url: string; alt?: string; caption?: string };

function asGallery(value: unknown): GalleryItem[] {
  return Array.isArray(value) ? (value as GalleryItem[]) : [];
}

export function GuidedWorkshopWizard({
  orgSlug,
  steps,
  threadId,
  initialAnswers,
  serverUpdatedAt,
}: Props) {
  const router = useRouter();
  const savedThreadId = React.useRef<string | undefined>(threadId);

  /** Turn one registry field into a control, supplying renderers for `custom`. */
  const toFieldSpec = React.useCallback(
    (field: WizardUiField): WizardFieldSpec => {
      const base: WizardFieldSpec = {
        name: field.name,
        label: field.label,
        input: field.input === "custom" ? "custom" : field.input,
        hint: field.hint,
        required: field.required,
        options: field.options,
      };

      if (field.input !== "custom") return base;

      switch (field.slot) {
        case "image":
        case "media":
          return {
            ...base,
            render: ({ value, onChange }) => (
              <CoverImageUpload
                orgSlug={orgSlug}
                kind={field.slot === "media" ? "video" : "image"}
                value={typeof value === "string" ? value : undefined}
                onChange={(url) => onChange(url ?? null)}
              />
            ),
          };

        case "gallery":
          return {
            ...base,
            render: ({ value, onChange }) => {
              const items = asGallery(value);
              const set = (next: GalleryItem[]) => onChange(next);
              return (
                <div className="space-y-3">
                  {items.map((item, i) => (
                    <div
                      key={`${item.url}-${i}`}
                      className="flex items-start gap-3 rounded-md border border-border p-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          placeholder="Alt text (describes the image)"
                          value={item.alt ?? ""}
                          onChange={(e) =>
                            set(items.map((it, j) => (j === i ? { ...it, alt: e.target.value } : it)))
                          }
                        />
                        <Input
                          placeholder="Caption (optional)"
                          value={item.caption ?? ""}
                          onChange={(e) =>
                            set(
                              items.map((it, j) =>
                                j === i ? { ...it, caption: e.target.value } : it
                              )
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => set(items.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <CoverImageUpload
                    orgSlug={orgSlug}
                    kind="image"
                    onChange={(url) => url && set([...items, { url }])}
                  />
                </div>
              );
            },
          };

        case "compound":
          // A compound field writes several columns at once (eyebrow =
          // discipline + series label; price = amount + currency). Render its
          // constituents and keep them as a nested object; the answers→columns
          // fold flattens it on save.
          return {
            ...base,
            render: ({ value, onChange }) => {
              const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(field.compound ?? []).map((sub) => (
                    <div key={sub.name} className="space-y-1.5">
                      <label
                        htmlFor={`cf-${sub.name}`}
                        className="text-xs text-muted-foreground"
                      >
                        {sub.label}
                      </label>
                      <Input
                        id={`cf-${sub.name}`}
                        type={sub.input === "number" ? "number" : sub.input === "url" ? "url" : "text"}
                        value={obj[sub.name] == null ? "" : String(obj[sub.name])}
                        onChange={(e) =>
                          onChange({
                            ...obj,
                            [sub.name]:
                              sub.input === "number"
                                ? e.target.value === ""
                                  ? null
                                  : Number(e.target.value)
                                : e.target.value,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              );
            },
          };

        default:
          return base;
      }
    },
    [orgSlug]
  );

  const wizardSteps: TemplateWizardStep[] = React.useMemo(
    () =>
      steps.map((step) => ({
        id: step.id,
        label: step.label,
        description: step.description,
        optional: step.optional,
        fields: step.fields.map(toFieldSpec),
        // Platform steps with no registry fields are bespoke; until their
        // components are ported they explain themselves rather than render blank.
        render:
          step.fields.length === 0
            ? () => (
                <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  {step.description ??
                    "This step is set up after the workshop is created."}
                </p>
              )
            : undefined,
      })),
    [steps, toFieldSpec]
  );

  /** Fold trait-keyed answers into the column shape saveWorkshopAction expects. */
  const persist = React.useCallback(
    async (answers: Record<string, unknown>) => {
      const columns = wizardAnswersToColumns(steps, answers);
      const result = (await saveWorkshopAction({
        ...columns,
        orgSlug,
        thread_id: savedThreadId.current,
        // A wizard draft is a draft until the last step says otherwise.
        status: (columns.status as "draft" | "published") ?? "draft",
      } as Parameters<typeof saveWorkshopAction>[0])) as SaveResult;

      // `=== false` rather than `!result.ok`: the repo compiles with
      // `strict: false`, and without strictNullChecks only an explicit literal
      // comparison narrows a discriminated union. Same pattern as WorkshopForm.
      if (result.ok === false) {
        // Field errors are more useful than the generic message when the wizard
        // let something through that the schema rejects.
        const detail = result.fieldErrors
          ? Object.entries(result.fieldErrors)
              .map(([k, v]) => `${k}: ${v.join(", ")}`)
              .join(" · ")
          : "";
        throw new Error(detail ? `${result.error} — ${detail}` : result.error);
      }
      savedThreadId.current = result.thread_id;
      return result;
    },
    [steps, orgSlug]
  );

  return (
    <TemplateWizard
      storageKey={`workshop:${orgSlug}:${threadId ?? "new"}`}
      steps={wizardSteps}
      initialAnswers={initialAnswers}
      serverUpdatedAt={serverUpdatedAt}
      finishLabel="Publish workshop"
      onSave={async (answers) => {
        await persist(answers as Record<string, unknown>);
      }}
      onExit={() => router.push(`/hub/workshops/${orgSlug}`)}
      onFinish={async (answers) => {
        try {
          const result = await persist({
            ...(answers as Record<string, unknown>),
            status: "published",
          });
          toast.success("Workshop published");
          router.push(`/hub/workshops/${orgSlug}/${result.thread_id}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not publish");
        }
      }}
    />
  );
}
