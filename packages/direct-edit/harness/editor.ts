import { mountClassifiedsEditor } from "/app/apps/arts-collective/src/lib/classifieds/editor-engine";
import { CARD_LABELS, CARD_TEMPLATES, FEED_FIELDS, FEED_FIELD_KINDS, SAMPLE_ITEMS, cardsToSheet, starterCards } from "/app/apps/arts-collective/src/lib/cards/catalog";
import { starterDoc } from "/app/apps/arts-collective/src/lib/classifieds/catalog";
const doc: any = starterDoc("Test org");
const ad = doc.ads[0];
// One ad with a row holding two parts, a column holding one: three levels to click through.
ad.o.tree = [{ id: "header", kind: "header" }, { id: "n1", kind: "box", kids: [{ id: "title", kind: "title" }, { id: "n2", kind: "box", kids: [{ id: "price", kind: "price" }] }] }, { id: "body", kind: "body" }, { id: "contact", kind: "contact" }];
ad.o.copy = { ...(ad.o.copy || {}), header: "For sale", title: "Oak easel", price: "$120", body: "Barely used.", contact: "Box 6" };
(window as any).saved = [];
if (location.hash === "#cards") mountClassifiedsEditor(document.getElementById("root")!, { doc: cardsToSheet(starterCards()), orgName: "Test org", threads: [], viewUrl: "#", onSave: async () => ({ ok: true }), pattern: { items: SAMPLE_ITEMS, fields: FEED_FIELDS, fieldKinds: FEED_FIELD_KINDS, labels: CARD_LABELS, title: "Feed cards", templates: CARD_TEMPLATES, source: "Sample" } });
else mountClassifiedsEditor(document.getElementById("root")!, { doc, orgName: "Test org", threads: [], viewUrl: "#", onSave: async (d) => { (window as any).saved.push(d); return { ok: true }; } });
