/*
 * EAC replacement for @silexlabs/silex/server/deploy/.silex.js
 * ============================================================
 * Baked over the packaged file at image build time (see ../Dockerfile).
 *
 * Silex loads its deploy config from a path hardcoded in server/config.js
 * (`configFilePath`, not env-configurable), AFTER the user config named by
 * SILEX_SERVER_CONFIG. The upstream file is "the full SaaS": a multi-site
 * dashboard whose "/" route 302-redirects before the editor can render, an
 * onboarding email backend, and FTP/GitLab connectors selected by env vars.
 *
 * We want none of that. This file registers ONLY the static editor client.
 *   - Storage + hosting connectors come from SILEX_SERVER_CONFIG
 *     (packages/silex-nextcloud-connector), which loads first and calls
 *     config.setStorageConnectors([...]) / setHostingConnectors([...]).
 *   - We must NOT touch connectors here: the upstream initConnectors() does
 *     config.setStorageConnectors([]) first, which would wipe ours.
 */

'use strict'

const { join, dirname } = require('path')

const StaticPlugin = require('../../dist/server/server/plugins/StaticPlugin').default

/** Resolve a bundled asset package's dir, or null if it isn't installed. */
function pkgDir(id) {
  try {
    return dirname(require.resolve(`${id}/package.json`))
  } catch {
    console.warn(`> [eac-deploy-config] optional asset package not found: ${id}`)
    return null
  }
}

module.exports = async function (config) {
  const routes = [
    // Public assets (favicon, logos) then the built editor client. serve-static
    // falls through on a miss, so "/" resolves to dist/client/index.html.
    { route: '/', path: join(__dirname, '../../public') },
    { route: '/', path: join(__dirname, '../../dist/client') },
  ]

  const fa = pkgDir('@fortawesome/fontawesome-free')
  if (fa) {
    routes.push({ route: '/css/', path: join(fa, 'css/') })
    routes.push({ route: '/webfonts/', path: join(fa, 'webfonts/') })
  }

  const ubuntu = pkgDir('@fontsource/ubuntu')
  if (ubuntu) {
    routes.push({ route: '/css/files/', path: join(ubuntu, 'files/') })
  }

  try {
    await config.addPlugin([StaticPlugin], {
      [StaticPlugin]: { routes },
    })
  } catch (e) {
    console.error('> [eac-deploy-config] failed to register StaticPlugin', e)
    throw e
  }

  return {}
}
