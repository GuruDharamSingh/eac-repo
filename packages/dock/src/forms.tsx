"use client";

/**
 * Custom module forms: the ESCAPE HATCH (2026-11-27). Every in-dock form is declared as data now
 * (packages/actions/src/fields.ts, forms-base.ts, forms-wave1.ts) and drawn by `DeclaredForm`
 * (./declared-form.tsx). Add a component here only for a case the declaration cannot draw (a map, a
 * canvas), and name it with `DOCK_FORM[<entry id>] = '<key>'` in packages/actions/src/catalogue.ts.
 * A custom key wins over the declaration for that entry.
 *
 * The seven hand-made forms that lived here (profile, store-front, listing, org-details, pen-name,
 * writing-start) are declarations now, with the same fields and behaviour; "Fill from my directory bio"
 * is the store-front field's `fillFrom`.
 */
import type * as React from "react";

export interface DockFormProps {
  values: Record<string, string>;
  label: string;
  busy: boolean;
  submit: (values: Record<string, string | boolean>) => void;
}

export const DOCK_FORMS: Record<string, React.ComponentType<DockFormProps>> = {};
