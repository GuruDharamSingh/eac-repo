"use client";

import { LiveEditor } from "@elkdonis/live-editor";
import type { FieldDef, CssVarDef, SaveFieldPayload, SaveResult } from "@elkdonis/live-editor";
import { updateWorkshopFieldByTraitAction, updateWorkshopThemeAction } from "@/lib/cms/actions";

interface Props {
  threadId: string;
  hubUrl: string;
  fields: FieldDef[];
  cssVars: CssVarDef[];
  cssOverrides: Record<string, string>;
}

/**
 * Glue component: binds the generic LiveEditor to workshop-specific server
 * actions. All DB knowledge stays in actions.ts — this component only wires
 * callbacks.
 *
 * The fields + cssVars props are built server-side via workshopFieldDefs() and
 * workshopCssVarDefs() from @elkdonis/cms-bindings, then serialised as props.
 */
export function WorkshopLiveEditor({ threadId, hubUrl, fields, cssVars, cssOverrides }: Props) {
  async function onSaveField(payload: SaveFieldPayload): Promise<SaveResult> {
    const result = await updateWorkshopFieldByTraitAction(threadId, payload);
    return { ok: result.ok, error: "error" in result ? result.error : undefined };
  }

  async function onSaveCss(overrides: Record<string, string>): Promise<SaveResult> {
    const result = await updateWorkshopThemeAction(threadId, overrides);
    return { ok: result.ok, error: "error" in result ? result.error : undefined };
  }

  return (
    <LiveEditor
      fields={fields}
      cssVars={cssVars}
      cssOverrides={cssOverrides}
      onSaveField={onSaveField}
      onSaveCss={onSaveCss}
      fullEditorUrl={hubUrl}
      role="Owner"
    />
  );
}
