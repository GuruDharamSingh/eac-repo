"use strict";

/**
 * Silex v3 plugin entry.
 *
 * Loaded via `SILEX_SERVER_CONFIG=/silex/extensions/silex-nextcloud-connector/index.js`.
 *
 * Responsibilities:
 *   1. Register a token-redemption middleware that bounces /?t=<one-time-token>
 *      against the arts-collective auth bridge and stashes per-user Nextcloud
 *      credentials in the Silex express session.
 *   2. Register the NextcloudStorage connector so Silex reads/writes website
 *      data + assets directly into each artist's Nextcloud folder.
 *   3. Register the NextcloudHosting connector so Silex publishes generated
 *      static files into each org's Nextcloud published folder.
 */

const { NextcloudStorage } = require("./src/NextcloudStorage");
const { NextcloudHosting } = require("./src/NextcloudHosting");
const { tokenRedeemMiddleware } = require("./src/auth");
const { ASSET_ROUTES, registerEditorAssets } = require("./src/editorAssetsMiddleware");

function getLayerName(layer) {
  return layer.name || layer.handle?.name || "";
}

function hoistLayer(stack, predicate, insertAt = 0) {
  const index = stack.findIndex(predicate);
  if (index < 0) return null;
  const [layer] = stack.splice(index, 1);
  stack.splice(insertAt, 0, layer);
  return layer;
}

module.exports = async function silexNextcloudConnector(config /* , opts */) {
  // Replace any previously registered storage connectors. Silex will fall back
  // to filesystem connectors if none are registered, so explicitly clearing
  // makes artist-owned Nextcloud the single source of truth in this image.
  config.setStorageConnectors([new NextcloudStorage()]);
  config.setHostingConnectors([new NextcloudHosting()]);

  // Hook the express app once it's about to start listening — that's the
  // first event where the silex-plugins runtime hands us the live app.
  let middlewareInstalled = false;
  const install = ({ app }) => {
    if (middlewareInstalled || !app) return;
    middlewareInstalled = true;

    app.use(tokenRedeemMiddleware());
    registerEditorAssets(app);
    // Silex registered its own routes (including GET /) during addRoutes(),
    // which runs BEFORE plugins load. Express matches handlers in stack
    // order, so a freshly app.use()'d middleware sits behind them and never
    // fires for GET /. Hoist our layers ahead of Silex routes, but keep them
    // AFTER cookie-session so req.session exists before token redemption.
    const router = app._router || app.router;
    if (router && Array.isArray(router.stack)) {
      const stack = router.stack;
      const tokenLayerIndex = stack.findIndex((candidate) => {
        const name = getLayerName(candidate);
        return name === "eacTokenRedeem";
      });
      const tokenLayer =
        tokenLayerIndex >= 0 ? stack.splice(tokenLayerIndex, 1)[0] : null;
      const sessionLayerIndex = stack.findIndex((candidate) => {
        const name = getLayerName(candidate);
        return name === "cookieSession" || name.includes("cookieSession");
      });
      const insertAt =
        sessionLayerIndex >= 0
          ? sessionLayerIndex + 1
          : stack.length;
      if (tokenLayer) stack.splice(insertAt, 0, tokenLayer);
      // app.get('/eac-blocks.css', ...) creates a route layer; hoist it
      // ahead of Silex's catch-all routes — but AFTER expressInit (which
      // decorates res with .set/.status/.send) and AFTER cookieSession.
      // Inserting at position 0 would put it before expressInit and cause
      // "TypeError: res.set is not a function" at request time.
      const cssInsertAt =
        sessionLayerIndex >= 0 ? sessionLayerIndex + 2 : insertAt + 1;
      for (const routePath of ASSET_ROUTES) {
        hoistLayer(
          stack,
          (candidate) => candidate.route && candidate.route.path === routePath,
          cssInsertAt
        );
      }
    }
    console.info(
      "> [silex-nextcloud-connector] token redemption and EAC editor assets middleware installed (after session)"
    );
  };

  // ServerEvent.STARTUP_START is exposed via @silexlabs/silex-plugins events,
  // but the string value is stable — register both ways defensively.
  try {
    const events = require("/silex/dist/server/server/events");
    config.on(events.ServerEvent.STARTUP_START, install);
  } catch (e) {
    config.on("silex:startup:start", install);
  }

  console.info(
    "> [silex-nextcloud-connector] registered Nextcloud storage and hosting connectors"
  );
};
