// Builds hkbp/nearest/churches.json: every HKBP church in the world that OpenStreetMap knows (free, no key).
// Run by .github/workflows/hkbp-churches.yml once a month; Sada's "Nearest HKBP" page reads the file
// and also searches OpenStreetMap live around the phone. Hand-added churches live in hkbp/nearest/extra.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "hkbp/nearest/churches.json", EXTRA = "hkbp/nearest/extra.json";
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const NAME = "HKBP|H\\\\.K\\\\.B\\\\.P|Huria Kristen Batak Protestan|Batak Christian Protestant";
const QUERY = `[out:json][timeout:900];
(
  nwr["amenity"="place_of_worship"]["name"~"${NAME}",i];
  nwr["amenity"="place_of_worship"]["official_name"~"${NAME}",i];
  nwr["amenity"="place_of_worship"]["operator"~"HKBP|Huria Kristen Batak Protestan",i];
  nwr["amenity"="place_of_worship"]["denomination"~"^(hkbp|batak_protestant|huria_kristen_batak_protestan)$",i];
  nwr["building"~"^(church|chapel)$"]["name"~"${NAME}",i];
);
out center tags;`;
// Not a church building: schools, hospitals, offices, houses.
const NOT_CHURCH = /\b(sekolah|school|sd|smp|sma|smk|tk|paud|universitas|university|rumah sakit|hospital|klinik|yayasan|kantor|office|pastori|parsonage|rumah dinas|asrama|toko|makam|kuburan|cemetery|parkir)\b/i;

async function overpass() {
  let last;
  for (const url of MIRRORS) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data: QUERY }), headers: { "User-Agent": "SadaHKBPS/1.0 (github.com/Yos2204/butet)" } });
        if (!r.ok) throw new Error(url + " " + r.status);
        const j = await r.json();
        if (!j.elements || !j.elements.length) throw new Error(url + " returned nothing");
        console.log(url, j.elements.length, "elements");
        return j.elements;
      } catch (e) { last = e; console.warn("retry:", e.message); await new Promise((s) => setTimeout(s, 20000)); }
    }
  }
  throw last;
}
const km = (a, b, c, d) => { const R = 6371, x = ((c - a) * Math.PI) / 180, y = ((d - b) * Math.PI) / 180; const h = Math.sin(x / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

const els = await overpass();
const rows = [];
for (const e of els) {
  const t = e.tags || {}; const lat = e.lat ?? (e.center && e.center.lat), lon = e.lon ?? (e.center && e.center.lon);
  if (lat == null || lon == null) continue;
  let name = clean(t.name || t.official_name || t["name:id"] || "HKBP");
  if (NOT_CHURCH.test(name) && !/gereja|church/i.test(name)) continue;
  if (!/hkbp|h\.k\.b\.p|batak/i.test(name)) name = "HKBP " + name;
  const place = clean(t["addr:city"] || t["addr:town"] || t["addr:village"] || t["addr:subdistrict"] || t["addr:district"] || t["addr:county"] || t["addr:regency"] || t["addr:province"] || t["addr:state"] || "");
  const street = clean([t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "));
  const phone = clean(t.phone || t["contact:phone"] || "");
  rows.push({ name, lat: +lat.toFixed(5), lon: +lon.toFixed(5), place, street, phone, pow: t.amenity === "place_of_worship" ? 1 : 0, cc: clean(t["addr:country"] || "") });
}
if (existsSync(EXTRA)) for (const x of JSON.parse(readFileSync(EXTRA, "utf8"))) rows.unshift({ ...x, pow: 2 });
// One church can be both a point and a building outline: keep one per name within 150 m (and any two within 25 m).
rows.sort((a, b) => b.pow - a.pow);
const keep = [];
for (const r of rows) {
  const dup = keep.find((k) => { const d = km(k.lat, k.lon, r.lat, r.lon); return d < 0.025 || (d < 0.15 && k.name.toLowerCase() === r.name.toLowerCase()); });
  if (dup) { for (const f of ["place", "street", "phone", "cc"]) if (!dup[f] && r[f]) dup[f] = r[f]; continue; }
  keep.push(r);
}
keep.sort((a, b) => a.lat - b.lat || a.lon - b.lon);
const out = { updated: new Date().toISOString().slice(0, 10), source: "© OpenStreetMap contributors (ODbL)", n: keep.length,
  c: keep.map((r) => [r.name, r.lat, r.lon, r.place, r.street, r.phone, r.cc].map((v) => v).filter((v, i, a) => i < 3 || a.slice(i).some(Boolean))) };
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
if (prev && keep.length < prev.n * 0.7) throw new Error(`Only ${keep.length} churches (was ${prev.n}); keeping the old list.`);
if (prev && JSON.stringify(prev.c) === JSON.stringify(out.c)) { console.log("No change,", keep.length, "churches."); process.exit(0); }
writeFileSync(OUT, JSON.stringify(out).replace(/\],\[/g, "],\n["));
console.log("Wrote", keep.length, "churches to", OUT);
