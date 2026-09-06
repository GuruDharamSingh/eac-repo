"use strict";

/**
 * Silex v3 server plugin — loaded via SILEX_SERVER_CONFIG.
 *
 * Responsibilities:
 *   1. Register the Nextcloud storage + hosting connectors so Silex reads,
 *      writes and publishes directly into each org's Nextcloud folder.
 *   2. Install a one-time token-redemption middleware that turns
 *      `/?t=<token>` (from the arts-collective /edit/{slug} gate) into a
 *      per-user Nextcloud session.
 *   3. Serve the EAC editor assets (block CSS + template registries) the
 *      client config (SILEX_CLIENT_CONFIG) fetches at `/eac-*`.
 *
 * ── Middleware ordering (Silex 3.9 / Express 5) ──────────────────────────────
 * Silex boots as: create(app) → addRoutes(app) → loadConfigFiles() →
 * initDefaultConnectors() → app.use('/api', …) → start(app) [emits
 * STARTUP_START, then listens].
 *
 * `loadConfigFiles()` runs `loadUserConfig()` (this file, via
 * SILEX_SERVER_CONFIG) BEFORE `loadSilexConfig()` (the deploy `.silex.js`,
 * which registers StaticPlugin — the editor client at "/"). Both StaticPlugin
 * and this plugin add their handlers on the STARTUP_START event, and
 * component-emitter fires listeners in registration order — so ours run first
 * and our middleware sits ahead of the static editor router with no
 * `app._router.stack` surgery (Express 5 removed `app._router` anyway).
 */

const { NextcloudStorage } = require("./src/NextcloudStorage");
const { NextcloudHosting } = require("./src/NextcloudHosting");
const { tokenRedeemMiddleware } = require("./src/auth");
const { registerEditorAssets } = require("./src/editorAssetsMiddleware");

// ServerEvent.STARTUP_START. The enum value ("startup-start") is stable across
// the 3.x line; prefer the package export in case that ever changes.
let STARTUP_START = "startup-start";
try {
  const exposed = require("@silexlabs/silex");
  if (exposed && exposed.events && exposed.events.ServerEvent && exposed.events.ServerEvent.STARTUP_START) {
    STARTUP_START = exposed.events.ServerEvent.STARTUP_START;
  }
} catch (_) {
  /* fall back to the literal — resolution can fail if silex isn't a sibling dep */
}

module.exports = async function silexNextcloudConnector(config /* , opts */) {
  // Nextcloud is the single source of truth. Replace, don't append — the deploy
  // config's default FS/FTP connectors must not be in the mix.
  config.setStorageConnectors([new NextcloudStorage()]);
  config.setHostingConnectors([new NextcloudHosting()]);

  let installed = false;
  config.on(STARTUP_START, ({ app }) => {
    if (installed || !app) return;
    installed = true;

    // Token redemption first: it 302s `/?t=` before anything else can serve
    // the editor HTML, and cookie-session (from create()) is already in place
    // so req.session exists here.
    app.use(tokenRedeemMiddleware());

    // Explicit GET routes for /eac-blocks.css and the /eac-*-template.{json,css}
    // the client config pulls in. Registered ahead of StaticPlugin's "/" router.
    registerEditorAssets(app);

    console.info(
      "> [silex-nextcloud-connector] token redemption + EAC editor assets installed"
    );
  });

  console.info(
    "> [silex-nextcloud-connector] registered Nextcloud storage + hosting connectors"
  );
};
