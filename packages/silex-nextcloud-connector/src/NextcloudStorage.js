"use strict";

/**
 * Silex v3 StorageConnector backed by per-user Nextcloud (WebDAV).
 *
 * One website per session, scoped by the org slug from the auth bridge.
 * The minimal Silex image asks for website id "default"; we treat that as
 * an alias for the current session's org project.
 * Multi-website (admin role) is intentionally deferred — see status notes.
 *
 * File layout inside each artist's Nextcloud folder:
 *   <projectPath>/website.json   — Silex website data (single-file form)
 *   <projectPath>/meta.json      — Silex website meta
 *   <projectPath>/pages/*.json   — split page files (when Silex serializes that way)
 *   <projectPath>/assets/*       — uploaded assets
 */

const { createWebdavClient } = require("./webdav");
const { getStored, clearStored } = require("./auth");

const WEBSITE_DATA_FILE = "website.json";
const WEBSITE_META_FILE = "meta.json";
const ASSETS_FOLDER = "assets";
const PAGES_FOLDER = "pages";
const DEFAULT_WEBSITE_ID = "default";

const USER_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='currentColor' d='M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z'/%3E%3C/svg%3E";

const EMPTY_WEBSITE = {
  pages: [],
  assets: [],
  styles: [],
  settings: {},
  pagesFolder: PAGES_FOLDER,
  fonts: [],
  symbols: [],
  publication: {},
};

function clientFor(session) {
  const stored = getStored(session);
  if (!stored) return null;
  return createWebdavClient({
    baseUrl: stored.ncBaseUrl,
    user: stored.ncUser,
    pass: stored.ncPass,
  });
}

function projectPath(session) {
  const stored = getStored(session);
  if (!stored) throw new Error("Not logged in");
  return stored.projectPath.replace(/\/+$/, "");
}

function expectedWebsiteId(session) {
  const stored = getStored(session);
  if (!stored) throw new Error("Not logged in");
  return stored.slug;
}

function assertWebsiteId(session, websiteId) {
  const expected = expectedWebsiteId(session);
  if (websiteId && websiteId !== expected && websiteId !== DEFAULT_WEBSITE_ID) {
    throw new Error(
      `Website ${websiteId} not accessible in this Silex session (expected ${expected})`
    );
  }
}

class NextcloudStorage {
  constructor(opts = {}) {
    this.connectorId = "nextcloud-storage";
    this.connectorType = "STORAGE";
    this.displayName = opts.displayName || "Nextcloud (artist)";
    this.icon = USER_ICON;
    this.color = "#ffffff";
    this.background = "#1d4ed8";
    this.disableLogout = false;
    this.options = opts;
  }

  // ---------- Connector (auth) ----------

  getOptions() {
    return {};
  }

  async getOAuthUrl() {
    return null;
  }

  async getLoginForm(session, redirectTo) {
    if (getStored(session)) return null;
    return `<p>Open the editor from the arts-collective hub to start a Nextcloud session.</p>`;
  }

  async getSettingsForm() {
    return null;
  }

  async isLoggedIn(session) {
    return !!getStored(session);
  }

  async setToken(session, token) {
    // No-op: tokens arrive via the /?t= bounce middleware, not the
    // standard Silex callback flow.
    return;
  }

  async logout(session) {
    clearStored(session);
  }

  async getUser(session) {
    const stored = getStored(session);
    if (!stored) return null;
    return {
      name: stored.ncUser,
      picture: USER_ICON,
      storage: {
        connectorId: this.connectorId,
        type: this.connectorType,
        displayName: this.displayName,
        icon: this.icon,
        color: this.color,
        background: this.background,
        disableLogout: this.disableLogout,
        options: {},
      },
    };
  }

  // ---------- Storage ----------

  async listWebsites(session) {
    const stored = getStored(session);
    if (!stored) return [];
    const meta = await this._readMetaSafe(session, stored.slug);
    return [
      {
        websiteId: DEFAULT_WEBSITE_ID,
        name: meta?.name || stored.slug,
        imageUrl: meta?.imageUrl,
        connectorUserSettings: meta?.connectorUserSettings || {},
        createdAt: meta?.createdAt || new Date(),
        updatedAt: meta?.updatedAt || new Date(),
      },
    ];
  }

  async createWebsite(session, meta) {
    const stored = getStored(session);
    if (!stored) throw new Error("Not logged in");
    const c = clientFor(session);
    await c.ensureDir(`${projectPath(session)}/${ASSETS_FOLDER}`);
    await this.setWebsiteMeta(session, DEFAULT_WEBSITE_ID, meta);
    await this.updateWebsite(session, DEFAULT_WEBSITE_ID, EMPTY_WEBSITE);
    return DEFAULT_WEBSITE_ID;
  }

  async readWebsite(session, websiteId) {
    assertWebsiteId(session, websiteId);
    const c = clientFor(session);
    try {
      const buf = await c.getFile(`${projectPath(session)}/${WEBSITE_DATA_FILE}`);
      return JSON.parse(buf.toString("utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return EMPTY_WEBSITE;
      throw err;
    }
  }

  async updateWebsite(session, websiteId, data) {
    assertWebsiteId(session, websiteId);
    const c = clientFor(session);
    const dir = projectPath(session);
    await c.ensureDir(dir);
    await c.putFile(
      `${dir}/${WEBSITE_DATA_FILE}`,
      Buffer.from(JSON.stringify(data), "utf8")
    );
  }

  async deleteWebsite(session, websiteId) {
    assertWebsiteId(session, websiteId);
    // We do NOT delete the artist's Nextcloud folder. Silex "delete website"
    // for a single-website-per-session connector is a no-op by policy.
    return;
  }

  async duplicateWebsite() {
    throw new Error("duplicateWebsite is not supported by NextcloudStorage");
  }

  async getWebsiteMeta(session, websiteId) {
    assertWebsiteId(session, websiteId);
    const meta = (await this._readMetaSafe(session, websiteId)) || {
      name: websiteId,
      connectorUserSettings: {},
    };
    return {
      websiteId,
      name: meta.name || websiteId,
      imageUrl: meta.imageUrl,
      connectorUserSettings: meta.connectorUserSettings || {},
      createdAt: meta.createdAt || new Date(),
      updatedAt: meta.updatedAt || new Date(),
    };
  }

  async setWebsiteMeta(session, websiteId, data) {
    assertWebsiteId(session, websiteId);
    const c = clientFor(session);
    const dir = projectPath(session);
    await c.ensureDir(dir);
    const payload = {
      name: data.name || websiteId,
      imageUrl: data.imageUrl,
      connectorUserSettings: data.connectorUserSettings || {},
      updatedAt: new Date().toISOString(),
    };
    await c.putFile(
      `${dir}/${WEBSITE_META_FILE}`,
      Buffer.from(JSON.stringify(payload), "utf8")
    );
  }

  async writeAssets(session, websiteId, files) {
    assertWebsiteId(session, websiteId);
    const c = clientFor(session);
    const base = `${projectPath(session)}/${ASSETS_FOLDER}`;
    await c.ensureDir(base);
    const written = [];
    for (const f of files) {
      const remote = `${base}/${f.path.replace(/^\/+/, "")}`;
      const content =
        typeof f.content === "string"
          ? Buffer.from(f.content, "utf8")
          : Buffer.isBuffer(f.content)
          ? f.content
          : Buffer.from(await streamToBuffer(f.content));
      await c.putFile(remote, content);
      written.push(f.path);
    }
    return written;
  }

  async readAsset(session, websiteId, fileName) {
    assertWebsiteId(session, websiteId);
    const c = clientFor(session);
    return c.getFile(`${projectPath(session)}/${ASSETS_FOLDER}/${fileName}`);
  }

  async deleteAssets(session, websiteId, fileNames) {
    assertWebsiteId(session, websiteId);
    const c = clientFor(session);
    for (const name of fileNames) {
      await c.deleteFile(
        `${projectPath(session)}/${ASSETS_FOLDER}/${name.replace(/^\/+/, "")}`
      );
    }
  }

  // ---------- Internal ----------

  async _readMetaSafe(session, websiteId) {
    const c = clientFor(session);
    if (!c) return null;
    try {
      const buf = await c.getFile(
        `${projectPath(session)}/${WEBSITE_META_FILE}`
      );
      return JSON.parse(buf.toString("utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return null;
      console.warn(
        `[silex-nextcloud-connector] meta read failed: ${err.message}`
      );
      return null;
    }
  }
}

async function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

module.exports = { NextcloudStorage };
