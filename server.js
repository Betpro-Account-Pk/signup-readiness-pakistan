const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const REVIEW_MODE = true;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.posix.normalize(decoded);
  const relative = normalized.replace(/^\/+/, "");
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT)) return null;
  return file;
}

function candidateFiles(urlPath) {
  let raw = urlPath.split("?")[0];
  if (raw === "/") return [path.join(ROOT, "index.html")];
  const base = safeJoin(raw);
  if (!base) return [];
  const ext = path.extname(base);
  if (ext) return [base];
  return [
    base,
    path.join(base, "index.html"),
    base + ".html"
  ];
}

function headersFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const h = {
    "Content-Type": mime[ext] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  };

  if (REVIEW_MODE) {
    h["X-Robots-Tag"] = "noindex, follow";
  }

  if (ext === ".webp" || ext === ".svg" || ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
    h["Cache-Control"] = "public, max-age=31536000, immutable";
  } else if (ext === ".css") {
    h["Cache-Control"] = "public, max-age=3600, must-revalidate";
  } else {
    h["Cache-Control"] = "public, max-age=0, must-revalidate";
  }

  return h;
}

const server = http.createServer((req, res) => {
  const method = req.method || "GET";
  if (!["GET", "HEAD"].includes(method)) {
    res.writeHead(405, {"Content-Type": "text/plain; charset=utf-8", "Allow": "GET, HEAD"});
    return res.end("Method Not Allowed");
  }

  if (req.url.split("?")[0] === "/health") {
    res.writeHead(200, {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"});
    return res.end(method === "HEAD" ? undefined : "ok");
  }

  if (req.url.split("?")[0] === "/index.html" || req.url.split("?")[0] === "/home") {
    res.writeHead(301, {"Location": "/"});
    return res.end();
  }

  for (const candidate of candidateFiles(req.url)) {
    try {
      const stat = fs.statSync(candidate);
      if (!stat.isFile()) continue;
      const headers = headersFor(candidate);
      res.writeHead(200, headers);
      if (method === "HEAD") return res.end();
      return fs.createReadStream(candidate).pipe(res);
    } catch (_) {}
  }

  const notFound = path.join(ROOT, "404.html");
  const headers = headersFor(notFound);
  res.writeHead(404, headers);
  if (method === "HEAD") return res.end();
  return fs.createReadStream(notFound).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`W02 review server listening on ${PORT}`);
});
