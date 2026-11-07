import { mountVisualEditor } from "/app/packages/direct-edit/src/index";
import { emptyPatches } from "/app/packages/direct-edit/src/block/patch";
import { choosePicture } from "/app/apps/innergathering/src/components/landing/page-picture-chooser";
(window as any).saved = [];
(window as any).ed = mountVisualEditor({ doc: emptyPatches(), choosePicture, onSave: async (d) => { (window as any).saved.push(d); return { ok: true }; } });
