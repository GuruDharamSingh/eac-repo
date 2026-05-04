# Workshop template CSS — how it flows from source to published page

> Status: implemented April 2026. Replaces the previous preview-only CSS
> injection at `/preview/workshop`.

## The problem we hit

When workshop blocks were registered with Silex (categories `EAC Workshop
Template`), only their HTML markup was wired up. The matching CSS files
(`eac-tokens.css`, `eac-ws-*.css`) were never told to Silex. When the user
hit Publish, Silex called `editor.getCss()` which only returned its tiny
canvas reset plus a couple of per-element rules. The published page on
`<slug>.localhost:3007/` rendered the workshop markup with no styling.

The preview surface at `/preview/workshop` was masking this because it
inlined the CSS itself — but the user explicitly retired the preview.

## Constraint we honored

The user wants the template CSS to be **editable in the Silex editor**
to some degree. So pure `protectedCss` (which would include the CSS in
output but make it invisible/uneditable) was ruled out. The chosen path
is to seed the CSS into GrapesJS' `CssComposer` so it shows up in the
Style Manager and is part of `editor.getCss()` like any other rule.

The trade-off accepted: GrapesJS persists `CssComposer` state into
`website.json`, so once seeded the rules become part of the saved
project. That means later edits to the source files will not retroactively
update existing projects — the seed only fires for projects that don't
yet contain workshop rules. This was an explicit accepted trade-off
(`"dont worry about idealized"`).

## What flows where

| Layer                              | Path                                           | Role                                                                 |
| ---------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Source of truth                    | `src/templates/workshop/css/*.css` + `src/templates/tokens/eac-tokens.css` | Idealized template CSS. Hand-edited.                                 |
| Reader                             | `src/workshopTemplateRegistry.js`              | `readWorkshopTemplateCss()` concatenates tokens + all sections.      |
| Server endpoint                    | `GET /eac-workshop-template.css`               | Served by `editorAssetsMiddleware.js`. Single combined stylesheet.   |
| Editor canvas (display)            | `gjs.canvas.styles += /eac-workshop-template.css` | First-paint styling inside the GrapesJS iframe.                      |
| Editor `CssComposer` (editable)    | `editor.Css.addRules(cssText)` once per session | Makes the rules editable + included in `editor.getCss()`.            |
| Publish output                     | `<base>/silex/published/css/<page>-<hash>.css` | Silex generates this from `editor.getCss()`.                         |
| Public render                      | `<slug>.localhost:3007/`                       | Reads `organizations.silex_published_path`, proxies HTML + CSS via `/api/silex/assets/...`. |

## Implementation steps

### 1. Re-use the existing CSS endpoint

`packages/silex-nextcloud-connector/src/editorAssetsMiddleware.js` already
serves `GET /eac-workshop-template.css` from
`readWorkshopTemplateCss()`. No server change needed.

### 2. Fetch the same CSS as text in the client config

In `packages/silex-nextcloud-connector/src/client-config.js`:

```js
let workshopCssPromise = null;
function loadWorkshopCss() {
  if (workshopCssPromise) return workshopCssPromise;
  workshopCssPromise = fetch(sameOriginUrl(WORKSHOP_CSS_PATH), { cache: "no-store" })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  return workshopCssPromise;
}
```

Loaded in parallel with the JSON manifest in the plugin entry:

```js
const [initialWorkshopTemplate, initialWorkshopCss] = await Promise.all([
  loadWorkshopTemplate(),
  loadWorkshopCss(),
]);
```

### 3. Keep the canvas `<link>` for editor display

```js
for (const cssPath of [CSS_PATH, WORKSHOP_CSS_PATH]) {
  for (const candidate of [cssPath, sameOriginUrl(cssPath)]) {
    if (candidate && !styles.includes(candidate)) styles.push(candidate);
  }
}
canvas.styles = styles;
```

This is unchanged. The `<link>` gives instant paint inside the canvas
iframe even before the `CssComposer` seed completes.

### 4. Seed the CSS into the editable `CssComposer`

```js
function seedWorkshopCssIntoEditor(editor) {
  if (!editor || !editor.Css || typeof editor.Css.addRules !== "function") return;
  if (editor.__eacWorkshopCssSeeded) return;
  editor.__eacWorkshopCssSeeded = true;

  // Skip if the saved project already contains workshop rules — GrapesJS
  // persists CssComposer state into website.json, so reopening a saved
  // project would otherwise duplicate selectors.
  const existingRules = editor.Css.getAll?.() ?? null;
  const alreadyHasWorkshopRules = existingRules?.some((rule) => {
    const sel = rule?.getSelectorsString?.();
    return typeof sel === "string" && sel.includes(".eac-ws-");
  });
  if (alreadyHasWorkshopRules) return;

  loadWorkshopCss().then((cssText) => {
    if (!cssText) return;
    editor.Css.addRules(cssText);
  });
}
```

Called from the workshop install path, immediately after blocks register:

```js
loadWorkshopTemplate().then((registry) => {
  if (!registry || editor.__eacWorkshopBlocksInstalled) return;
  editor.__eacWorkshopBlocksInstalled = true;
  registerWorkshopTypes(editor, registry);
  addWorkshopBlocks(editor, registry);
  seedWorkshopCssIntoEditor(editor);
});
```

### 5. Publish path — no change required

Once rules are in `CssComposer`, Silex's existing publish flow includes
them in `editor.getCss()` and writes the result to
`<base>/silex/published/css/<page>-<hash>.css`. The publish manifest
flow we built earlier (`.eac-publish.json`) selects the correct entry
HTML, and Arts proxies CSS via
`/api/silex/assets/<slug>/css/<page>-<hash>.css`.

## Idempotence and identity

| Guard                                  | Where                              | Why                                                                 |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `editor.__eacWorkshopCssSeeded`        | `seedWorkshopCssIntoEditor`        | Don't seed twice within one editor session.                         |
| `.eac-ws-` selector lookup             | `seedWorkshopCssIntoEditor`        | Don't seed if the saved project already carries the rules.          |
| `editor.__eacWorkshopBlocksInstalled`  | workshop install promise           | Don't double-register block types and entries.                      |
| `cache: "no-store"` on `loadWorkshopCss` | `loadWorkshopCss`                | Avoid stale CSS during template iteration.                          |

## Operational steps after deploying this change

1. `docker compose restart silex` (we did this).
2. Open the Silex editor at `http://localhost:6805` for the relevant
   org and workshop project.
3. The first time a project loads after this change, the editor
   serializes the workshop CSS into `website.json`. Save the project so
   it persists.
4. Publish. The new `<page>-<hash>.css` will contain `.eac-ws-*` rules.
5. Activate via the Arts hub (POST `/api/silex/layout`). The activation
   route reads the publish manifest written by the connector and
   updates `organizations.silex_published_path`.
6. Visit `<slug>.localhost:3007/`. Workshop blocks should render styled.

## Future work

- **Token isolation**: tokens currently land in the same project as the
  block CSS. If we ever want per-org theming, split tokens out and seed
  them only via a non-editable channel.
- **Source-of-truth refresh**: as long as `website.json` persists the
  rules, edits to the upstream `eac-ws-*.css` files won't retroactively
  reach existing projects. If/when this matters, we can add a
  `Reset workshop CSS to template` action in the editor that wipes
  `.eac-ws-*` rules from `CssComposer` and re-seeds.
- **Phase 2 web components** would replace `eac-embed` slots with first-class
  custom element types and could collapse the dual canvas+seed wiring.
