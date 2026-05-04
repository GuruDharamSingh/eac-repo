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

export interface CssVarDef {
  name: string;
  label: string;
  type: "color" | "text" | "rgb";
  default: string;
  hint?: string;
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
