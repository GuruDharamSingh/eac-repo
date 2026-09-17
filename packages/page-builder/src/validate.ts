// ============================================================================
// Is this row actually a page?
//
// Everything between a jsonb column and React was one `as Data` cast — a
// promise the type system cannot keep, because the value came from Postgres.
// What it cost: the published renderer's first statement dereferences
// `data.root`, so a row that was null, an array, or simply missing `root`
// returned HTTP 500 on a public URL. Verified, four shapes, four 500s.
//
// The guard is deliberately SHALLOW and deliberately NON-THROWING. It answers
// "will the renderer survive this?" and nothing more — it is not a schema, and
// it must never be the reason a page fails to draw.
// ============================================================================

export interface PageProblem {
  path: string;
  message: string;
}

export interface ValidationResult {
  /** False means: do not hand this to the renderer. */
  ok: boolean;
  /** Fatal — the renderer would throw or draw nothing. */
  errors: PageProblem[];
  /** Renders, but something is wrong and would otherwise be silent. */
  warnings: PageProblem[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Walk a page's nodes, including the ones nested inside slots.
 *
 * Slots are stored inline in a parent's props as arrays of nodes, so any
 * array-valued prop whose entries look like nodes is descended into. That is
 * looser than consulting the catalogue, on purpose: this has to work for a
 * block whose type is no longer in the catalogue at all, which is exactly the
 * case worth reporting.
 */
function walkNodes(
  content: unknown,
  path: string,
  visit: (node: Record<string, unknown>, path: string) => void
): void {
  if (!Array.isArray(content)) return;
  content.forEach((node, i) => {
    if (!isObject(node)) return;
    const here = `${path}[${i}]`;
    visit(node, here);
    const props = node.props;
    if (!isObject(props)) return;
    for (const [key, value] of Object.entries(props)) {
      if (Array.isArray(value) && value.some((v) => isObject(v) && "type" in v)) {
        walkNodes(value, `${here}.${key}`, visit);
      }
    }
  });
}

export function validatePage(data: unknown, knownTypes?: Set<string>): ValidationResult {
  const errors: PageProblem[] = [];
  const warnings: PageProblem[] = [];

  if (!isObject(data)) {
    return { ok: false, errors: [{ path: "", message: "Not a JSON object." }], warnings };
  }
  // The one that actually caused the 500s.
  if (!isObject(data.root)) {
    errors.push({ path: "root", message: "Missing or not an object. The renderer dereferences it." });
  }
  if (!Array.isArray(data.content)) {
    errors.push({ path: "content", message: "Missing or not an array." });
  }

  const seen = new Set<string>();
  walkNodes(data.content, "content", (node, path) => {
    if (typeof node.type !== "string" || node.type === "") {
      errors.push({ path, message: "Node has no type." });
      return;
    }
    const props = node.props;
    if (!isObject(props)) {
      errors.push({ path, message: `"${node.type}" has no props object.` });
      return;
    }
    // An editor indexes every node by id; a missing one makes the node
    // unselectable, and a duplicate makes two nodes resolve to one.
    if (typeof props.id !== "string" || props.id === "") {
      warnings.push({ path, message: `"${node.type}" has no id.` });
    } else if (seen.has(props.id)) {
      warnings.push({ path, message: `Duplicate id "${props.id}".` });
    } else {
      seen.add(props.id);
    }
    // A block removed or renamed since this page was saved renders as nothing
    // at all, with no error anywhere. A warning is the only trace there is.
    if (knownTypes && !knownTypes.has(node.type)) {
      warnings.push({ path, message: `Unknown block "${node.type}" — it will not render.` });
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}
