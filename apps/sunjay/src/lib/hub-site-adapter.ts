import "server-only";

// Para Theater's pages as the Site Builder entries see them: the same save
// pipeline as the page editor (lane D: cleanBoxDoc + this app's resolved-key
// strip), the same path rules (slugProblem: reserved, template and feed
// slugs), and the same starting documents as /manage/builder.

import { revalidatePath } from "next/cache";
import type { SiteBuilderAdapter } from "@elkdonis/actions/server";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { templateDocument } from "@elkdonis/blocks";
import { stripResolved } from "@/blocks/resolved-keys";
import { loadPage, savePage } from "@/lib/puck/store";
import { slugProblem } from "@/lib/puck/actions";
import { startingTemplate } from "@/lib/puck/templates";
import { loadHomeSeed } from "@/lib/puck/home-seed";
import { hubSite } from "@/lib/hub-site";

/** The card's start ids → this app's NEW_PAGE_STARTS values. */
const START: Record<string, string> = { blank: "plain", services: "services", writing: "journal" };

export const siteAdapter: SiteBuilderAdapter = {
  templatePages: hubSite.siteBuilder!.templatePages,
  maxDepth: hubSite.siteBuilder!.maxDepth,
  sanitizeDoc: (doc) => cleanBoxDoc(stripResolved(doc) as never),
  pathProblem: (path) => slugProblem(path),
  async startDoc(start, path, title) {
    const value = START[start];
    if (!value) return null;
    return templateDocument(startingTemplate(path, value, await loadHomeSeed()), title);
  },
  loadPage: (path) => loadPage(path),
  savePage: (path, doc) => savePage(path, doc),
  revalidate(path) {
    if (path === "*" || path === "") revalidatePath("/", "layout");
    else revalidatePath(`/${path}`);
  },
};
