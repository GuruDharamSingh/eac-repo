import type { Data } from "@puckeditor/core";

/** Puck's Data from one of our flat layout documents (tour or experience). Server-safe. */
export function toPuckData(layout: {
  root: { props: Record<string, unknown> };
  content: Array<{ type: string; props: Record<string, unknown> }>;
}): Data {
  return { root: { props: layout.root.props ?? {} }, content: layout.content } as unknown as Data;
}
