const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const PUBLIC_EXACT = new Set([
  "/", "/about/", "/editorial-policy/", "/privacy/",
  "/responsible-use/", "/contact/", "/robots.txt",
  "/sitemap.xml", "/favicon.svg", "/site.webmanifest"
]);

function normalizedPath(url) {
  try {
    const raw = decodeURIComponent(url.split("?")[0]);
    const p = path.posix.normalize(raw);
    return p.startsWith("/") ? p : "/" + p;
  } catch (_) {
    return null;
  }
}

function isPublicPath(p) {
  if (!p) return false;
  if (PUBLIC_EXACT.has(p)) return true;
  return p.startsWith("/assets/") && /\.(css|webp|svg)$/i.test(p);
}

function fileForPublicPath(p) {
  if (p === "/") return path.join(ROOT, "index.html");
  if (p === "/about/") return path.join(ROOT, "about", "index.html");
  if (p === "/editorial-policy/") return path.join(ROOT, "editorial-policy", "index.html");
  if (p === "/privacy/") return path.join(ROOT, "privacy", "index.html");
  if (p === "/responsible-use/") return path.join(ROOT, "responsible-use", "index.html");
  if (p === "/contact/") return path.join(ROOT, "contact", "index.html");
  return path.join(ROOT, p.replace(/^\/+/, ""));
}

function headersFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": mime[ext] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };
  if (/\.(webp|svg)$/i.test(filePath)) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  } else if (ext === ".css") {
    headers["Cache-Control"] = "public, max-age=3600, must-revalidate";
  } else {
    headers["Cache-Control"] = "public, max-age=0, must-revalidate";
  }
  return headers;
}

const server = http.createServer((req, res) => {
  const method = req.method || "GET";
  if (!["GET", "HEAD"].includes(method)) {
    res.writeHead(405, {"Content-Type": "text/plain; charset=utf-8", "Allow": "GET, HEAD"});
    return res.end("Method Not Allowed");
  }

  const p = normalizedPath(req.url);

  if (p === "/health") {
    res.writeHead(200, {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"});
    return res.end(method === "HEAD" ? undefined : "ok");
  }

  if (p === "/index.html" || p === "/home") {
    res.writeHead(301, {"Location": "/"});
    return res.end();
  }

  if (!isPublicPath(p)) {
    const notFound = path.join(ROOT, "404.html");
    res.writeHead(404, headersFor(notFound));
    if (method === "HEAD") return res.end();
    return fs.createReadStream(notFound).pipe(res);
  }

  const file = fileForPublicPath(p);
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error("not-file");
    res.writeHead(200, headersFor(file));
    if (method === "HEAD") return res.end();
    return fs.createReadStream(file).pipe(res);
  } catch (_) {
    const notFound = path.join(ROOT, "404.html");
    res.writeHead(404, headersFor(notFound));
    if (method === "HEAD") return res.end();
    return fs.createReadStream(notFound).pipe(res);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`W02 production server listening on ${PORT}`);
});
