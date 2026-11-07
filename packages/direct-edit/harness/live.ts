import { mountVisualEditor } from "/app/packages/direct-edit/src/index";
import { patchCss, cleanPatches, emptyPatches, isBoxSelector } from "/app/packages/direct-edit/src/block/patch";
(window as any).pure = { patchCss, cleanPatches, isBoxSelector };
(window as any).saved = [];
(window as any).ed = mountVisualEditor({ doc: emptyPatches(), onSave: async (d) => { (window as any).saved.push(d); return { ok: true }; } });
