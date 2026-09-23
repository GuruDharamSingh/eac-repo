import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { PageResult } from "@elkdonis/lms-ui";

/** Turn a package page result into Next's control flow. Moved slugs are 301s (308 in Next). */
export function settle(r: PageResult, opts: { permanent?: boolean } = {}): React.ReactNode {
  if (r.kind === "not-found") notFound();
  if (r.kind === "redirect") return opts.permanent === false ? redirect(r.to) : permanentRedirect(r.to);
  return r.node;
}
