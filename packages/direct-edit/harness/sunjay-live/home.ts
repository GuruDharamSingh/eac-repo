// Para Theater's home page editor on the page's real signed-out HTML, with no network. The page fetches itself, as on the site.
import { contractOf } from "/app/packages/blocks/src/contract";
import { openVisitorPage } from "/app/packages/direct-edit/src/puck/index";
import { HOME_BLOCKS } from "/app/apps/sunjay/src/blocks/home-blocks";
import { landingCanvasConfig } from "/app/apps/sunjay/src/lib/puck/config.landing";
import { quietThePage } from "/app/apps/sunjay/src/components/landing/page-editor-mount";

(globalThis as any).__saved = null;
(globalThis as any).__open = (tree: unknown, notice?: string) => openVisitorPage({
  root: document.querySelector<HTMLElement>(".pts-snap")!,
  selector: ".pts-snap",
  tree: tree as never,
  title: "Home",
  pageName: "Home page",
  config: landingCanvasConfig as never,
  contract: contractOf(HOME_BLOCKS) as never,
  saveNotice: notice,
  onSave: async (d) => { (globalThis as any).__saved = d; return { ok: true }; },
  onDone() {},
}).then((e) => { quietThePage(); return !!e; });
