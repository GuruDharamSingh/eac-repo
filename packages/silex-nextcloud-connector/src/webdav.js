"use strict";

/**
 * Minimal Nextcloud WebDAV client used by NextcloudStorage.
 *
 * We deliberately avoid pulling in npm dependencies because this package
 * runs inside the upstream silexlabs/silex Docker image, which has no
 * pnpm workspace context. Node 18+ ships `fetch` globally.
 */

function joinUrl(base, path) {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function basicAuthHeader(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function webdavRoot(baseUrl, user) {
  return joinUrl(baseUrl, `/remote.php/dav/files/${encodeURIComponent(user)}`);
}

function encodePath(p) {
  return p
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function createWebdavClient({ baseUrl, user, pass }) {
  if (!baseUrl) throw new Error("nextcloud baseUrl required");
  if (!user) throw new Error("nextcloud user required");
  if (!pass) throw new Error("nextcloud pass required");
  const root = webdavRoot(baseUrl, user);
  const auth = basicAuthHeader(user, pass);

  function url(remotePath) {
    return `${root}/${encodePath(remotePath)}`;
  }

  async function ensureDir(remotePath) {
    const parts = remotePath.split("/").filter(Boolean);
    let cur = "";
    for (const seg of parts) {
      cur = cur ? `${cur}/${seg}` : seg;
      const res = await fetch(url(cur), {
        method: "MKCOL",
        headers: { Authorization: auth },
      });
      // 201 created, 405 already exists — both fine.
      if (res.status !== 201 && res.status !== 405) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `MKCOL ${cur} failed: ${res.status} ${res.statusText} ${body}`
        );
      }
    }
  }

  async function putFile(remotePath, content) {
    const parent = remotePath.split("/").slice(0, -1).join("/");
    if (parent) await ensureDir(parent);
    const res = await fetch(url(remotePath), {
      method: "PUT",
      headers: { Authorization: auth },
      body: content,
    });
    if (res.status !== 201 && res.status !== 204) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `PUT ${remotePath} failed: ${res.status} ${res.statusText} ${body}`
      );
    }
  }

  async function getFile(remotePath) {
    const res = await fetch(url(remotePath), {
      method: "GET",
      headers: { Authorization: auth },
    });
    if (res.status === 404) {
      const err = new Error(`Not found: ${remotePath}`);
      err.code = "ENOENT";
      throw err;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `GET ${remotePath} failed: ${res.status} ${res.statusText} ${body}`
      );
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }

  async function deleteFile(remotePath) {
    const res = await fetch(url(remotePath), {
      method: "DELETE",
      headers: { Authorization: auth },
    });
    if (res.status !== 204 && res.status !== 200 && res.status !== 404) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `DELETE ${remotePath} failed: ${res.status} ${res.statusText} ${body}`
      );
    }
  }

  async function exists(remotePath) {
    const res = await fetch(url(remotePath), {
      method: "PROPFIND",
      headers: { Authorization: auth, Depth: "0" },
    });
    return res.status === 207 || res.status === 200;
  }

  async function list(remotePath) {
    const res = await fetch(url(remotePath), {
      method: "PROPFIND",
      headers: {
        Authorization: auth,
        Depth: "1",
        "Content-Type": "application/xml",
      },
    });
    if (res.status === 404) return [];
    if (res.status !== 207) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `PROPFIND ${remotePath} failed: ${res.status} ${res.statusText} ${body}`
      );
    }
    const xml = await res.text();
    const hrefs = [];
    const re = /<d:href>([^<]+)<\/d:href>/gi;
    let m;
    while ((m = re.exec(xml))) hrefs.push(decodeURIComponent(m[1]));
    const prefix = `/remote.php/dav/files/${user}/${remotePath}`.replace(
      /\/+$/,
      ""
    );
    return hrefs
      .map((h) => h.replace(/\/+$/, ""))
      .filter((h) => h !== prefix && h.startsWith(prefix + "/"))
      .map((h) => h.slice(prefix.length + 1));
  }

  return { ensureDir, putFile, getFile, deleteFile, exists, list, _root: root };
}

module.exports = { createWebdavClient };
