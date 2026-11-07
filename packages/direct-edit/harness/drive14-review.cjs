// B8, the review notes that no shared block reaches (view-blocks.html#review), and a host with no contract (tree.html).
module.exports = async ({ p, ok, h, open, errs }) => {
  const field = (f) => `.de-vpanel [data-f="${f}"]`;

  // ------------------------------------------------------------------ a contract prop named id, puck, morph, ...
  await open("#review");
  await h.sel("head");
  for (const name of ["id", "puck", "editMode", "children", "morph"]) ok(`B8 no field for a prop named ${name}`, (await p.$$(field(`p-${name}`))).length === 0, name);
  ok("B8 the node keeps its identity", (await h.node("head")).props.id === "head");

  // ------------------------------------------------------------------ a colon in a colour prop's name
  await p.locator(field("pop-p-tone:deep")).scrollIntoViewIfNeeded();
  await p.click(field("pop-p-tone:deep")); await h.pause(60);
  ok("B8 a colour prop with a colon opens its popover", (await p.$$(".de-vpanel .de-colorpop")).length === 1);
  await p.click('[data-f="ctab-custom"]'); await p.fill('[data-f="chex"]', "#336699"); await h.pause(60);
  ok("B8 and stores on that prop", (await h.node("head")).props["tone:deep"] === "#336699", (await h.node("head")).props);
  await p.click('[data-f="popclose"]'); await h.pause(30);

  // ------------------------------------------------------------------ stored types named after Object.prototype
  for (const [id, type] of [["ctor", "constructor"], ["proto", "__proto__"], ["tostr", "toString"]]) {
    await h.sel(id);
    ok(`B8 ${type}: draws named`, (await p.textContent(`#host [data-tree-node="${id}"]`)).includes(`Unknown block: ${type}`), await p.textContent(`#host [data-tree-node="${id}"]`).catch(() => null));
    ok(`B8 ${type}: selectable, heading is its name`, (await h.head()) === type, await h.head());
    ok(`B8 ${type}: a row in the tree`, (await h.rows()).some((r) => r.startsWith(type)), await h.rows());
    ok(`B8 ${type}: Add after it does not go inside`, (await p.$$(`.de-vpanel [data-tree-act="detach"]`)).length === 1);
  }
  await h.right('#host [data-tree-node="ctor"]');
  ok("B8 constructor: the menu opens", (await p.$$(".de-menu")).length === 1);
  await h.closeMenu();

  // ------------------------------------------------------------------ Detach on a parent keeps a block no catalogue knows
  await open("#review");
  await h.sel("gridU");
  await p.locator(field("detach-block")).scrollIntoViewIfNeeded(); await p.click(field("detach-block")); await h.pause(100);
  const d = await h.doc();
  ok("B8 the unknown block stays a node", h.nodeIn(d, "gone")?.type === "no-such-block", h.nodeIn(d, "gone"));
  ok("B8 its stand-in text is not copied as words", !JSON.stringify(d).includes("Unknown block"), JSON.stringify(d).slice(0, 200));
  ok("B8 the words beside it stay the same node", h.nodeIn(d, "wU")?.type === "words");
  await h.undo();

  // ------------------------------------------------------------------ Two parts selecting one element: the first declared wins.
  await open("#review");
  await h.sel("head~p:title");
  ok("B8 first declared wins", (await h.head()) === "Heading", await h.head());
  await h.sel("head");
  ok("B8 the later part has no row", !(await h.rows()).some((r) => r.startsWith("Again")), await h.rows());

  // ------------------------------------------------------------------ Undo with focus and no typing session
  await open();
  await h.sel("box1");
  await p.fill(field("opacity"), "0.6"); await h.pause(50);
  ok("B8 focus is in the field", await p.$eval(field("opacity"), (e) => document.activeElement === e));
  // The button, without taking focus from the field.
  await p.evaluate(() => document.querySelector("[data-a=undo]").click()); await h.pause(60);
  ok("B8 Undo with focus: focus stays", await p.$eval(field("opacity"), (e) => document.activeElement === e));
  ok("B8 Undo with focus: the field shows the undone value", (await p.inputValue(field("opacity"))) !== "0.6", await p.inputValue(field("opacity")));

  // ------------------------------------------------------------------ a host with no contract
  errs.length = 0;
  await open("", "tree.html");
  await h.sel("head");
  ok("N no part rows", !(await h.rows()).some((r) => /^(Small label|Rule|Line underneath)\b/.test(r)), await h.rows());
  ok("N no Tweaks", (await p.$$('.de-vpanel [data-tab="tweaks"]')).length === 0);
  ok("N the tabs as before", (await p.$$eval(".de-vpanel .de-tabs button", (e) => e.map((x) => x.textContent))).join() === "Properties,Code");
  ok("N the sealed panel as before", (await h.sections()).length === 0, await h.sections());
  ok("N a sealed node's row has no children", (await p.$$('.de-layers li[data-row="head"] .de-twist')).length === 0);
  await h.right('#host [data-tree-node="head"]');
  const menu = await p.$$eval(".de-menu [data-mi]", (e) => e.filter((x) => !x.closest("[data-sub]")).map((x) => `${x.dataset.mi}:${x.disabled ? "off" : "on"}`));
  // Measured on the bundle built from baseline-tree (direct-edit-stone2-base.tgz), sealed heading selected.
  ok("N the menu as before", menu.join() === "parent:on,group:on,groupcol:on,ungroup:off,detach:on,dup:on,first:off,last:on,copy-style:off,paste-style:off,hide:off,reset:off,delete:on", menu);
  await h.closeMenu();
  // Three clicks on the heading stay on the node: nothing to go into.
  await h.sel(null);
  const t = await p.locator("#host .blk-heading-title").boundingBox();
  await p.mouse.click(t.x + 5, t.y + 5); await h.pause(40); await p.mouse.click(t.x + 5, t.y + 5); await h.pause(40); await p.mouse.click(t.x + 5, t.y + 5); await h.pause(40);
  ok("N clicks stay on the block", /Section heading/.test((await h.head()) ?? ""), await h.head());
  ok("N no morph with no contract", (await h.node("head")).props.morph === undefined);
};
