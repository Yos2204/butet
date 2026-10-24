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
const linesOf = (tables) => tables.flatMap((t) => t.rows.map((r) => r.filter(Boolean).join(" | ")).concat(""));
const textOf = (tables) => tables.map((t) => t.rows.map((r) => r.join(" | ")).join("\n")).join("\n\n");

async function sheet(buf) {
  await load(LIBS.xlsx);
  // raw: true keeps CSV text as typed (so 03/04 stays day/month); real Excel date cells become YYYY-MM-DD.
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: true });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const cell = (v) => (v instanceof Date ? (isNaN(v) ? "" : iso(new Date(v.getTime() + 12 * 3600e3))) : v);
  const tables = wb.SheetNames.map((name) => ({ name, rows: trimRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" }).map((r) => r.map(cell))) })).filter((t) => t.rows.length);
  return { tables, lines: linesOf(tables), text: textOf(tables) };
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
  // Text lines in reading order, with **bold** kept and list numbers written out.
  const lines = [];
  const md = (el) => { const c = el.cloneNode(true); c.querySelectorAll("strong,b").forEach((b) => { if (clean(b.textContent)) b.textContent = "**" + clean(b.textContent) + "**"; }); return clean(c.textContent).replace(/\*\*\s*\*\*/g, ""); };
  const walk = (node, depth) => {
    [...node.children].forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "table") { [...el.querySelectorAll("tr")].forEach((tr) => { const cells = [...tr.children].map((td) => clean(td.textContent)).filter(Boolean); if (cells.length) lines.push(cells.join(" | ")); }); return; }
      if (tag === "ol" || tag === "ul") {
        let n = 0;
        [...el.children].forEach((li) => {
          n++; const sub = [...li.querySelectorAll(":scope > ol, :scope > ul")]; sub.forEach((x) => x.remove());
          const mark = tag === "ol" ? (depth ? "abcdefghijklmnopqrstuvwxyz"[n - 1] || n : n) + ". " : "- ";
          const txt = md(li); if (txt) lines.push(mark + txt);
          sub.forEach((x) => walk({ children: [x] }, depth + 1));
        });
        return;
      }
      if (/^(p|h\d)$/.test(tag)) { const txt = md(el); lines.push(txt); return; }
      walk(el, depth);
    });
  };
  walk(doc.body, 0);
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const paras = lines.filter(Boolean);
  doc.querySelectorAll("table").forEach((t) => t.remove());
  if (!tables.length && paras.length) tables.push({ name: "Text", rows: paras.slice(0, 400).map((p) => [p.replace(/\*\*/g, "")]) });
  return { tables, lines, text: paras.join("\n").replace(/\*\*/g, ""), heading: paras.slice(0, 3).join(" · ").replace(/\*\*/g, "") };
}

async function pdf(buf) {
  await load(LIBS.pdf);
  pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const tables = []; const lines = [];
  for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
    const page = await doc.getPage(p); const pw = page.view[2] - page.view[0];
    const items = (await page.getTextContent()).items.filter((it) => it.str && it.str.trim());
    // Group words into lines by their height on the page, then split a line into cells at wide gaps.
    const rowsY = [];
    items.forEach((it) => {
      const y = it.transform[5], x = it.transform[4], w = it.width || it.str.length * 4;
      let L = rowsY.find((l) => Math.abs(l.y - y) < 3);
      if (!L) { L = { y, items: [] }; rowsY.push(L); }
      L.items.push({ x, w, s: it.str });
    });
    rowsY.sort((a, b) => b.y - a.y);
    const cellsAll = [];
    const rows = rowsY.map((l) => {
      l.items.sort((a, b) => a.x - b.x);
      const cells = []; let cur = null, end = -1e9, x0 = 0;
      l.items.forEach((it) => {
        if (cur !== null && it.x - end < 12) cur += (it.x - end > 1.5 ? " " : "") + it.s;
        else { if (cur !== null) { cells.push(cur); cellsAll.push({ x0, x1: end, y: l.y, s: cur }); } cur = it.s; x0 = it.x; }
        end = it.x + it.w;
      });
      if (cur !== null) { cells.push(cur); cellsAll.push({ x0, x1: end, y: l.y, s: cur }); }
      return cells;
    });
    tables.push({ name: "Page " + p, rows: trimRows(rows) });
    // Reading-order text: split the page into columns at empty vertical gutters, then read each column top to bottom.
    const cov = new Uint16Array(Math.ceil(pw) + 2);
    cellsAll.forEach((c) => { for (let x = Math.max(0, Math.floor(c.x0)); x < Math.min(cov.length, Math.ceil(c.x1)); x++) cov[x]++; });
    const cuts = []; let run = 0;
    for (let x = 0; x < cov.length; x++) { if (!cov[x]) run++; else { if (run >= 6 && x - run > 0) cuts.push(x - run / 2); run = 0; } }
    const colOf = (c) => cuts.filter((k) => c.x0 > k).length;
    const ncol = cuts.length + 1;
    for (let k = 0; k < ncol; k++) {
      const cs = cellsAll.filter((c) => colOf(c) === k).sort((a, b) => b.y - a.y || a.x0 - b.x0);
      if (!cs.length) continue;
      const left = Math.min(...cs.map((c) => c.x0)); let lastY = null;
      const out = [];
      cs.forEach((c) => {
        if (lastY !== null && Math.abs(lastY - c.y) < 3 && out.length) { out[out.length - 1].s += " " + clean(c.s); return; }
        if (lastY !== null && lastY - c.y > 16) out.push({ s: "" });
        out.push({ s: clean(c.s), x: c.x0 - left, end: c.x1 }); lastY = c.y;
      });
      const right = Math.max(...cs.map((c) => c.x1));
      // Re-join lines that were only wrapped by the page width.
      for (let i = 0; i < out.length; i++) {
        const o = out[i], prev = lines[lines.length - 1];
        const isItem = /^(\d{1,2}|[a-zA-Z])[.)]\s/.test(o.s);
        const p0 = out[i - 1]; const full = p0 && p0.end && p0.end > right - 18 && !/:$/.test(prev || "");
        if (i && prev && o.s && !isItem && prev.length > 40 && (full || (/[a-z,;\-–]$/.test(prev) && /^[a-z(]/.test(o.s)))) lines[lines.length - 1] = prev.replace(/-$/, "") + (/-$/.test(prev) ? "" : " ") + o.s;
        else lines.push(o.s);
      }
      lines.push("");
    }
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return { tables: tables.filter((t) => t.rows.length), lines, text: lines.join("\n"), note: doc.numPages > 20 ? "pdf_long" : "" };
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
  return { tables: [{ name: "Text", rows: lines.map((l) => l.split(/\t+/)) }].map((t) => ({ ...t, rows: trimRows(t.rows) })), lines, text: lines.join("\n"), note: "doc_old" };
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

// Online files. Google Sheets / Docs and Drive files shared "anyone with the link" can be read directly.
// Google Drive folders and OneDrive / SharePoint links need a sign-in, so they are kept as links.
async function link(url) {
  url = String(url || "").trim();
  const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error("http " + r.status); return r.arrayBuffer(); };
  const g = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (g) {
    try { const out = await sheet(await get(`https://docs.google.com/spreadsheets/d/${g[1]}/export?format=xlsx`)); if (out.tables.length) return out; } catch {}
    const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
    try {
      const out = await sheet(await get(`https://docs.google.com/spreadsheets/d/${g[1]}/export?format=csv${gid ? "&gid=" + gid : ""}`));
      out.tables.forEach((t) => (t.name = "Google Sheet")); return out;
    } catch { return { tables: [], lines: [], text: "", note: "link_private" }; }
  }
  const d = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
  if (d) { try { return await docx(await get(`https://docs.google.com/document/d/${d[1]}/export?format=docx`)); } catch { return { tables: [], lines: [], text: "", note: "link_private" }; } }
  if (/drive\.google\.com\/(drive\/)?(u\/\d+\/)?folders\//.test(url)) return { tables: [], lines: [], text: "", note: "link_folder" };
  const f = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]+)/);
  if (f) {
    try {
      const buf = await get(`https://drive.google.com/uc?export=download&id=${f[1]}`); const u8 = new Uint8Array(buf.slice(0, 8));
      if (u8[0] === 0x25 && u8[1] === 0x50) return pdf(buf);
      if (u8[0] === 0x50 && u8[1] === 0x4b) { try { const out = await sheet(buf); if (out.tables.length) return out; } catch {} return docx(buf); }
      if (u8[0] === 0xd0 && u8[1] === 0xcf) { try { const out = await sheet(buf); if (out.tables.length) return out; } catch {} return doc(buf); }
    } catch {}
    return { tables: [], lines: [], text: "", note: "link_private" };
  }
  if (/\.(xlsx|xls|csv)(\?|$)/i.test(url)) {
    try { return sheet(await get(url)); } catch {}
  }
  return { tables: [], lines: [], text: "", note: "link_only" };
}

const toB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });

window.HKBP_PARSE = { file, link, sheet, toB64, load, LIBS };
})();
