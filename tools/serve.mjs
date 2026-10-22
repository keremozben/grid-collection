// Serves the site from the repo root like GitHub Pages does: /tr/ → tr/index.html,
// /support → support.html, unknown paths → 404.html with status 404.
// The pages use root-absolute URLs (/assets/…), so file:// doesn't work.
//
//   node tools/serve.mjs [port]        (default 8080)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".bin": "application/octet-stream",
};

/** @param {string} p */
async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/** Resolve a URL path to a file, GitHub Pages style. @param {string} urlPath */
async function find(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  if (rel.startsWith("..") || /(^|[/\\])(_|\.|node_modules)/.test(rel)) return null;
  const base = join(root, rel);
  for (const p of [base, join(base, "index.html"), `${base}.html`]) if (await isFile(p)) return p;
  return null;
}

/**
 * Start the server. @param {number} port
 * @returns {Promise<import("node:http").Server>}
 */
export function serve(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    let file = await find(url.pathname);
    let status = 200;
    if (!file) {
      file = join(root, "404.html");
      status = 404;
    }
    res.writeHead(status, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8080;
  await serve(port);
  console.log(`http://localhost:${port}/`);
}
