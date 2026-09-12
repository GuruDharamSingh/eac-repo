import { buildWikiTree, type WikiPageListItem, type WikiTreeNode } from "@elkdonis/services";
import type { WikiParentOption } from "@/components/hub/WikiPageForm";

/**
 * The page tree flattened for a <select>, depth-indented, alphabetical.
 * `excludeIds` drops a page and its own descendants when editing, so the
 * picker can't offer a choice the server would reject.
 */
export function parentOptionsFor(
  pages: WikiPageListItem[],
  excludeIds?: Set<string>
): WikiParentOption[] {
  const options: WikiParentOption[] = [];

  const walk = (nodes: WikiTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (excludeIds?.has(node.id)) continue;
      options.push({ id: node.id, title: node.title, depth });
      walk(node.children, depth + 1);
    }
  };

  walk(buildWikiTree(pages), 0);
  return options;
}
