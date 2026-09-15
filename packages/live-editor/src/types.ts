export type FieldInputType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "datetime"
  | "date"
  | "select"
  | "image"
  | "compound"
  | "readonly";

export interface SelectOption {
  value: string;
  label: string;
}

export interface CompoundFieldDef {
  /** Opaque key passed back to the app in SaveFieldPayload.value — use the DB column name */
  key: string;
  label: string;
  input: "text" | "number" | "url";
  initialValue?: string;
}

export interface FieldDef {
  /** Matches the data-trait="..." attribute in the rendered template HTML */
  trait: string;
  label: string;
  input: FieldInputType;
  hint?: string;
  /** Current value as string, pre-populated from server data */
  initialValue?: string;
  options?: SelectOption[];
  /** Only for input === "compound" */
  compound?: CompoundFieldDef[];
}

/**
 * How a CSS custom property is edited.
 *
 *   color   — a colour picker plus hex field
 *   text    — a free text field (any CSS value; sanitised server-side)
 *   rgb     — legacy: a "r g b" triple as text
 *   length  — a slider plus number, with `unit` appended ("2px"); needs
 *             min/max/step
 *   select  — one of `options`
 */
export type CssVarType = "color" | "text" | "rgb" | "length" | "select";

export interface CssVarDef {
  name: string;
  label: string;
  type: CssVarType;
  default: string;
  hint?: string;
  /** Groups rows under a heading in the full panel ("Frames", "Text"…). */
  group?: string;
  /** type === "length" */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** type === "select" */
  options?: SelectOption[];
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export interface SaveFieldPayload {
  trait: string;
  /**
   * Simple field: string value.
   * Compound field: Record<CompoundFieldDef.key, value>.
   */
  value: string | Record<string, string>;
}
