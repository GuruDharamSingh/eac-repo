import { createElement, forwardRef } from "react";
const Link = forwardRef<HTMLAnchorElement, any>(function Link({ href, prefetch, replace, scroll, ...rest }, ref) {
  return createElement("a", { href: typeof href === "string" ? href : "#", ref, ...rest });
});
export default Link;
