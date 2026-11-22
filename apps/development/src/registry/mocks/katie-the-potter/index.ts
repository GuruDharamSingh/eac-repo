import type { AppMocks } from "../types";

export const MOCKS: AppMocks = {
  "ktp-artwork-grid": {
    kind: "real",
    load: () => import("./artwork-grid"),
    note: "Real PieceCard and the block's own CSS from the app, in a copy of the grid shell; invented pieces with drawn placeholder pots. The popup is not mocked.",
  },
  "ktp-piece": {
    kind: "real",
    load: () => import("./piece"),
    note: "Real PieceCard and piece-block.css from the app, in a copy of the frame; the button is the plain View link (cart actions need the shop).",
  },
};
