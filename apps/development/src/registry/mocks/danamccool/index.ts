import type { AppMocks } from "../types";

export const MOCKS: AppMocks = {
  "dm-gallery-grid": {
    kind: "real",
    load: () => import("./gallery-grid"),
    note: "Real cms-ui ProfileGallery (read-only, square tiles, hover titles) with invented colour-field paintings; the slideshow and rearranging are not mocked.",
  },
};
