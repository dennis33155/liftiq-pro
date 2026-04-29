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

// =========================================================================
// SECURITY: Trusted production domain for the Pro app's landing page.
//
// This constant is the SOLE source of truth for the QR code, the
// "Open in Expo Go" deep link, and any other URL we render into the
// landing page. We never derive these values from request headers
// (X-Forwarded-Host / Host), so a spoofed forwarded header can no longer
// steer mobile visitors to an attacker's Expo manifest, and there is no
// untrusted input flowing into the HTML or inline JavaScript.
// =========================================================================
const BASE_URL = "https://gym-log-fast.replit.app";
// Hostname-only form ("gym-log-fast.replit.app") for the exps:// deep link.
const EXPS_HOSTNAME = BASE_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

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

// Escape for use inside an HTML text node or a double-quoted HTML attribute.
// Defense-in-depth: the values we substitute today are dev-controlled
// constants, but escaping ensures that even a future code path that pipes a
// less-trusted value through the same placeholder cannot break out.
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

// The rendered landing page is fully static (no per-request input), so we
// build it once at startup and serve the cached buffer on every request.
function buildLandingPage(template, appName) {
  return template
    .replace(/EXPS_URL_PLACEHOLDER_ATTR/g, htmlEscape(EXPS_HOSTNAME))
    .replace(/EXPS_URL_PLACEHOLDER_JS/g, jsStringEscape(EXPS_HOSTNAME))
    .replace(/APP_NAME_PLACEHOLDER/g, htmlEscape(appName));
}

function serveLandingPage(res, renderedHtml) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy":
      "default-src 'self'; script-src 'self' https://unpkg.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none';",
  });
  res.end(renderedHtml);
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
const renderedLandingPage = buildLandingPage(landingPageTemplate, appName);

const server = http.createServer((req, res) => {
  // Note: req.headers.host is used here ONLY to satisfy the URL parser's
  // requirement for a base. The parsed value is never reflected back into
  // any response body — only `pathname` is read out of `url`.
  let url;
  try {
    url = new URL(req.url || "/", "http://placeholder.invalid");
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
      return serveLandingPage(res, renderedLandingPage);
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
  BASE_URL,
  EXPS_HOSTNAME,
  htmlEscape,
  jsStringEscape,
  buildLandingPage,
};
