// Tata Ibadah watcher, run by .github/workflows/tata-watch.yml every 15 minutes (or by hand: Actions → Tata Ibadah watch → Run workflow).
//  1. asks hkbp-tata whether the coming Sunday's file in the church Drive folder changed (content hash)
//  2. if so, loads the workbench page from this checkout in headless Chrome and lets it build the slides exactly as a maker's phone would
//  3. sends the HTML back to hkbp-tata, which publishes it in Sada, WhatsApps the file to the chairman and push-notifies the Multimedia makers
// Proof of identity: GitHub's signed job token (OIDC) in header x-github-token. The anon key below is the app's public key, not a secret.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// require (not import) so a globally installed Playwright is found too (NODE_PATH), e.g. on a computer that already has it
const { chromium } = createRequire(import.meta.url)("playwright");

const FN = process.env.HKBP_TATA_URL || "https://tbicfofdorwrupzlqgdm.supabase.co/functions/v1/hkbp-tata";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWNmb2Zkb3J3cnVwemxxZ2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3OTk4OTEsImV4cCI6MjEwODM3NTg5MX0.Wd9o5C6yv_1rtoM0Y1dDRXsRmoUU-gc9IprMUldZ2dI";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const WB = path.join(ROOT, "workbench");

async function githubToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL, tok = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !tok) throw new Error("no GitHub job token: the workflow needs permissions: id-token: write");
  const r = await fetch(`${url}&audience=hkbp-tata`, { headers: { authorization: "Bearer " + tok } });
  if (!r.ok) throw new Error("job token " + r.status);
  return (await r.json()).value;
}
let GH = "";
async function call(body, raw) {
  const r = await fetch(FN, { method: "POST", headers: { apikey: ANON, authorization: "Bearer " + ANON, "content-type": "application/json", "x-github-token": GH }, body: JSON.stringify(body) });
  if (raw) { if (!r.ok) throw new Error(`${body.op} ${r.status} ${await r.text()}`); return r; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${body.op} ${r.status} ${JSON.stringify(j)}`);
  return j;
}
// the workbench folder, served locally so the page runs with the same origin rules as on GitHub Pages
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[\/\\])+/, "");
      const f = path.join(WB, p === "/" || p === "\\" ? "index.html" : p);
      if (!f.startsWith(WB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
      // the page's access gate asks for a signed-in maker inside Sada; this job is the church's own server-side build, so the gate is cut out
      // of the copy served here (the published page keeps it)
      if (f.endsWith("index.html")) return res.end(fs.readFileSync(f, "utf8").replace(/<style id="wb-gate-css">[\s\S]*?<\/script>/, "<!-- gate removed for the watcher -->"));
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => resolve({ server: s, url: `http://127.0.0.1:${s.address().port}/index.html` }));
  });
}
async function render(bytes, name) {
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (e) => console.log("page error:", e.message));
    page.on("dialog", (d) => d.dismiss().catch(() => {}));
    // a computer where only Node can reach the internet (a proxy from the environment: run with NODE_USE_ENV_PROXY=1 TATA_FETCH_VIA_NODE=1):
    // the page's script and font downloads are fetched by Node and handed to Chrome. GitHub Actions does not need this.
    if (process.env.TATA_FETCH_VIA_NODE) await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async (route) => {
      try { const r = await fetch(route.request().url(), { headers: { "user-agent": "Mozilla/5.0" } }); route.fulfill({ status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/octet-stream" }, body: Buffer.from(await r.arrayBuffer()) }); }
      catch (e) { route.abort(); }
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => typeof parseServiceFile === "function" && typeof buildStandalone === "function" && typeof loadParsed === "function" && typeof JSZip !== "undefined", null, { timeout: 60000 });
    const b64 = Buffer.from(bytes).toString("base64");
    const out = await page.evaluate(async ({ b64, name }) => {
      const bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const file = new File([arr], name, { type: /\.pdf$/i.test(name) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const p = await parseServiceFile(file);
      p.transition = state.transition;
      loadParsed(p, name, false);
      await new Promise((r) => setTimeout(r, 500));
      return { html: buildStandalone(), count: deck.count, warnings: p.warnings || [], date: (state.meta && state.meta.date) || "" };
    }, { b64, name });
    return out;
  } finally { await browser.close(); server.close(); }
}

const t0 = Date.now();
// try it on a computer without GitHub: node tools/tata-watch/watch.mjs --local "Acara Ibadah.docx"  -> writes tata-local.html next to it
if (process.argv[2] === "--local") {
  const src = process.argv[3]; if (!src) throw new Error("give the .docx/.pdf path");
  const out = await render(fs.readFileSync(src), path.basename(src));
  const dest = path.join(path.dirname(src), "tata-local.html"); fs.writeFileSync(dest, out.html);
  console.log(`built ${out.count} slides${out.date ? " for " + out.date : ""} -> ${dest}${out.warnings.length ? "; warnings: " + out.warnings.join(" | ") : ""}`);
  process.exit(0);
}
GH = await githubToken();
const poll = await call({ op: "poll" });
console.log("poll:", JSON.stringify({ ...poll, hash: (poll.hash || "").slice(0, 12) }));
if (!poll.changed) { console.log("nothing new for", poll.sunday && poll.sunday.label); process.exit(0); }
const f = await call({ op: "file", id: poll.file.id }, true);
const bytes = new Uint8Array(await f.arrayBuffer());
console.log(`file: ${poll.file.name} (${bytes.length} bytes)`);
const out = await render(bytes, poll.file.name);
console.log(`built ${out.count} slides${out.date ? " for " + out.date : ""}, ${Math.round(out.html.length / 1024)} KB${out.warnings.length ? "; warnings: " + out.warnings.join(" | ") : ""}`);
if (!out.count || out.count < 2) throw new Error("the workbench made no slides from this file");
const pub = await call({ op: "publish", id: poll.file.id, hash: poll.hash, name: poll.file.name, sunday: poll.sunday, html: out.html });
console.log("published:", JSON.stringify(pub));
console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s`);
