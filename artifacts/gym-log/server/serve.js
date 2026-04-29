/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

// Build a fixed allowlist of hosts that we will reflect into the landing
// page. Production deployments expose REPLIT_DOMAINS (comma-separated). When
// it is unset (local dev / standalone), we accept any well-formed hostname
// from the request because there is no upstream proxy to be lied to.
function getAllowedHosts() {
  const raw = process.env.REPLIT_DOMAINS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

const ALLOWED_HOSTS = getAllowedHosts();

// Strictly validates a "host[:port]" string. Hostnames are limited to the
// characters defined for DNS labels plus ".". Anything else (quotes, angle
// brackets, whitespace, control chars) is rejected outright so it can never
// reach the HTML/JS template even if a downstream sink forgets to escape.
const HOST_RE = /^[a-zA-Z0-9.-]{1,253}(:\d{1,5})?$/;

function isValidHost(value) {
  return typeof value === "string" && HOST_RE.test(value);
}

// Pick the request host to render in the landing page. Trusts X-Forwarded-Host
// only when (a) it is syntactically a valid hostname and (b) it appears in the
// allowlist (production). Falls back to the request Host header under the same
// rules. Returns null when nothing trustworthy is available.
function pickRequestHost(req) {
  const forwardedRaw = req.headers["x-forwarded-host"];
  const directRaw = req.headers["host"];

  // X-Forwarded-Host can be a comma-separated chain; the leftmost entry is
  // the original client-supplied value.
  const forwarded =
    typeof forwardedRaw === "string"
      ? forwardedRaw.split(",")[0].trim()
      : null;
  const direct = typeof directRaw === "string" ? directRaw.trim() : null;

  const candidates = [];
  if (forwarded) candidates.push(forwarded);
  if (direct) candidates.push(direct);

  for (const candidate of candidates) {
    if (!isValidHost(candidate)) continue;
    const lower = candidate.toLowerCase();
    const hostOnly = lower.split(":")[0];
    if (ALLOWED_HOSTS.size === 0) {
      // No allowlist configured (local dev): the format check above is the
      // only gate. We are not rendering executable content from this value
      // thanks to the per-context escaping below.
      return candidate;
    }
    if (ALLOWED_HOSTS.has(lower) || ALLOWED_HOSTS.has(hostOnly)) {
      return candidate;
    }
  }

  // Production with an allowlist but no header matched: fall back to the
  // first known good domain rather than letting an attacker steer the page.
  if (ALLOWED_HOSTS.size > 0) {
    return Array.from(ALLOWED_HOSTS)[0];
  }
  return null;
}

// Escape for use inside an HTML text node or a double-quoted HTML attribute.
function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape for use inside a double-quoted JavaScript string literal in an
// inline <script> block. Backslash, quotes, line terminators, and the angle
// brackets used by </script> are all neutralized.
function jsStringEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const host = pickRequestHost(req);
  if (!host) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  const html = landingPageTemplate
    .replace(/EXPS_URL_PLACEHOLDER_ATTR/g, htmlEscape(host))
    .replace(/EXPS_URL_PLACEHOLDER_JS/g, jsStringEscape(host))
    .replace(/APP_NAME_PLACEHOLDER/g, htmlEscape(appName));

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy":
      "default-src 'self'; script-src 'self' https://unpkg.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none';",
  });
  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url || "/", `http://${req.headers.host}`);
  } catch {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("Bad Request");
    return;
  }
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  serveStaticFile(pathname, res);
});

// Only start listening when invoked directly (`node serve.js`). When the
// module is imported (e.g. by tests) the helpers below are still exported,
// but the HTTP server stays dormant.
if (require.main === module) {
  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Serving static Expo build on port ${port}`);
  });
}

module.exports = {
  pickRequestHost,
  isValidHost,
  htmlEscape,
  jsStringEscape,
};
