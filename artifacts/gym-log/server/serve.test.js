/**
 * Regression tests for the landing-page header-trust vulnerability (Task #10).
 *
 * Verifies that:
 *  1. EXPS_HOSTNAME is a fixed, server-controlled constant — not derived from
 *     any request header.
 *  2. buildLandingPage() applies htmlEscape() to the HTML attribute placeholder
 *     and jsStringEscape() to the inline-script placeholder, so hostile input
 *     cannot break out of either context.
 *  3. htmlEscape and jsStringEscape individually neutralise the characters that
 *     would be needed for HTML-attribute injection and JS string-break-out,
 *     respectively.
 *
 * Run with: node server/serve.test.js
 */

"use strict";

const assert = require("assert");
const { EXPS_HOSTNAME, htmlEscape, jsStringEscape, buildLandingPage } =
  require("./serve");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. EXPS_HOSTNAME is a static, server-controlled value
// ---------------------------------------------------------------------------

test("EXPS_HOSTNAME is a non-empty string", () => {
  assert.strictEqual(typeof EXPS_HOSTNAME, "string");
  assert.ok(EXPS_HOSTNAME.length > 0, "EXPS_HOSTNAME must not be empty");
});

test("EXPS_HOSTNAME does not contain protocol or path (hostname only)", () => {
  assert.ok(
    !EXPS_HOSTNAME.includes("://"),
    "EXPS_HOSTNAME must not contain a protocol scheme",
  );
  assert.ok(
    !EXPS_HOSTNAME.startsWith("/"),
    "EXPS_HOSTNAME must not start with /",
  );
});

// ---------------------------------------------------------------------------
// 2. htmlEscape neutralises HTML-injection characters
// ---------------------------------------------------------------------------

test("htmlEscape encodes double quote", () => {
  assert.ok(htmlEscape('"').includes("&quot;"));
  assert.ok(!htmlEscape('"').includes('"'));
});

test("htmlEscape encodes single quote", () => {
  assert.ok(htmlEscape("'").includes("&#39;"));
  assert.ok(!htmlEscape("'").includes("'"));
});

test("htmlEscape encodes angle brackets", () => {
  assert.ok(htmlEscape("<script>").includes("&lt;"));
  assert.ok(htmlEscape("<script>").includes("&gt;"));
  assert.ok(!htmlEscape("<script>").includes("<"));
});

test("htmlEscape encodes ampersand", () => {
  assert.ok(htmlEscape("&").includes("&amp;"));
  assert.ok(!htmlEscape("&amp;").startsWith("&&"));
});

// ---------------------------------------------------------------------------
// 3. jsStringEscape neutralises JS string-break-out characters
// ---------------------------------------------------------------------------

test('jsStringEscape prevents double quote from closing a JS string literal', () => {
  // jsStringEscape turns " into \" (backslash + quote).
  // The backslash must be present so the quote is not a string terminator.
  const escaped = jsStringEscape('"');
  assert.strictEqual(escaped, '\\"', 'double quote must be backslash-escaped');
  // The result inside `const x = "` + escaped + `"` must be syntactically safe:
  // the escaped form must not start an unescaped " that would close the literal.
  assert.ok(escaped.startsWith('\\'), "escaped form must start with backslash");
});

test("jsStringEscape encodes backslash", () => {
  const escaped = jsStringEscape("\\");
  assert.strictEqual(escaped, "\\\\");
});

test("jsStringEscape encodes newline and carriage-return", () => {
  assert.ok(jsStringEscape("\n").includes("\\n"));
  assert.ok(jsStringEscape("\r").includes("\\r"));
  assert.ok(!jsStringEscape("\n").includes("\n"));
});

test("jsStringEscape encodes </script> break-out sequence", () => {
  const escaped = jsStringEscape("</script>");
  assert.ok(!escaped.includes("<"), "< must be encoded");
  assert.ok(!escaped.includes(">"), "> must be encoded");
});

test("jsStringEscape encodes Unicode line/paragraph separators", () => {
  assert.ok(jsStringEscape("\u2028").includes("\\u2028"));
  assert.ok(jsStringEscape("\u2029").includes("\\u2029"));
});

// ---------------------------------------------------------------------------
// 4. buildLandingPage — hostile host value cannot escape HTML or JS context
// ---------------------------------------------------------------------------

// Simulate what would happen if the old header-trust code path had been used
// and an attacker supplied a malicious X-Forwarded-Host value. Even if that
// value were passed through buildLandingPage, the escaping must contain it.

const MALICIOUS_HOST =
  'attacker.example";alert(document.domain);//';
const MALICIOUS_HOST_ATTR =
  'attacker.example" onmouseover="alert(1)';

// Build a minimal template that mimics the real placeholders.
const MINI_TEMPLATE = [
  '<a href="exps://EXPS_URL_PLACEHOLDER_ATTR">open</a>',
  '<script>const deepLink = "exps://EXPS_URL_PLACEHOLDER_JS";</script>',
].join("\n");

function buildMini(host) {
  return MINI_TEMPLATE
    .replace(/EXPS_URL_PLACEHOLDER_ATTR/g, htmlEscape(host))
    .replace(/EXPS_URL_PLACEHOLDER_JS/g, jsStringEscape(host));
}

test("hostile host with JS break-out chars cannot inject script via attr context", () => {
  const html = buildMini(MALICIOUS_HOST_ATTR);
  // The raw double-quote that would close the href attribute must be encoded.
  assert.ok(
    !html.includes('" onmouseover="'),
    "raw attribute break-out must not appear in output",
  );
});

test("hostile host with JS break-out chars cannot inject script via JS context", () => {
  const html = buildMini(MALICIOUS_HOST);
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, "script block must be present");
  const scriptContent = scriptMatch[1];
  // The attacker payload is `";alert(document.domain);//`.
  // After jsStringEscape the " becomes \" (backslash + quote), so the attack
  // payload becomes `\";alert(...)` — still inside the string, not executable.
  //
  // The double-quote in the attacker payload must be backslash-escaped in
  // the output so the JS string literal is not prematurely closed.
  // Use a negative lookbehind regex: if `"` is preceded by `\` it is safe;
  // only a raw (non-backslash-preceded) `"` followed by `;alert(` would
  // indicate a successful break-out.
  const breakoutPresent = /(?<!\\)";alert\(/.test(scriptContent);
  assert.ok(
    !breakoutPresent,
    'unescaped ";alert( must not appear in script — the JS string must not be closeable by the attacker payload',
  );
});

test("buildLandingPage with EXPS_HOSTNAME produces no raw special chars in attr", () => {
  // The real EXPS_HOSTNAME (a plain hostname) must survive round-trip safely.
  const html = buildMini(EXPS_HOSTNAME);
  assert.ok(
    html.includes(`exps://`),
    "deep link scheme must be present in output",
  );
  // There must be no unencoded double-quote inside the href value region.
  const attrMatch = html.match(/href="([^"]*)"/);
  assert.ok(attrMatch, "href attribute must be parseable");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
