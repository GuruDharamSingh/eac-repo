import { createCollectHandler } from "@elkdonis/analytics/route";

// First-party analytics collector (packages/analytics).
export const POST = createCollectHandler({
  forceOrgId: "fourth_way_book_readers",
  ignorePrefixes: ["/books/manage", "/books/login", "/books/auth", "/books/circle-file"],
});
