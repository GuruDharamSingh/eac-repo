import type { Data } from "@puckeditor/core";

/** What a new page can start from (2026-11-06). Nothing is stored until Publish. */
export const NEW_PAGE_STARTS = [
  { value: "text", label: "Heading and text" },
  { value: "blank", label: "Blank page" },
] as const;

const id = (t: string) => `${t}-${Math.random().toString(36).slice(2, 10)}`;

export function startingDocument(slug: string, start: string | undefined): Data {
  const title = slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  const content =
    start === "blank"
      ? []
      : [
          { type: "section-heading", props: { id: id("section-heading"), title, level: "h1" } },
          { type: "prose", props: { id: id("prose"), body: "<p>Write here.</p>" } },
        ];
  return { root: { props: { title } }, content } as unknown as Data;
}
