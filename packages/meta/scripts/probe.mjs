#!/usr/bin/env node
/**
 * One-time setup: turn the short-lived token from Graph API Explorer into the
 * environment variables this package needs.
 *
 * Run it once, paste its output into .env, and never run it again unless the
 * Page changes hands or the token is revoked.
 *
 *   node packages/meta/scripts/probe.mjs
 *
 * It reads META_APP_ID, META_APP_SECRET and the short-lived user token from
 * the environment, and prints the Page id, Page token and linked Instagram
 * account id. It writes nothing: a script that edited .env would be a script
 * that could clobber it.
 *
 * Deliberately standalone rather than importing ../src. It has to run BEFORE
 * `pnpm install` links @elkdonis/meta into the workspace — that is the whole
 * point of it — so it cannot depend on the package it is setting up. The only
 * thing duplicated is the fetch call.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const USER_TOKEN = process.env.META_USER_TOKEN;

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!APP_ID || !APP_SECRET || !USER_TOKEN) {
  die(
    'Set all three, then re-run:\n\n' +
      '    META_APP_ID=...        from the Meta App Dashboard\n' +
      '    META_APP_SECRET=...    App Dashboard > Settings > Basic\n' +
      '    META_USER_TOKEN=...    the short-lived token from Graph API Explorer\n\n' +
      '  e.g.  META_APP_ID=123 META_APP_SECRET=abc META_USER_TOKEN=EAAx... \\\n' +
      '          node packages/meta/scripts/probe.mjs'
  );
}

async function graph(path, params = {}) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const e = body.error ?? {};
    throw new Error(
      `${path} -> ${response.status} ${e.message ?? 'unknown'}` +
        (e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : '')
    );
  }
  return body;
}

/** Mask a token in output: enough to tell two apart, not enough to use. */
const mask = (t) => `${t.slice(0, 8)}...${t.slice(-6)} (${t.length} chars)`;

try {
  console.log(`\nGraph ${GRAPH_VERSION}\n`);

  // 1. What is the token we were handed?
  const debug = await graph('debug_token', {
    input_token: USER_TOKEN,
    access_token: `${APP_ID}|${APP_SECRET}`,
  });
  const info = debug.data ?? {};
  if (!info.is_valid) die(`That token is not valid: ${info.error?.message ?? 'no detail'}`);
  if (info.app_id !== APP_ID) {
    die(`That token belongs to app ${info.app_id}, not ${APP_ID}. They must match.`);
  }

  const scopes = info.scopes ?? [];
  console.log(`  token type   ${info.type}`);
  console.log(`  expires      ${info.expires_at ? new Date(info.expires_at * 1000).toISOString() : 'never'}`);
  console.log(`  scopes       ${scopes.join(', ') || '(none)'}`);

  const needed = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'];
  const missing = needed.filter((s) => !scopes.includes(s));
  if (missing.length) {
    console.log(`\n  MISSING SCOPES: ${missing.join(', ')}`);
    console.log('  Re-generate the token in Graph API Explorer with those ticked.');
  }
  if (!scopes.includes('instagram_basic') || !scopes.includes('instagram_content_publish')) {
    console.log('\n  Instagram publishing also needs instagram_basic + instagram_content_publish.');
  }

  // 2. Short-lived -> long-lived.
  const exchanged = await graph('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: USER_TOKEN,
  });
  const longLived = exchanged.access_token;
  console.log(`\n  long-lived user token  ${mask(longLived)}`);

  // 3. Page tokens, derived from the LONG-lived user token so they persist.
  const accounts = await graph('me/accounts', {
    fields: 'id,name,access_token,tasks',
    access_token: longLived,
  });
  const pages = accounts.data ?? [];
  if (!pages.length) {
    die('This user administers no Pages, so there is nothing to publish to.');
  }

  console.log(`\n  ${pages.length} page(s):\n`);
  for (const page of pages) {
    const tasks = page.tasks ?? [];
    const canPost = tasks.includes('CREATE_CONTENT');

    let ig = null;
    try {
      const linked = await graph(page.id, {
        fields: 'instagram_business_account{id,username}',
        access_token: page.access_token,
      });
      ig = linked.instagram_business_account ?? null;
    } catch {
      // A Page whose IG link cannot be read is still a usable Facebook Page.
    }

    console.log(`  ${page.name}`);
    console.log(`    META_PAGE_ID=${page.id}`);
    console.log(`    META_PAGE_ACCESS_TOKEN=${page.access_token}`);
    if (ig) {
      console.log(`    META_INSTAGRAM_USER_ID=${ig.id}    # @${ig.username ?? '?'}`);
    } else {
      console.log('    # no Instagram account linked (needs a Business/Creator account)');
    }
    console.log(`    tasks: ${tasks.join(', ') || '(none)'}${canPost ? '' : '   <- CANNOT PUBLISH'}`);
    console.log('');
  }

  console.log('  Page tokens above do not expire while this user stays a Page admin');
  console.log('  and the app keeps its permissions. Put the block for the Page you');
  console.log('  want into .env. Treat the token as a password.\n');
} catch (err) {
  die(err.message);
}
