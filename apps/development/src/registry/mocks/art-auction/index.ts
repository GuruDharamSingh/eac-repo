import type { AppMocks } from "../types";

export const MOCKS: AppMocks = {
  "au-article": {
    kind: "real",
    load: () => import("./article"),
    note: "Real cms-ui ArticleView with an invented post; Art Auction tokens on the wrapper.",
  },
  "au-discussion": {
    kind: "static",
    load: () => import("./discussion"),
    note: "Copy of the block's markup with invented replies (the live one polls the forum).",
  },
  "au-topics": {
    kind: "static",
    load: () => import("./topics"),
    note: "Copy of the block's markup with the block's own sample topics plus one.",
  },
};
