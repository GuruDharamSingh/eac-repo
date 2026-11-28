// The registry of declared action forms (2026-11-27, lane E). Client-safe.
// To add forms: export an array from a forms-*.ts file and add one import and one spread below.
import { declareForms, type ActionForm } from './fields';
import { FORMS_BASE } from './forms-base';
import { FORMS_WAVE1 } from './forms-wave1';

/** Entry id -> its form declaration. */
export const ACTION_FORMS: Readonly<Record<string, ActionForm>> = declareForms(
  FORMS_BASE,
  FORMS_WAVE1,
);

/** The declared form for an entry, or null. */
export function actionForm(entry: string): ActionForm | null {
  return ACTION_FORMS[entry] ?? null;
}
