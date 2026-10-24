// Reads roster and member files in the browser: .xlsx .xls .csv (SheetJS), .docx (mammoth),
// .pdf (pdf.js), old .doc (best-effort text), images, and online sheets (Google Sheets link).
// Output: { tables: [{ name, rows: [[cell, ...], ...] }], text, note }
(() => {
"use strict";
const LIBS = {
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  mammoth: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
  pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
};
const loaded = {};
function load(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error("lib_failed")); }; document.head.appendChild(s); });
  return loaded[src];
}
const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const trimRows = (rows) => {
  rows = rows.map((r) => r.map(clean));
  rows = rows.filter((r) => r.some((c) => c));
  let w = 0; rows.forEach((r) => { for (let i = r.length - 1; i >= 0; i--) if (r[i]) { w = Math.max(w, i + 1); break; } });
  return rows.slice(0, 400).map((r) => { const o = r.slice(0, Math.min(w, 40)); while (o.length < Math.min(w, 40)) o.push(""); return o; });
};
const textOf = (tables) => tables.map((t) => t.rows.map((r) => r.join(" | ")).join("\n")).join("\n\n");

async function sheet(buf) {
  await load(LIBS.xlsx);
  // raw: true keeps CSV text as typed (so 03/04 stays day/month); real Excel date cells become YYYY-MM-DD.
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: true });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const cell = (v) => (v instanceof Date ? (isNaN(v) ? "" : iso(new Date(v.getTime() + 12 * 3600e3))) : v);
  const tables = wb.SheetNames.map((name) => ({ name, rows: trimRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" }).map((r) => r.map(cell))) })).filter((t) => t.rows.length);
  return { tables, text: textOf(tables) };
}

async function docx(buf) {
  await load(LIBS.mammoth);
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const doc = new DOMParser().parseFromString(value, "text/html");
  const tables = [...doc.querySelectorAll("table")].map((tb, i) => {
    const rows = [...tb.querySelectorAll("tr")].map((tr) => {
      const out = [];
      [...tr.children].forEach((td) => { out.push(td.textContent); for (let k = 1; k < (+td.getAttribute("colspan") || 1); k++) out.push(""); });
      return out;
    });
    return { name: "Table " + (i + 1), rows: trimRows(rows) };
  }).filter((t) => t.rows.length);
  doc.querySelectorAll("table").forEach((t) => t.remove());
  const paras = [...doc.querySelectorAll("p,h1,h2,h3,li")].map((p) => clean(p.textContent)).filter(Boolean);
  if (!tables.length && paras.length) tables.push({ name: "Text", rows: paras.slice(0, 400).map((p) => [p]) });
  return { tables, text: paras.join("\n") + "\n" + textOf(tables), heading: paras.slice(0, 3).join(" · ") };
}

async function pdf(buf) {
  await load(LIBS.pdf);
  pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const tables = [];
  for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
    const page = await doc.getPage(p);
    const items = (await page.getTextContent()).items.filter((it) => it.str && it.str.trim());
    // Group words into lines by their height on the page, then split a line into cells at wide gaps.
    const lines = [];
    items.forEach((it) => {
      const y = it.transform[5], x = it.transform[4], w = it.width || it.str.length * 4;
      let L = lines.find((l) => Math.abs(l.y - y) < 3);
      if (!L) { L = { y, items: [] }; lines.push(L); }
      L.items.push({ x, w, s: it.str });
    });
    lines.sort((a, b) => b.y - a.y);
    const rows = lines.map((l) => {
      l.items.sort((a, b) => a.x - b.x);
      const cells = []; let cur = null, end = -1e9;
      l.items.forEach((it) => {
        if (cur !== null && it.x - end < 12) cur += (it.x - end > 1.5 ? " " : "") + it.s;
        else { if (cur !== null) cells.push(cur); cur = it.s; }
        end = it.x + it.w;
      });
      if (cur !== null) cells.push(cur);
      return cells;
    });
    tables.push({ name: "Page " + p, rows: trimRows(rows) });
  }
  return { tables: tables.filter((t) => t.rows.length), text: textOf(tables), note: doc.numPages > 20 ? "pdf_long" : "" };
}

// Old Word 97-2003 files have no browser reader. Pull readable text runs out so names can still be found.
function doc(buf) {
  const u8 = new Uint8Array(buf); const runs = [];
  const push = (s) => { s = clean(s); if (s.length >= 3 && /[a-z]{2}/i.test(s)) runs.push(s); };
  let s = "";
  for (let i = 0; i + 1 < u8.length; i += 2) { const c = u8[i] | (u8[i + 1] << 8); if ((c >= 32 && c < 0x250) || c === 9) s += String.fromCharCode(c); else { if (c === 13 || c === 7) { push(s); s = ""; } else if (s.length) { push(s); s = ""; } } }
  push(s);
  let ascii = ""; const a = [];
  for (let i = 0; i < u8.length; i++) { const c = u8[i]; if (c >= 32 && c < 127) ascii += String.fromCharCode(c); else { if (ascii.length >= 4) a.push(ascii); ascii = ""; } }
  const pick = runs.join(" ").length > a.join(" ").length * 0.3 ? runs : a.map(clean).filter((x) => /[a-z]{3}/i.test(x));
  const lines = [...new Set(pick)].filter((x) => !/^(Microsoft|Normal|Times New Roman|Arial|Calibri|Default Paragraph|Table Normal|Root Entry|WordDocument|SummaryInformation)/.test(x)).slice(0, 400);
  return { tables: [{ name: "Text", rows: lines.map((l) => l.split(/\t+/)) }].map((t) => ({ ...t, rows: trimRows(t.rows) })), text: lines.join("\n"), note: "doc_old" };
}

async function file(f) {
  const name = f.name.toLowerCase(); const buf = await f.arrayBuffer();
  if (/\.(xlsx|xlsm|xls|csv|ods)$/.test(name)) return sheet(buf);
  if (/\.docx$/.test(name)) return docx(buf);
  if (/\.pdf$/.test(name)) return pdf(buf);
  if (/\.doc$/.test(name)) return doc(buf);
  if (/^image\//.test(f.type)) return { tables: [], text: "", note: "image" };
  throw new Error("unsupported");
}

// Online sheets: Google Sheets links shared "anyone with the link" can be read as CSV.
// OneDrive / SharePoint Excel links are kept as links (Microsoft needs a sign-in to read them).
async function link(url) {
  const g = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (g) {
    const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${g[1]}/export?format=csv${gid ? "&gid=" + gid : ""}`;
    try {
      const r = await fetch(csvUrl); if (!r.ok) throw 0;
      const buf = await r.arrayBuffer(); const out = await sheet(buf);
      out.tables.forEach((t) => (t.name = "Google Sheet")); return out;
    } catch { return { tables: [], text: "", note: "link_private" }; }
  }
  if (/\.(xlsx|xls|csv)(\?|$)/i.test(url)) {
    try { const r = await fetch(url); if (r.ok) return sheet(await r.arrayBuffer()); } catch {}
  }
  return { tables: [], text: "", note: "link_only" };
}

const toB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });

window.HKBP_PARSE = { file, link, sheet, toB64, load, LIBS };
})();
