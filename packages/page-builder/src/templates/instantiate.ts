import type { Data } from "@puckeditor/core";
import type { TemplateNode } from "@elkdonis/blocks";

// Fresh ids for template and section nodes. Shared by the Templates (replace the page) and Sections (add to the page)
// tabs. Pure: no editor, no DOM, so it can be tested alone.

export function freshId(type: string): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${type}-${rand}`;
}

/** Copy nodes with new ids (slots included), collecting every id on the way. */
export function instantiate(nodes: TemplateNode[], ids: string[]): Data["content"] {
  return nodes.map((node) => {
    const id = freshId(node.type);
    ids.push(id);
    const props: Record<string, unknown> = { ...node.props, id };
    // Slots hold arrays of nodes inside a block's props.
    for (const [key, value] of Object.entries(props)) {
      if (Array.isArray(value) && value.every((v) => v && typeof v === "object" && "type" in v && "props" in v)) {
        props[key] = instantiate(value as TemplateNode[], ids);
      }
    }
    return { type: node.type, props } as Data["content"][number];
  });
}
