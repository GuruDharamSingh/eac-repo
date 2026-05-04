"use strict";

const { createWebdavClient } = require("./webdav");
const { getStored, clearStored } = require("./auth");

const DEFAULT_WEBSITE_ID = "default";
const PUBLISH_MANIFEST_FILENAME = ".eac-publish.json";
const USER_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='currentColor' d='M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Z'/%3E%3C/svg%3E";

function clientFor(session) {
  const stored = getStored(session);
  if (!stored) return null;
  return createWebdavClient({
    baseUrl: stored.ncBaseUrl,
    user: stored.ncUser,
    pass: stored.ncPass,
  });
}

function publishedPath(session) {
  const stored = getStored(session);
  if (!stored) throw new Error("Not logged in");
  return stored.publishedPath.replace(/\/+$/, "");
}

function assertWebsiteId(session, websiteId) {
  const stored = getStored(session);
  if (!stored) throw new Error("Not logged in");
  if (websiteId && websiteId !== stored.slug && websiteId !== DEFAULT_WEBSITE_ID) {
    throw new Error(
      `Website ${websiteId} not accessible in this Silex session (expected ${stored.slug})`
    );
  }
}

async function contentToBuffer(content) {
  if (typeof content === "string") return Buffer.from(content, "utf8");
  if (Buffer.isBuffer(content)) return content;
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (content && typeof content.on === "function") return streamToBuffer(content);
  if (content == null) return Buffer.alloc(0);
  return Buffer.from(String(content), "utf8");
}

function normalizeOutputPath(filePath) {
  return String(filePath || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
}

function isHtmlOutputPath(filePath) {
  return filePath.toLowerCase().endsWith(".html");
}

function chooseEntryPath(htmlFiles) {
  return (
    htmlFiles.find((filePath) => filePath.toLowerCase() === "front.html") ||
    htmlFiles.find((filePath) => filePath.toLowerCase() === "index.html") ||
    htmlFiles[0] ||
    null
  );
}

function buildPublishManifest(session, websiteId, files) {
  const stored = getStored(session) || {};
  const filePaths = files.map((file) => normalizeOutputPath(file.path)).filter(Boolean);
  const htmlFiles = filePaths.filter(isHtmlOutputPath);

  return {
    version: 1,
    connectorId: "nextcloud-hosting",
    websiteId: websiteId || DEFAULT_WEBSITE_ID,
    slug: stored.slug || null,
    orgId: stored.orgId || null,
    userId: stored.userId || null,
    publishedAt: new Date().toISOString(),
    entryPath: chooseEntryPath(htmlFiles),
    htmlFiles,
    files: filePaths,
  };
}

class NextcloudHosting {
  constructor(opts = {}) {
    this.connectorId = "nextcloud-hosting";
    this.connectorType = "HOSTING";
    this.displayName = opts.displayName || "Nextcloud publishing";
    this.icon = USER_ICON;
    this.color = "#ffffff";
    this.background = "#0f766e";
    this.disableLogout = false;
    this.options = opts;
  }

  getOptions() {
    return {};
  }

  async getOAuthUrl() {
    return null;
  }

  async getLoginForm(session) {
    if (getStored(session)) return null;
    return `<p>Open the editor from the arts-collective hub to start a Nextcloud session.</p>`;
  }

  async getSettingsForm() {
    return null;
  }

  async isLoggedIn(session) {
    return !!getStored(session);
  }

  async setToken() {
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
      hosting: {
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

  async publish(session, websiteId, files, { startJob, jobSuccess, jobError }) {
    assertWebsiteId(session, websiteId);
    const job = startJob(`Publishing to ${this.displayName}`);
    const c = clientFor(session);
    const base = publishedPath(session);

    try {
      await c.ensureDir(base);
      for (const file of files) {
        const outputPath = normalizeOutputPath(file.path);
        if (!outputPath) continue;
        const remote = `${base}/${outputPath}`;
        await c.putFile(remote, await contentToBuffer(file.content));
      }
      const manifest = buildPublishManifest(session, websiteId, files);
      await c.putFile(
        `${base}/${PUBLISH_MANIFEST_FILENAME}`,
        Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
      );
      jobSuccess(job.jobId, `Published ${files.length} files to Nextcloud`);
    } catch (err) {
      jobError(job.jobId, err instanceof Error ? err.message : String(err));
      throw err;
    }

    return job;
  }

  async getUrl(session) {
    const stored = getStored(session);
    if (!stored) throw new Error("Not logged in");
    const baseUrl = stored.ncBaseUrl.replace(/\/+$/, "");
    const dir = `/${publishedPath(session)}`;
    return `${baseUrl}/apps/files/files?dir=${encodeURIComponent(dir)}`;
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

module.exports = { NextcloudHosting };