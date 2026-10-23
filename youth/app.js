// Gugah! — live youth sermon games. One file runs three roles:
//   planner (home + editor), stage (teacher's projector, hosts the room), player (each youth's phone).
// Phones talk to the stage directly over WebRTC (PeerJS); there is no server of our own.
"use strict";

// ---------- small helpers ----------
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem("gugah." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("gugah." + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("gugah." + k); } catch {} },
};
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const uid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
const clean = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const cleanML = (s, n) => String(s ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const copy = (o) => JSON.parse(JSON.stringify(o));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function toast(msg) { const el = h("div", { class: "toast", role: "status" }, msg); document.body.append(el); setTimeout(() => el.remove(), 2600); }
function download(name, text, type = "text/plain") {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function nextSunday() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return d.toISOString().slice(0, 10); }

// ---------- language ----------
let lang = store.get("lang", /^id|^ms/.test(navigator.language || "") ? "id" : "en");
function t(k, v) {
  const d = window.I18N;
  let s = (d[lang] && d[lang][k]) ?? (lang === "bt" ? d.id[k] : undefined) ?? d.en[k] ?? k;
  if (v) s = s.replace(/\{(\w+)\}/g, (_, n) => v[n] ?? "");
  return s;
}
function setLang(c) { lang = c; store.set("lang", c); document.documentElement.lang = c === "bt" ? "bbc" : c; }
setLang(lang);
function langSwitch(redraw) {
  return h("div", { class: "langs", role: "group", "aria-label": "Language" },
    [["en", "EN"], ["id", "ID"], ["bt", "Batak"]].map(([c, l]) =>
      h("button", { type: "button", "aria-pressed": String(lang === c), onclick: () => { setLang(c); redraw(); } }, l)));
}

// ---------- constants ----------
const PEER_PREFIX = "gugah-hkbp-yth-";
const BASE_URL = location.origin + location.pathname.replace(/[^/]*$/, "");
const SHORT_URL = BASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const newCode = () => Array.from({ length: 4 }, () => pick(CODE_CHARS)).join("");
const TEAMS = [
  { n: "Toba", c: "#2f7ff0", e: "🌊" }, { n: "Samosir", c: "#23a35a", e: "🌴" },
  { n: "Sipiso-piso", c: "#e8a60c", e: "💧" }, { n: "Pusuk Buhit", c: "#9b4dea", e: "⛰️" },
];
const SHAPES = ["▲", "◆", "●", "■"];
const QCOL = ["#e5384f", "#2f7ff0", "#e8a60c", "#23a35a", "#9b4dea", "#e0609a"];
const AVATARS = ["🐟", "🦁", "🐼", "🦊", "🐸", "🐯", "🐨", "🐙", "🦄", "🐧", "🐢", "🦉", "🐝", "🐬", "🦖", "🐱"];
const REACTS = ["🔥", "😂", "🙏", "👏", "😮", "❤️"];
const NOTE_COLORS = ["#ffd23f", "#ff9fb2", "#9fe8ff", "#b8f5a0", "#ffc48a", "#d9b8ff"];
const NICK_A = ["Arsik", "Ombus-ombus", "Lappet", "Mie Gomak", "Natinombur", "Dali", "Itak Gurgur", "Kacang Sihobuk", "Andaliman", "Sasagun", "Tipa-tipa", "Pohul-pohul"];
const NICK_B = ["Ngantuk", "Semangat", "Misterius", "Ceria", "Gesit", "Bijak", "Pemberani", "Kalem", "Ajaib", "Lincah"];
const randomNick = () => pick(NICK_A) + " " + pick(NICK_B);
const TYPES = {
  slide: "📖", poll: "📊", quiz: "⚡", words: "☁️", scale: "🎚️", open: "💬",
  verse: "🧩", tap: "👆", qa: "🙋", prayer: "🙏", board: "🏆",
};
const tn = (type) => t("type_" + type);
function actLabel(a) { return a.q || a.title || a.ref || tn(a.type); }
function chunkVerse(text) {
  const w = String(text || "").split(/\s+/).filter(Boolean);
  const size = Math.max(1, Math.ceil(w.length / 12));
  const out = []; for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(" "));
  return out;
}

// ---------- sounds + effects (stage) ----------
let actx = null;
function beep(f = 660, d = 0.12, type = "sine", vol = 0.15, when = 0) {
  if (S && S.mute) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + when;
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + d + 0.02);
  } catch {}
}
const sfx = {
  join: () => { beep(880, 0.08); beep(1320, 0.1, "sine", 0.12, 0.08); },
  tick: () => beep(520, 0.05, "square", 0.05),
  reveal: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.3, "triangle", 0.14, i * 0.09)),
  go: () => { beep(392, 0.15, "square", 0.08); beep(784, 0.35, "square", 0.08, 0.15); },
  win: () => [523, 659, 784, 659, 784, 1046].forEach((f, i) => beep(f, 0.22, "triangle", 0.14, i * 0.12)),
};
function confetti() {
  const cv = $("#confetti"); if (!cv) return;
  const ctx = cv.getContext("2d"); const W = (cv.width = cv.clientWidth), H = (cv.height = cv.clientHeight);
  const parts = Array.from({ length: 160 }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 16 - 4, s: 6 + Math.random() * 8, c: pick(QCOL.concat(["#ffd23f", "#fff"])), r: Math.random() * 6 }));
  const end = performance.now() + 3000;
  (function frame(now) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) { p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += 0.15; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    if (now < end) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(performance.now());
}
// ---------- Jarvis, the talking quiz host on the big screen ----------
// Uses the same voice as the Jarvis app when it was set up on this device (same website, same storage).
const JV = { voices: [], q: [], last: 0, joins: [], joinT: 0 };
function jvLoad() { try { JV.voices = speechSynthesis.getVoices(); } catch {} }
if (window.speechSynthesis) { jvLoad(); try { speechSynthesis.addEventListener("voiceschanged", jvLoad); } catch {} }
function jvLangOf(text) {
  const w = String(text).toLowerCase().match(/[a-z]+/g) || [];
  const ID = /^(yang|dan|di|ke|dari|tidak|kamu|kalian|ini|itu|dengan|untuk|apa|siapa|bagaimana|kenapa|mengapa|tim|menang|selamat|ayo|jawaban|benar|semua|pertanyaan|waktu|habis|horas|ho|hamu|ahu|do|na|ni|ma|tu|dang|ndang|boasa|aha|ise|naposo|tuhan|yesus|allah|debata|kita|kami|bisa|akan|sudah|juga|siap|mulai|lagi)$/;
  const EN = /^(the|and|you|your|is|are|what|who|how|why|of|to|team|wins|everyone|question|time|answer|right|ready|go|welcome|in|on|with|we|it|this|that|a|an)$/;
  let i = 0, e = 0; for (const x of w) { if (ID.test(x)) i++; if (EN.test(x)) e++; }
  return i === e ? (lang === "en" ? "en" : "id") : i > e ? "id" : "en";
}
function jvVoice(isId) {
  let pref = {}; try { pref = JSON.parse(localStorage.getItem("butet.settings") || "{}"); } catch {}
  const want = isId ? pref.idVoice : pref.voice;
  let v = JV.voices.find((x) => x.name === want);
  if (!v) {
    const list = JV.voices.filter((x) => x.lang.toLowerCase().replace("_", "-").startsWith(isId ? "id" : "en"));
    // closest to the film's Jarvis: a calm British male voice
    const prefs = isId ? [/google/i, /damayanti/i, /ardi/i] : [/daniel/i, /uk english male/i, /en-gb-x-rjs/i, /en-gb-x-gbd/i, /arthur/i, /oliver/i, /george/i, /malcolm/i, /en[-_]GB/i];
    for (const p of prefs) { v = list.find((x) => p.test(x.name) || p.test(x.lang)); if (v) break; }
    v = v || list[0];
  }
  return { v, rate: pref.rate || 1.05, pitch: isId ? 1 : (pref.pitch || 0.85) };
}
function jvSay(text, interrupt) {
  if (!S || !S.jarvis || S.mute || !window.speechSynthesis || $("#stage").hidden) return;
  text = String(text || "").replace(/[_*#>~`]/g, "").replace(/\s+/g, " ").trim(); if (!text) return;
  if (interrupt) { try { speechSynthesis.cancel(); } catch {} JV.q = []; }
  const isId = jvLangOf(text) === "id", { v, rate, pitch } = jvVoice(isId);
  const u = new SpeechSynthesisUtterance(text);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = isId ? "id-ID" : "en-GB";
  u.rate = rate; u.pitch = pitch;
  const orb = () => $("#sJv");
  u.onstart = () => { const o = orb(); if (o) o.classList.add("talk"); };
  u.onend = u.onerror = () => { JV.q = JV.q.filter((x) => x !== u); const o = orb(); if (o && !JV.q.length) o.classList.remove("talk"); };
  JV.q.push(u); // keep a reference: some phones drop the end event otherwise
  try { speechSynthesis.speak(u); } catch {}
}
function jvWelcome(name) {
  // greet newcomers by nickname, but bundle a crowd arriving at once
  JV.joins.push(name); clearTimeout(JV.joinT);
  JV.joinT = setTimeout(() => { const n = JV.joins; JV.joins = []; jvSay(n.length <= 2 ? t("jv_hi", { n: n.join(" & ") }) : t("jv_hi_many", { n: n.length })); }, 1200);
}
function jvIntro(a, r) {
  if (!S || !S.jarvis) return;
  const n = S.kit.acts.filter((x, i) => x.type === "quiz" && i <= S.idx).length;
  if (!a) { jvSay(t("jv_welcome"), true); return; }
  switch (a.type) {
    case "quiz": if (r.phase === "ready") jvSay(t("jv_quiz", { n }) + " " + a.q, true); break;
    case "poll": case "words": case "scale": case "open": if (r.phase === "open") jvSay(a.q, true); break;
    case "verse": if (r.phase === "ready") jvSay(t("jv_verse", { r: a.ref || "" }), true); break;
    case "tap": if (r.phase === "ready") jvSay(t("jv_tap"), true); break;
    case "qa": jvSay(t("jv_qa"), true); break;
    case "prayer": jvSay(a.q + " " + t("jv_prayer"), true); break;
    case "board": { const tot = teamTotals(), w = tot.indexOf(Math.max(...tot)), top = ranked()[0]; if (top) jvSay(t("jv_board", { t: TEAMS[w].n, p: top[1].name }), true); break; }
    default: try { speechSynthesis.cancel(); } catch {}
  }
}
async function jvAnswer(q) {
  // Teacher-triggered: Jarvis drafts a short, gentle answer to an anonymous question and reads it out.
  const key = getKey();
  if (!key) { toast(t("jv_need_key")); return; }
  q.jv = "…"; stageUpdate();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 600,
        system: "You are Jarvis, a warm, witty assistant helping a youth teacher at an HKBP (Batak Lutheran) church in Singapore. Teenagers asked this question anonymously during the youth sermon" + (S.kit.verse ? " on " + S.kit.verse : "") + " (theme: " + S.kit.title + "). Answer in the same language as the question, in at most 3 short sentences that a 15-year-old understands, rooted in the Bible and kind. Never shame anyone. If the question is about something serious (abuse, self-harm, crisis), gently say they can talk privately with the teacher or a trusted adult. Plain text only.",
        messages: [{ role: "user", content: q.text }] }) });
    const j = await res.json();
    if (!res.ok) throw new Error((j.error && j.error.message) || res.status);
    q.jv = clean((j.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" "), 700);
    saveLive(); stageUpdate(); jvSay(q.jv, true);
  } catch (e) { q.jv = ""; stageUpdate(); toast(t("ai_failed") + " " + (e.message || "")); }
}
function makeQR(el, text) {
  el.replaceChildren();
  if (!window.QRCode) { el.append(h("div", { style: "color:#000;font-size:12px;padding:6px" }, text)); return; }
  try { new QRCode(el, { text, width: 512, height: 512, colorDark: "#140c10", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M }); } catch {}
}
let wakeLock = null;
async function keepAwake() { try { if (navigator.wakeLock && document.visibilityState === "visible") wakeLock = await navigator.wakeLock.request("screen"); } catch {} }

// ---------- modal ----------
function modal(title, body, opts = {}) {
  const wrap = h("div", { class: "modal" });
  const close = () => { wrap.remove(); opts.onClose && opts.onClose(); };
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  wrap.append(h("div", { class: "sheet" + (opts.dark ? " dark" : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
    h("h3", null, title, h("button", { class: "x", type: "button", "aria-label": t("close"), onclick: close }, "✕")), body));
  $("#modalRoot").append(wrap);
  const f = wrap.querySelector("input:not([type=radio]):not([type=checkbox]),textarea"); if (f && !opts.noFocus) setTimeout(() => f.focus(), 50);
  return close;
}
const modalOpen = () => $("#modalRoot").children.length > 0;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modalOpen()) { const x = $("#modalRoot").lastChild.querySelector(".x"); x && x.click(); } });

function show(id) { for (const v of ["home", "editor", "stage", "player"]) $("#" + v).hidden = v !== id; window.scrollTo(0, 0); }

// =====================================================================
// PLANNER
// =====================================================================
let kits = store.get("kits", []);
const saveKits = () => store.set("kits", kits);
function newKit() { return { id: uid(), title: t("new_title"), verse: "", date: nextSunday(), acts: [] }; }
function sanitizeKit(k) {
  const out = { id: uid(), title: clean(k.title, 90) || t("new_title"), verse: clean(k.verse, 120), date: clean(k.date, 10) || nextSunday(), acts: [] };
  for (const a of Array.isArray(k.acts) ? k.acts.slice(0, 60) : []) {
    if (!a || !TYPES[a.type]) continue;
    const b = { type: a.type };
    for (const f of ["q", "title", "left", "right", "ref"]) if (a[f] != null) b[f] = clean(a[f], f === "q" ? 200 : 120);
    if (a.text != null) b.text = cleanML(a.text, 900);
    if (Array.isArray(a.options)) b.options = a.options.map((o) => clean(o, 80)).filter(Boolean).slice(0, a.type === "quiz" ? 4 : 6);
    if (a.type === "quiz") { b.correct = Math.max(0, Math.min((b.options || []).length - 1, a.correct | 0)); b.time = [10, 20, 30, 45, 60].includes(+a.time) ? +a.time : 20; }
    if ((a.type === "poll" || a.type === "quiz") && (!b.options || b.options.length < 2)) continue;
    if (a.type === "verse" && !b.text) continue;
    out.acts.push(b);
  }
  return out;
}

function renderHome() {
  show("home");
  const root = $("#home"); root.replaceChildren();
  const live = store.get("live", null);
  const canResume = live && live.kit && Date.now() - (live.at || 0) < 10 * 3600e3;
  const codeIn = h("input", { type: "text", maxlength: 6, placeholder: "ABCD", "aria-label": t("join_code"), autocomplete: "off", autocapitalize: "characters" });
  const goJoin = () => { const c = codeIn.value.toUpperCase().replace(/[^A-Z]/g, ""); if (c.length >= 4) location.href = BASE_URL + "?j=" + c; else codeIn.focus(); };
  codeIn.addEventListener("keydown", (e) => { if (e.key === "Enter") goJoin(); });
  root.append(h("div", { class: "ulos" }), h("div", { class: "wrap" },
    h("div", { class: "top" },
      h("div", { class: "logo" }, h("img", { src: "icon.svg", alt: "" }), h("div", null, "Gugah!", h("small", null, t("tagline")))),
      h("div", { class: "sp" }), langSwitch(renderHome)),
    canResume ? h("div", { class: "card", style: "border:2px solid var(--accent);margin-bottom:16px" },
      h("p", null, h("b", null, t("resume_title")), " — ", live.kit.title, " · ", t("code"), " ", h("b", null, live.code)),
      h("div", { class: "row" },
        h("button", { class: "btn pri", type: "button", onclick: () => startStage(live.kit, live) }, "▶ " + t("resume")),
        h("button", { class: "btn ghost", type: "button", onclick: () => { downloadSummary(live); } }, "⬇ " + t("download_results")),
        h("button", { class: "btn ghost", type: "button", onclick: () => { store.del("live"); renderHome(); } }, t("end_session")))) : null,
    h("div", { class: "grid2" },
      h("div", { class: "card" },
        h("div", { class: "row" }, h("h2", null, t("my_sessions")), h("div", { class: "sp" }),
          h("button", { class: "btn pri", type: "button", onclick: () => openEditor(newKit()) }, "＋ " + t("new_session"))),
        kits.length ? h("div", { class: "kits" }, kits.map(kitRow)) : h("div", { class: "empty" }, t("no_sessions")),
        h("div", { class: "row" },
          h("button", { class: "btn", type: "button", onclick: openTemplates }, "✨ " + t("templates")),
          h("button", { class: "btn", type: "button", onclick: () => openAI(null) }, "🤖 " + t("ai_make")),
          h("button", { class: "btn", type: "button", onclick: openImport }, "📥 " + t("import")))),
      h("div", { class: "col", style: "display:flex;flex-direction:column;gap:16px" },
        h("div", { class: "card join-card" }, h("h2", null, "📱 " + t("join_title")), h("p", { class: "small dim" }, t("join_hint")),
          h("div", { class: "codein" }, codeIn, h("button", { class: "btn pri", type: "button", onclick: goJoin }, t("join_go")))),
        h("div", { class: "card" }, h("h2", null, "🗓️ " + t("guide_title")), h("p", { class: "small dim" }, t("guide_teaser")),
          h("button", { class: "btn", type: "button", onclick: openGuide }, t("guide_open"))))),
  ));
}
function kitRow(k) {
  return h("div", { class: "kit" },
    h("div", { class: "kt" }, h("b", null, k.title), h("span", { class: "small dim" }, [k.date, k.verse].filter(Boolean).join(" · ")),
      h("div", { class: "icons", "aria-label": t("n_acts", { n: k.acts.length }) }, k.acts.map((a) => TYPES[a.type]).join(""))),
    h("div", { class: "row" },
      h("button", { class: "btn pri sm", type: "button", onclick: () => startStage(k) }, "▶ " + t("present")),
      h("button", { class: "btn sm", type: "button", onclick: () => openEditor(k) }, "✎ " + t("edit")),
      h("button", { class: "btn sm", type: "button", onclick: () => shareKit(k) }, "🔗 " + t("share")),
      h("button", { class: "btn sm ghost", type: "button", "aria-label": t("duplicate"), title: t("duplicate"), onclick: () => { const c = copy(k); c.id = uid(); c.title += " (2)"; kits.unshift(c); saveKits(); renderHome(); } }, "⧉"),
      h("button", { class: "btn sm ghost", type: "button", "aria-label": t("delete"), title: t("delete"), onclick: () => confirmBox(t("delete_q", { t: k.title }), () => { kits = kits.filter((x) => x.id !== k.id); saveKits(); renderHome(); }) }, "🗑")));
}
function confirmBox(msg, yes) {
  const close = modal(t("are_you_sure"), h("div", { style: "display:flex;flex-direction:column;gap:12px" }, h("p", null, msg),
    h("div", { class: "row" }, h("button", { class: "btn pri", type: "button", onclick: () => { close(); yes(); } }, t("yes")), h("button", { class: "btn", type: "button", onclick: () => close() }, t("cancel")))));
}

// ---------- editor ----------
let ed = null;
function openEditor(kit) { ed = copy(kit); if (!kits.some((k) => k.id === ed.id)) saveEd(); renderEditor(); }
function saveEd() { const i = kits.findIndex((k) => k.id === ed.id); ed.updated = Date.now(); if (i < 0) kits.unshift(copy(ed)); else kits[i] = copy(ed); saveKits(); }
function renderEditor() {
  show("editor");
  const root = $("#editor"); root.replaceChildren();
  const field = (label, key, attrs = {}) => h("label", { class: "f" }, label,
    h("input", Object.assign({ type: "text", value: ed[key] || "", oninput: (e) => { ed[key] = e.target.value; saveEd(); } }, attrs)));
  const list = h("div", { class: "acts" }, ed.acts.length ? ed.acts.map((a, i) => h("div", { class: "act" },
    h("span", { class: "ic", "aria-hidden": "true" }, TYPES[a.type]),
    h("div", { class: "tx" }, h("b", null, tn(a.type)), h("span", null, actLabel(a))),
    h("div", { class: "ab" },
      h("button", { type: "button", "aria-label": t("move_up"), title: t("move_up"), disabled: i === 0, onclick: () => { [ed.acts[i - 1], ed.acts[i]] = [ed.acts[i], ed.acts[i - 1]]; saveEd(); renderEditor(); } }, "↑"),
      h("button", { type: "button", "aria-label": t("move_down"), title: t("move_down"), disabled: i === ed.acts.length - 1, onclick: () => { [ed.acts[i + 1], ed.acts[i]] = [ed.acts[i], ed.acts[i + 1]]; saveEd(); renderEditor(); } }, "↓"),
      a.type !== "board" ? h("button", { type: "button", "aria-label": t("edit"), title: t("edit"), onclick: () => editAct(a, (b) => { ed.acts[i] = b; saveEd(); renderEditor(); }) }, "✎") : null,
      h("button", { type: "button", "aria-label": t("delete"), title: t("delete"), onclick: () => { ed.acts.splice(i, 1); saveEd(); renderEditor(); } }, "✕")))) : h("div", { class: "empty" }, t("no_acts")));
  const adders = h("div", { class: "addgrid" }, Object.keys(TYPES).map((type) => h("button", { type: "button", onclick: () => {
    const a = defaultAct(type);
    if (type === "board") { ed.acts.push(a); saveEd(); renderEditor(); return; }
    editAct(a, (b) => { ed.acts.push(b); saveEd(); renderEditor(); });
  } }, h("span", { class: "ic", "aria-hidden": "true" }, TYPES[type]), h("b", null, tn(type)), h("small", null, t("type_" + type + "_d")))));
  root.append(h("div", { class: "ulos" }), h("div", { class: "wrap" },
    h("div", { class: "top" },
      h("button", { class: "btn ghost", type: "button", onclick: renderHome }, "← " + t("back")),
      h("div", { class: "sp" }),
      h("button", { class: "btn", type: "button", onclick: () => openAI(ed) }, "🤖 " + t("ai_fill")),
      h("button", { class: "btn", type: "button", onclick: () => shareKit(ed) }, "🔗 " + t("share")),
      h("button", { class: "btn pri", type: "button", disabled: !ed.acts.length, onclick: () => startStage(ed) }, "▶ " + t("present"))),
    h("div", { class: "card", style: "margin-bottom:16px" },
      field(t("f_title"), "title", { maxlength: 90 }),
      h("div", { class: "row", style: "align-items:stretch" },
        h("div", { style: "flex:2;min-width:200px" }, field(t("f_verse"), "verse", { maxlength: 120, placeholder: "Lukas 15:11-32" })),
        h("div", { style: "flex:1;min-width:150px" }, field(t("f_date"), "date", { type: "date" })))),
    h("div", { class: "grid2" },
      h("div", { class: "card" }, h("h2", null, t("flow")), h("p", { class: "small dim" }, t("flow_hint")), list),
      h("div", { class: "card" }, h("h2", null, t("add")), adders))));
}
function defaultAct(type) {
  const a = { type };
  if (type === "poll") { a.q = ""; a.options = ["", ""]; }
  if (type === "quiz") { a.q = ""; a.options = ["", "", "", ""]; a.correct = 0; a.time = 20; }
  if (type === "scale") { a.q = ""; a.left = t("def_left"); a.right = t("def_right"); }
  if (type === "slide") { a.title = ""; a.text = ""; }
  if (type === "verse") { a.ref = ed && ed.verse || ""; a.text = ""; }
  if (["words", "open", "qa", "prayer", "tap"].includes(type)) a.q = t("def_" + type);
  return a;
}
function editAct(orig, onSave) {
  const a = copy(orig);
  const inp = (key, label, attrs = {}) => h("label", { class: "f" }, label, h("input", Object.assign({ type: "text", value: a[key] || "", oninput: (e) => (a[key] = e.target.value) }, attrs)));
  const area = (key, label, rows = 4, max = 900) => h("label", { class: "f" }, label, h("textarea", { rows, maxlength: max, oninput: (e) => (a[key] = e.target.value) }, a[key] || ""));
  const body = h("div", { style: "display:flex;flex-direction:column;gap:12px" });
  const err = h("p", { class: "small", style: "color:var(--accent);font-weight:700", hidden: true });
  const T = a.type;
  body.append(h("p", { class: "small dim" }, t("type_" + T + "_d")));
  if (T === "slide") body.append(inp("title", t("f_heading"), { maxlength: 120 }), area("text", t("f_text"), 6));
  if (T === "verse") body.append(inp("ref", t("f_ref"), { maxlength: 120, placeholder: "Yosua 1:9" }), area("text", t("f_verse_text"), 4, 600), h("p", { class: "small dim" }, t("verse_tip")));
  if (["poll", "quiz", "words", "scale", "open", "qa", "prayer", "tap"].includes(T)) body.append(area("q", t(T === "tap" ? "f_tap_title" : "f_question"), 2, 200));
  if (T === "poll" || T === "quiz") body.append(h("div", { class: "f", style: "font-size:14px;font-weight:700;color:var(--dim)" }, t(T === "quiz" ? "f_answers_quiz" : "f_answers")), optionsEditor(a, T === "quiz"));
  if (T === "quiz") body.append(h("label", { class: "f" }, t("f_time"), h("select", { onchange: (e) => (a.time = +e.target.value) }, [10, 20, 30, 45, 60].map((s) => h("option", { value: s, selected: a.time === s }, s + " " + t("seconds"))))));
  if (T === "scale") body.append(h("div", { class: "row" }, h("div", { style: "flex:1" }, inp("left", t("f_left"), { maxlength: 60 })), h("div", { style: "flex:1" }, inp("right", t("f_right"), { maxlength: 60 }))));
  if (T === "prayer") body.append(h("p", { class: "small dim" }, t("prayer_tip")));
  body.append(err, h("div", { class: "row" },
    h("button", { class: "btn pri", type: "button", onclick: () => {
      const b = sanitizeKit({ acts: [a] }).acts[0];
      if (!b || (["poll", "quiz", "words", "scale", "open"].includes(T) && !b.q) || (T === "slide" && !b.title && !b.text)) { err.textContent = t(T === "verse" ? "need_verse" : (T === "poll" || T === "quiz") && b && b.q ? "need_options" : "need_question"); err.hidden = false; return; }
      close(); onSave(b);
    } }, t("save")),
    h("button", { class: "btn", type: "button", onclick: () => close() }, t("cancel"))));
  const close = modal(TYPES[T] + " " + tn(T), body);
}
function optionsEditor(a, isQuiz) {
  const box = h("div", { class: "opts" });
  const grp = "c" + uid(4);
  const draw = () => box.replaceChildren(
    ...a.options.map((o, j) => h("div", { class: "opt" },
      h("span", { class: "sh", style: "background:" + QCOL[j], "aria-hidden": "true" }, SHAPES[j % 4]),
      h("input", { type: "text", class: "inp", value: o, maxlength: 80, placeholder: t("option") + " " + (j + 1), "aria-label": t("option") + " " + (j + 1), oninput: (e) => (a.options[j] = e.target.value) }),
      isQuiz ? h("label", null, h("input", { type: "radio", name: grp, checked: a.correct === j, onchange: () => (a.correct = j) }), "✓ " + t("correct")) : null,
      a.options.length > 2 ? h("button", { type: "button", class: "btn sm ghost", "aria-label": t("remove"), onclick: () => { a.options.splice(j, 1); if (a.correct >= j && a.correct > 0) a.correct--; draw(); } }, "✕") : null)),
    a.options.length < (isQuiz ? 4 : 6) ? h("button", { type: "button", class: "btn sm", onclick: () => { a.options.push(""); draw(); } }, "＋ " + t("add_option")) : "");
  draw();
  return box;
}

// ---------- sharing, import, templates ----------
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const kitPayload = (k) => ({ title: k.title, verse: k.verse, date: k.date, acts: k.acts });
async function packKit(k) {
  const bytes = new TextEncoder().encode(JSON.stringify(kitPayload(k)));
  if (window.CompressionStream) {
    try { const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()); return "z" + b64u(z); } catch {}
  }
  return "j" + b64u(bytes);
}
async function unpackKit(s) {
  let bytes = unb64u(s.slice(1));
  if (s[0] === "z") bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function shareKit(k) {
  const url = BASE_URL + "#k=" + (await packKit(k));
  const text = t("share_text", { t: k.title });
  const close = modal("🔗 " + t("share"), h("div", { style: "display:flex;flex-direction:column;gap:12px" },
    h("p", null, t("share_hint")),
    h("textarea", { class: "inp", rows: 3, readonly: true, onfocus: (e) => e.target.select() }, url),
    h("div", { class: "row" },
      navigator.share ? h("button", { class: "btn pri", type: "button", onclick: () => navigator.share({ title: k.title, text, url }).catch(() => {}) }, "📤 " + t("share_send")) : null,
      h("a", { class: "btn", href: "https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), target: "_blank", rel: "noopener" }, "WhatsApp"),
      h("button", { class: "btn", type: "button", onclick: () => navigator.clipboard.writeText(url).then(() => toast(t("copied")), () => {}) }, "📋 " + t("copy_link")),
      h("button", { class: "btn ghost", type: "button", onclick: () => download(k.title.replace(/[^\w\- ]+/g, "").trim() + ".gugah.json", JSON.stringify(kitPayload(k), null, 2), "application/json") }, "⬇ " + t("save_file")))));
}
function addKit(raw, open) {
  const k = sanitizeKit(raw);
  kits.unshift(k); saveKits();
  if (open) openEditor(k); else renderHome();
  toast(t("added", { t: k.title }));
}
async function importText(txt) {
  txt = String(txt || "").trim();
  const m = txt.match(/#k=([A-Za-z0-9_\-]+)/);
  if (m) return unpackKit(m[1]);
  const i = txt.indexOf("{"), j = txt.lastIndexOf("}");
  if (i >= 0 && j > i) return JSON.parse(txt.slice(i, j + 1));
  throw new Error("bad");
}
function openImport() {
  const ta = h("textarea", { class: "inp", rows: 5, placeholder: t("import_ph") });
  const file = h("input", { type: "file", accept: ".json,application/json", onchange: async (e) => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } });
  const err = h("p", { class: "small", style: "color:var(--accent);font-weight:700", hidden: true }, t("import_bad"));
  const close = modal("📥 " + t("import"), h("div", { style: "display:flex;flex-direction:column;gap:12px" }, h("p", null, t("import_hint")), ta,
    h("label", { class: "f" }, t("or_file"), file), err,
    h("button", { class: "btn pri", type: "button", onclick: async () => { try { const k = await importText(ta.value); close(); addKit(k, true); } catch { err.hidden = false; } } }, t("import"))));
}
function openTemplates() {
  const list = (window.KITS || []).map((k) => h("div", { class: "kit" },
    h("div", { class: "kt" }, h("b", null, k.title), h("span", { class: "small dim" }, k.verse + " · " + k.langName), h("div", { class: "icons" }, k.acts.map((a) => TYPES[a.type]).join(""))),
    h("button", { class: "btn pri sm", type: "button", onclick: () => { close(); addKit(k, true); } }, t("use_this"))));
  const close = modal("✨ " + t("templates"), h("div", { class: "kits" }, h("p", { class: "dim small" }, t("templates_hint")), list), { noFocus: true });
}

// ---------- AI helper ----------
function aiPrompt(notes, lng, age) {
  const L = { id: "Bahasa Indonesia", en: "English", bt: "Bahasa Batak Toba (use simple, common Batak Toba; keep Bible quotes from the Batak Toba Bible only if you are sure of the exact wording, otherwise use Bahasa Indonesia TB)", mix: "Bahasa Indonesia with some English and Batak Toba words where natural" }[lng];
  return `You are helping a youth teacher at an HKBP (Batak Protestant) church in Singapore make a lively, interactive youth sermon session for shy, sleepy teenagers (${age}). Phones are used to answer anonymously on a projector screen.

SERMON NOTES / PASSAGE:
"""
${notes}
"""

Make a 40–50 minute session in ${L}. Follow this rhythm: WAKE (energizer + fun poll) → HOOK (a real-life opinion question) → WORD (the sermon in 2–3 short points as slides, each followed by a quick quiz, poll, word cloud or scale — never more than 7 minutes of talking without a phone activity) → RESPOND (verse puzzle + an open question about their own life) → ASK (anonymous questions board) → PRAY (anonymous prayer requests) → scoreboard.
Keep every question short (max 15 words). Quiz answers max 6 words, exactly one correct. Make it funny and relevant to teenage life in Singapore (school, exams, phones, friends, family, games). Never embarrass anyone.

Reply with ONLY a JSON object, no other text, in this exact shape:
{"title": "...", "verse": "Book 1:2-3", "acts": [ ...activities in order... ]}
Activity shapes (use only these):
{"type":"tap","q":"title of the wake-up tap race"}
{"type":"poll","q":"...","options":["...","..."]}            (2–6 options)
{"type":"quiz","q":"...","options":["a","b","c","d"],"correct":0,"time":20}   (2–4 options, correct = index)
{"type":"words","q":"... (answered with one or two words)"}
{"type":"scale","q":"statement to rate 1–10","left":"label for 1","right":"label for 10"}
{"type":"slide","title":"short sermon point","text":"2–4 short lines the teacher explains"}
{"type":"open","q":"..."}
{"type":"verse","ref":"Book 1:2","text":"exact verse text for the puzzle (max 30 words)"}
{"type":"qa","q":"..."}
{"type":"prayer","q":"..."}
{"type":"board"}
Use 12–18 activities.`;
}
function getKey() {
  const own = store.get("apiKey", "");
  if (own) return own;
  try { const j = JSON.parse(localStorage.getItem("butet.settings") || "{}"); return j.apiKey || ""; } catch { return ""; }
}
function openAI(target) {
  const notes = h("textarea", { class: "inp", rows: 6, maxlength: 6000, placeholder: t("ai_notes_ph") }, target && target.verse ? target.verse + "\n" : "");
  const lng = h("select", { class: "inp" }, [["id", "Bahasa Indonesia"], ["en", "English"], ["bt", "Batak Toba"], ["mix", t("ai_mix")]].map(([v, l]) => h("option", { value: v, selected: v === (lang === "en" ? "en" : lang === "bt" ? "bt" : "id") }, l)));
  const age = h("select", { class: "inp" }, [["13-16", "13–16"], ["16-19", "16–19"], ["13-19", "13–19"], ["18-25", "18–25"]].map(([v, l]) => h("option", { value: v, selected: v === "13-19" }, l + " " + t("years"))));
  const key = h("input", { type: "password", class: "inp", placeholder: "sk-ant-…", value: getKey(), autocomplete: "off" });
  const status = h("p", { class: "small", style: "font-weight:700", role: "status" });
  const pasted = h("textarea", { class: "inp", rows: 4, placeholder: t("ai_paste_ph") });
  const useResult = (raw) => {
    const k = sanitizeKit(raw);
    if (!k.acts.length) throw new Error("empty");
    close();
    if (target && target === ed) { ed.acts = ed.acts.concat(k.acts); if (!ed.verse) ed.verse = k.verse; if (ed.title === t("new_title")) ed.title = k.title; saveEd(); renderEditor(); toast(t("ai_added", { n: k.acts.length })); }
    else addKit(k, true);
  };
  const prompt = () => aiPrompt(notes.value.trim(), lng.value, age.value + " " + t("years"));
  const genBtn = h("button", { class: "btn pri", type: "button", onclick: async () => {
    if (!notes.value.trim()) { notes.focus(); return; }
    if (!key.value.trim()) { status.textContent = t("ai_need_key"); key.focus(); return; }
    store.set("apiKey", key.value.trim());
    genBtn.disabled = true; status.textContent = "⏳ " + t("ai_working");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key.value.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 8000, messages: [{ role: "user", content: prompt() }] }) });
      const j = await res.json();
      if (!res.ok) throw new Error((j.error && j.error.message) || res.status);
      const txt = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      useResult(await importText(txt));
    } catch (e) { status.textContent = "⚠️ " + t("ai_failed") + " " + (e.message || ""); genBtn.disabled = false; }
  } }, "🤖 " + t("ai_generate"));
  const close = modal("🤖 " + t("ai_make"), h("div", { style: "display:flex;flex-direction:column;gap:12px" },
    h("p", { class: "small dim" }, t("ai_hint")),
    h("label", { class: "f" }, t("ai_notes"), notes),
    h("div", { class: "row" }, h("label", { class: "f", style: "flex:1" }, t("ai_lang"), lng), h("label", { class: "f", style: "flex:1" }, t("ai_age"), age)),
    h("details", { open: !!getKey() }, h("summary", { style: "font-weight:800;cursor:pointer" }, "A · " + t("ai_way_key")),
      h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-top:8px" }, h("label", { class: "f" }, t("ai_key"), key), h("p", { class: "small dim" }, t("ai_key_hint")), genBtn)),
    h("details", { open: !getKey() }, h("summary", { style: "font-weight:800;cursor:pointer" }, "B · " + t("ai_way_free")),
      h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-top:8px" },
        h("ol", { class: "small", style: "margin:0;padding-left:18px" }, h("li", null, t("ai_free_1")), h("li", null, t("ai_free_2")), h("li", null, t("ai_free_3"))),
        h("div", { class: "row" },
          h("button", { class: "btn", type: "button", onclick: () => { if (!notes.value.trim()) { notes.focus(); return; } navigator.clipboard.writeText(prompt()).then(() => toast(t("copied")), () => { pasted.value = prompt(); }); } }, "📋 " + t("ai_copy")),
          h("a", { class: "btn ghost", href: "https://claude.ai/new", target: "_blank", rel: "noopener" }, "claude.ai ↗")),
        pasted,
        h("button", { class: "btn", type: "button", onclick: async () => { try { useResult(await importText(pasted.value)); } catch { status.textContent = "⚠️ " + t("import_bad"); } } }, t("ai_use"))))
    , status));
}

// ---------- weekly guide ----------
function openGuide() {
  const g = window.I18N_GUIDE[lang] || window.I18N_GUIDE[lang === "bt" ? "id" : "en"];
  modal("🗓️ " + t("guide_title"), h("div", { class: "guide", style: "display:flex;flex-direction:column;gap:14px" },
    h("p", null, g.intro),
    h("h4", { style: "margin:0" }, g.weekH), h("ol", null, g.week.map((s) => h("li", null, h("b", null, s[0]), " — ", s[1]))),
    h("h4", { style: "margin:0" }, g.flowH),
    h("table", null, h("tbody", null, g.flow.map((r) => h("tr", null, h("td", null, r[0]), h("td", null, h("b", null, r[1]), h("br"), h("span", { class: "dim" }, r[2])))))),
    h("h4", { style: "margin:0" }, g.shyH), h("ul", { style: "margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px" }, g.shy.map((s) => h("li", null, s))),
    h("h4", { style: "margin:0" }, g.techH), h("ul", { style: "margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px" }, g.tech.map((s) => h("li", null, s)))), { noFocus: true });
}

// =====================================================================
// STAGE (teacher's projector screen, hosts the room)
// =====================================================================
let S = null, peer = null, retries = 0, autoT = 0, tickT = 0, curView = null, saveT = 0, netState = "", lastTick = -1;
const conns = new Map();
const curAct = () => (S && S.idx >= 0 ? S.kit.acts[S.idx] : null);
const run = () => (S.idx < 0 ? {} : (S.run[S.idx] = S.run[S.idx] || {}));
const ansOf = (i = S.idx) => (S.ans[i] = S.ans[i] || {});
const online = () => [...conns.values()].filter((c) => c.open).length;
function saveLive() { clearTimeout(saveT); saveT = setTimeout(() => { if (S) store.set("live", Object.assign({}, S, { at: Date.now() })); }, 300); }

function startStage(kit, resume) {
  if (!kit.acts.length) { toast(t("no_acts")); return; }
  S = resume ? resume : { code: newCode(), kit: copy(kit), idx: -1, players: {}, ans: {}, run: {}, qa: [], mute: false, started: Date.now() };
  if (S.jarvis == null) S.jarvis = store.get("jarvis", true);
  S.players = S.players || {}; S.qa = S.qa || []; S.run = S.run || {}; S.ans = S.ans || {};
  // a teacher may have paused mid-timer: put timed phases back to a safe state
  for (const r of Object.values(S.run)) { if (r.phase === "count") r.phase = "ready"; }
  show("stage"); buildStageShell(); hostPeer(); goTo(S.idx); keepAwake();
  clearInterval(tickT); tickT = setInterval(tick, 200);
  saveLive();
}
function leaveStage(end) {
  clearInterval(tickT); clearTimeout(autoT);
  for (const c of conns.values()) { try { if (end) c.send({ t: "end" }); } catch {} }
  setTimeout(() => { try { peer && peer.destroy(); } catch {} peer = null; conns.clear(); }, end ? 400 : 0);
  if (end) store.del("live"); else if (S) store.set("live", Object.assign({}, S, { at: Date.now() }));
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  S = null; renderHome();
}
function hostPeer() {
  if (!window.Peer) { setNet("nolib"); return; }
  try { peer && peer.destroy(); } catch {}
  const me = new Peer(PEER_PREFIX + S.code.toLowerCase(), { debug: 0 });
  peer = me;
  me.on("open", () => { retries = 0; setNet("ok"); });
  me.on("connection", onConn);
  me.on("disconnected", () => { if (peer !== me) return; setNet("retry"); setTimeout(() => { try { if (peer === me && !me.destroyed) me.reconnect(); } catch {} }, 2000); });
  me.on("error", (e) => {
    if (peer !== me || !S) return;
    if (e.type === "unavailable-id") {
      // The old tab may still hold the code for a few seconds after a reload.
      if (++retries < 6) setTimeout(() => { if (peer === me && S) hostPeer(); }, 3000);
      else { retries = 0; S.code = newCode(); saveLive(); refreshCode(); hostPeer(); }
    } else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) {
      setNet("retry"); if (!me.open) setTimeout(() => { if (peer === me && S) hostPeer(); }, 5000);
    } else if (e.type === "browser-incompatible") setNet("nolib");
  });
}
function setNet(s) {
  netState = s; const w = $("#netwarn"); if (!w) return;
  w.hidden = s === "ok"; w.textContent = s === "nolib" ? t("net_nolib") : t("net_retry");
}
function onConn(c) {
  let pid = null;
  c.on("data", (m) => {
    if (!S || !m || typeof m !== "object") return;
    if (m.t === "hello") { pid = hello(c, m); return; }
    if (pid && conns.get(pid) === c) handle(pid, m);
  });
  c.on("close", () => { if (pid && conns.get(pid) === c) { conns.delete(pid); updateCount(); } });
  c.on("error", () => {});
}
function pickTeam() {
  const n = TEAMS.map(() => 0); for (const p of Object.values(S.players)) n[p.team]++;
  return n.indexOf(Math.min(...n));
}
function hello(c, m) {
  const pid = typeof m.pid === "string" && /^[a-z0-9]{6,20}$/.test(m.pid) ? m.pid : uid();
  const name = clean(m.name, 24) || randomNick();
  const emoji = AVATARS.includes(m.emoji) ? m.emoji : pick(AVATARS);
  let p = S.players[pid];
  if (!p) { p = S.players[pid] = { name, emoji, team: pickTeam(), score: 0 }; sfx.join(); if (S.idx < 0) jvWelcome(name); }
  else { p.name = name; p.emoji = emoji; }
  const old = conns.get(pid); if (old && old !== c) { try { old.close(); } catch {} }
  conns.set(pid, c);
  send(pid, { t: "welcome", pid, name: p.name, emoji: p.emoji, team: p.team });
  send(pid, stateFor(pid));
  if (S.qa.length) send(pid, { t: "qa", list: qaFor(pid) });
  updateCount(); saveLive(); stageUpdate();
  return pid;
}
function send(pid, msg) { const c = conns.get(pid); if (c && c.open) { try { c.send(msg); } catch {} } }
function broadcastState() { for (const pid of conns.keys()) send(pid, stateFor(pid)); }
function ranked() { return Object.entries(S.players).sort((a, b) => b[1].score - a[1].score); }
function rankOf(pid) { return ranked().findIndex(([id]) => id === pid) + 1; }
function teamTotals() { const s = TEAMS.map(() => 0); for (const p of Object.values(S.players)) s[p.team] += p.score; return s; }
function publicAct(a, r) {
  const o = { type: a.type };
  for (const f of ["q", "title", "text", "options", "left", "right", "ref", "time"]) if (a[f] != null) o[f] = a[f];
  if (a.type === "quiz" && r.phase === "reveal") o.correct = a.correct;
  if (a.type === "verse") { o.chunks = chunkVerse(a.text); if (r.phase !== "reveal") delete o.text; }
  if (a.type === "slide" && o.text && o.text.length > 300) o.text = o.text.slice(0, 300) + "…";
  return o;
}
function stateFor(pid) {
  const a = curAct(), r = run(), p = S.players[pid] || { score: 0, team: 0 };
  const st = { t: "state", idx: S.idx, n: S.kit.acts.length, title: S.kit.title, phase: r.phase || "", score: p.score, rank: rankOf(pid), of: Object.keys(S.players).length, team: p.team };
  if (!a) return st;
  st.act = publicAct(a, r);
  st.left = r.phase === "count" ? Math.max(0, r.countAt - Date.now()) : r.endAt ? Math.max(0, r.endAt - Date.now()) : 0;
  const A = ansOf()[pid];
  if (a.type === "poll" || a.type === "quiz") st.mine = A ? { v: A.v, ok: A.ok, pts: A.pts || 0 } : null;
  else if (a.type === "scale") st.mine = A ? { v: A.v } : null;
  else if (["words", "open", "prayer"].includes(a.type)) st.mine = { n: A ? A.length : 0 };
  else if (a.type === "verse") st.mine = A ? { rank: A.rank, pts: A.pts } : null;
  else if (a.type === "tap") st.mine = { win: r.win, taps: (r.taps || {})[pid] || 0 };
  if (a.type === "qa") st.qa = qaFor(pid);
  return st;
}
function qaFor(pid) { return S.qa.filter((q) => !q.hidden).sort((a, b) => b.votes.length - a.votes.length).slice(0, 40).map((q) => ({ id: q.id, text: q.text, v: q.votes.length, me: q.votes.includes(pid), own: q.by === pid, done: !!q.done })); }
function qaChanged() { saveLive(); for (const pid of conns.keys()) send(pid, { t: "qa", list: qaFor(pid) }); stageUpdate(); updateCount(); }
const lastReact = {};
function handle(pid, m) {
  const a = curAct(), r = run();
  switch (m.t) {
    case "ans": {
      if (!a || m.idx !== S.idx || r.phase !== "open") return;
      const A = ansOf();
      if (a.type === "poll" || a.type === "quiz") {
        const v = m.v | 0; if (v < 0 || v >= a.options.length || A[pid]) return;
        A[pid] = { v, ms: Date.now() - (r.openAt || Date.now()) };
        if (a.type === "quiz") { const n = Object.keys(A).length; if (n >= online() && n > 0) { clearTimeout(autoT); autoT = setTimeout(() => { if (S && curAct() === a && run().phase === "open") reveal(); }, 700); } }
      } else if (a.type === "scale") { A[pid] = { v: Math.max(1, Math.min(10, m.v | 0)) }; }
      else if (a.type === "words") { const w = clean(m.v, 30).toLowerCase(); if (!w) return; const L = (A[pid] = A[pid] || []); if (L.length >= 3) return; L.push(w); }
      else if (a.type === "open" || a.type === "prayer") { const x = cleanML(m.v, a.type === "prayer" ? 500 : 240); if (!x) return; const L = (A[pid] = A[pid] || []); if (L.length >= 5) return; L.push(x); }
      else if (a.type === "verse") {
        if (A[pid]) return;
        const rank = Object.keys(A).length + 1, pts = Math.max(300, 1000 - (rank - 1) * 100);
        A[pid] = { ms: Date.now() - r.openAt, rank, pts }; S.players[pid].score += pts; sfx.join();
      } else return;
      saveLive(); stageUpdate(); send(pid, stateFor(pid));
      break;
    }
    case "ask": {
      const x = clean(m.text, 220); if (!x || S.qa.filter((q) => q.by === pid).length >= 15) return;
      S.qa.push({ id: uid(6), text: x, by: pid, votes: [], at: Date.now() }); qaChanged(); break;
    }
    case "vote": {
      const q = S.qa.find((q) => q.id === m.id); if (!q) return;
      const i = q.votes.indexOf(pid); if (i < 0) q.votes.push(pid); else q.votes.splice(i, 1); qaChanged(); break;
    }
    case "tap": {
      if (!a || a.type !== "tap" || r.phase !== "open") return;
      r.taps = r.taps || {}; r.taps[pid] = (r.taps[pid] || 0) + Math.max(0, Math.min(12, m.n | 0)); stageUpdate(); break;
    }
    case "react": {
      if (!REACTS.includes(m.e) || Date.now() - (lastReact[pid] || 0) < 500) return;
      lastReact[pid] = Date.now(); floatEmoji(m.e); break;
    }
  }
}
function floatEmoji(e) {
  const box = $("#floaters"); if (!box || box.childElementCount > 40) return;
  const s = h("span", { style: `left:${4 + Math.random() * 90}%;--r:${(Math.random() - 0.5) * 60}deg` }, e);
  box.append(s); setTimeout(() => s.remove(), 3700);
}

// --- flow ---
function initRun(a, r) {
  if (a.type === "slide" || a.type === "board") r.phase = "show";
  else if (["quiz", "verse", "tap"].includes(a.type)) r.phase = "ready";
  else { r.phase = "open"; r.openAt = Date.now(); }
}
function goTo(i) {
  clearTimeout(autoT);
  S.idx = Math.max(-1, Math.min(S.kit.acts.length - 1, i));
  const a = curAct(), r = run();
  if (a && !r.phase) initRun(a, r);
  if (a && a.type === "quiz" && r.phase === "ready") autoT = setTimeout(() => { if (S && curAct() === a && run().phase === "ready") openPhase(); }, 4000);
  if (a && a.type === "board") setTimeout(() => { confetti(); sfx.win(); }, 300);
  saveLive(); renderStageMain(); broadcastState(); renderProg();
  jvIntro(a, r);
}
function openPhase() {
  const a = curAct(), r = run(); if (!a) return;
  if (a.type === "tap") { r.phase = "count"; r.countAt = Date.now() + 3000; r.taps = {}; r.win = null; }
  else { r.phase = "open"; r.openAt = Date.now(); if (a.type === "quiz") r.endAt = Date.now() + (a.time || 20) * 1000; }
  sfx.go(); saveLive(); renderStageMain(); broadcastState();
  if (a.type === "quiz") jvSay(t("jv_go"), true);
  if (a.type === "verse") jvSay(t("jv_verse_go"), true);
  if (a.type === "tap") jvSay(t("jv_ready"), true);
}
function reveal() {
  const a = curAct(), r = run(); if (!a) return;
  if (a.type === "quiz" && !r.scored) {
    const A = ansOf(), T = (a.time || 20) * 1000;
    for (const [pid, x] of Object.entries(A)) {
      x.ok = x.v === a.correct;
      x.pts = x.ok ? Math.round(500 + 500 * Math.max(0, 1 - x.ms / T)) : 0;
      if (S.players[pid]) S.players[pid].score += x.pts;
    }
    r.scored = true;
  }
  r.phase = "reveal"; r.endAt = 0;
  sfx.reveal(); saveLive(); renderStageMain(); broadcastState();
  if (a.type === "quiz") { const A = Object.values(ansOf()); jvSay(t("jv_reveal", { o: a.options[a.correct], k: A.filter((x) => x.ok).length, n: A.length }), true); }
  if (a.type === "verse") jvSay(a.ref + ". " + a.text, true);
}
function finishTap() {
  const r = run(); r.phase = "reveal"; r.endAt = 0;
  const per = tapTeams(r);
  r.win = per.indexOf(Math.max(...per));
  if (!r.scored && per[r.win] > 0) { for (const [pid, p] of Object.entries(S.players)) if (p.team === r.win) p.score += 300; r.scored = true; }
  sfx.win(); confetti(); saveLive(); renderStageMain(); broadcastState();
  jvSay(t("jv_tap_win", { t: TEAMS[r.win].n }), true);
}
function tapTeams(r) {
  // average taps per team member, so a small team can still win
  const sum = TEAMS.map(() => 0), n = TEAMS.map(() => 0);
  for (const [pid, p] of Object.entries(S.players)) { n[p.team]++; sum[p.team] += (r.taps || {})[pid] || 0; }
  return sum.map((s, i) => (n[i] ? Math.round(s / n[i]) : 0));
}
function tick() {
  if (!S) return;
  const a = curAct(), r = run(), now = Date.now();
  if (a && a.type === "quiz" && r.phase === "open") { if (now >= r.endAt) reveal(); }
  if (a && a.type === "tap" && r.phase === "count" && now >= r.countAt) { r.phase = "open"; r.openAt = now; r.endAt = now + 10000; sfx.go(); renderStageMain(); broadcastState(); jvSay(t("jv_tap_go"), true); }
  if (a && a.type === "tap" && r.phase === "open" && now >= r.endAt) finishTap();
  if (curView && curView.tick) curView.tick(now);
  // heartbeat so phones notice quickly when the room is gone
  if (now - (S.pingAt || 0) > 5000) { S.pingAt = now; for (const pid of conns.keys()) send(pid, { t: "ping" }); }
}
// what the big action button (and a clicker's "next") does right now
function actionFor() {
  const a = curAct(), r = run(); if (!a) return null;
  const fwd = (label, fn) => ({ label, fn, fwd: true });
  switch (a.type) {
    case "quiz": return r.phase === "ready" ? fwd(t("act_start"), openPhase) : r.phase === "open" ? fwd(t("act_reveal"), reveal) : null;
    case "verse": return r.phase === "ready" ? fwd(t("act_start_game"), openPhase) : r.phase === "open" ? fwd(t("act_show_verse"), reveal) : null;
    case "tap": return r.phase === "ready" ? fwd(t("act_start_race"), openPhase) : r.phase === "reveal" ? { label: t("act_again"), fn: () => { r.scored = false; openPhase(); } } : null;
    case "poll": case "scale": case "words": case "open": case "prayer":
      return r.phase === "open" ? { label: t("act_close"), fn: () => { r.phase = "closed"; saveLive(); renderStageMain(); broadcastState(); } }
        : { label: t("act_reopen"), fn: () => { r.phase = "open"; saveLive(); renderStageMain(); broadcastState(); } };
  }
  return null;
}
function step() { const x = actionFor(); if (x && x.fwd) x.fn(); else if (S.idx < S.kit.acts.length - 1) goTo(S.idx + 1); }

// --- stage shell ---
function buildStageShell() {
  const st = $("#stage"); st.replaceChildren();
  const qrS = h("div", { class: "qr-s", id: "qrSmall" });
  const ctlBtn = (label, fn, attrs = {}) => h("button", Object.assign({ class: "btn", type: "button", onclick: (e) => { e.currentTarget.blur(); fn(); } }, attrs), label);
  st.append(
    h("div", { class: "sbar" },
      h("div", { class: "kt" }, S.kit.title), h("div", { class: "sp" }),
      h("div", { class: "pill", id: "sPill" }, h("div", { style: "text-align:right" }, h("div", { style: "color:var(--st-dim);font-weight:700;font-size:13px" }, SHORT_URL), h("b", { id: "sCode" }, S.code)), qrS),
      h("div", { class: "cnt", id: "sCnt", title: t("players") }, "👥 0"),
      h("button", { class: "btn sm", type: "button", id: "sJv", "aria-pressed": String(!!S.jarvis), title: t("jv_toggle"), onclick: (e) => { S.jarvis = !S.jarvis; store.set("jarvis", S.jarvis); e.currentTarget.setAttribute("aria-pressed", String(S.jarvis)); if (S.jarvis) jvSay(t("jv_on"), true); else try { speechSynthesis.cancel(); } catch {} saveLive(); } }, "🤖 Jarvis"),
      h("button", { class: "btn sm", type: "button", id: "sMute", "aria-label": t("sound"), onclick: (e) => { S.mute = !S.mute; e.currentTarget.textContent = S.mute ? "🔇" : "🔊"; saveLive(); } }, S.mute ? "🔇" : "🔊")),
    h("div", { class: "smain", id: "sMain" }),
    h("div", { class: "sctl" },
      ctlBtn("✕", stageMenu, { "aria-label": t("menu"), title: t("menu") }),
      ctlBtn("◀", () => goTo(S.idx - 1), { "aria-label": t("prev"), title: t("prev") + " (←)" }),
      h("button", { class: "btn pri", type: "button", id: "sAction", hidden: true }),
      ctlBtn("▶", () => goTo(S.idx + 1), { "aria-label": t("next"), title: t("next") + " (→)", id: "sNext" }),
      h("div", { class: "prog", id: "sProg" }),
      ctlBtn("🙋 0", openQAModal, { id: "sQA", title: t("type_qa") }),
      ctlBtn("⛶", toggleFS, { "aria-label": t("fullscreen"), title: t("fullscreen") + " (F)" })),
    h("div", { class: "floaters", id: "floaters", "aria-hidden": "true" }),
    h("canvas", { id: "confetti", "aria-hidden": "true" }),
    h("div", { id: "netwarn", class: "netwarn", hidden: true, style: "position:absolute;top:0;left:0;right:0;z-index:8" }));
  makeQR(qrS, BASE_URL + "?j=" + S.code);
  if (netState && netState !== "ok") setNet(netState);
  updateCount();
}
function refreshCode() { const c = $("#sCode"); if (c) c.textContent = S.code; makeQR($("#qrSmall"), BASE_URL + "?j=" + S.code); if (S.idx < 0) renderStageMain(); }
function updateCount() {
  if (!S) return;
  const c = $("#sCnt"); if (c) c.textContent = "👥 " + online();
  const q = $("#sQA"); if (q) q.textContent = "🙋 " + S.qa.filter((x) => !x.hidden && !x.done).length;
}
function renderProg() {
  const p = $("#sProg"); if (!p) return;
  p.replaceChildren(...[-1, ...S.kit.acts.keys()].map((i) => h("i", { class: i === S.idx ? "on" : i < S.idx ? "done" : "", title: i < 0 ? t("join_now") : (i + 1) + ". " + tn(S.kit.acts[i].type), onclick: () => goTo(i), style: "cursor:pointer" })));
  const x = actionFor(), b = $("#sAction");
  b.hidden = !x; if (x) { b.textContent = x.label; b.onclick = (e) => { e.currentTarget.blur(); x.fn(); }; }
  $("#sPill").style.visibility = S.idx < 0 ? "hidden" : "visible";
  $("#sNext").disabled = S.idx >= S.kit.acts.length - 1;
}
function toggleFS() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); }
function stageMenu() {
  const close = modal(t("menu"), h("div", { style: "display:flex;flex-direction:column;gap:10px" },
    h("p", { class: "small dim" }, t("menu_hint", { c: S.code })),
    h("button", { class: "btn", type: "button", onclick: () => { close(); downloadSummary(S); } }, "⬇ " + t("download_results")),
    h("button", { class: "btn", type: "button", onclick: () => { close(); openPrivate(); } }, "🙏 " + t("read_prayers")),
    h("button", { class: "btn", type: "button", onclick: () => { close(); leaveStage(false); } }, "⏸ " + t("pause")),
    h("button", { class: "btn pri", type: "button", onclick: () => { close(); downloadSummary(S); leaveStage(true); } }, "⏹ " + t("end_and_save"))), { noFocus: true });
}
function openQAModal() {
  const list = h("div", { class: "kits" });
  const draw = () => list.replaceChildren(...(S.qa.filter((q) => !q.hidden).length ? S.qa.filter((q) => !q.hidden).sort((a, b) => b.votes.length - a.votes.length).map((q) => h("div", { class: "kit" },
    h("div", { class: "kt" }, h("b", { style: "font-size:16px" }, q.text), h("span", { class: "small dim" }, "👍 " + q.votes.length + (q.done ? " · ✓ " + t("answered_mark") : ""))),
    h("button", { class: "btn sm", type: "button", onclick: () => { q.done = !q.done; qaChanged(); draw(); } }, q.done ? "↺" : "✓"),
    h("button", { class: "btn sm ghost", type: "button", "aria-label": t("hide"), onclick: () => { q.hidden = true; qaChanged(); draw(); } }, "✕"))) : [h("div", { class: "empty" }, t("no_questions"))]));
  draw();
  modal("🙋 " + t("type_qa"), h("div", { style: "display:flex;flex-direction:column;gap:10px" }, h("p", { class: "small dim" }, t("qa_modal_hint")), list), { noFocus: true });
}
function openPrivate() {
  const items = [];
  S.kit.acts.forEach((a, i) => { if (a.type === "prayer") for (const L of Object.values(S.ans[i] || {})) for (const x of L) items.push(x); });
  modal("🙏 " + t("read_prayers"), h("div", { style: "display:flex;flex-direction:column;gap:10px" },
    h("p", { class: "small", style: "font-weight:800;color:var(--accent)" }, "⚠️ " + t("private_warn")),
    items.length ? items.map((x) => h("div", { class: "kit", style: "white-space:pre-wrap" }, x)) : h("div", { class: "empty" }, t("no_prayers"))), { noFocus: true });
}

// --- stage views ---
let stageRaf = 0;
function stageUpdate() { if (stageRaf) return; stageRaf = requestAnimationFrame(() => { stageRaf = 0; if (curView && curView.update) curView.update(); }); }
function renderStageMain() {
  const m = $("#sMain"); if (!m) return;
  const a = curAct(), r = run();
  curView = !a ? joinView() : (VIEWS[a.type] || VIEWS.slide)(a, r);
  m.replaceChildren(curView.el);
  if (curView.update) curView.update();
  renderProg();
}
const head = (a, extra) => h("div", { class: "s-type" }, TYPES[a.type] + " " + tn(a.type), extra ? h("span", { style: "color:var(--st-dim)" }, "· " + extra) : null);
const answeredLine = () => h("div", { class: "answered" });
function setAnswered(el, n) { el.textContent = t("n_answered", { n, of: online() }); }
function joinView() {
  const qr = h("div", { class: "qr-b" }); makeQR(qr, BASE_URL + "?j=" + S.code);
  const crowd = h("div", { class: "crowd" }); const seen = new Set();
  const count = h("p", { class: "s-sub", style: "margin:1vh 0 0" });
  const el = h("div", { class: "joinbig" }, qr, h("div", null,
    h("h1", null, t("join_now")),
    h("div", { class: "url" }, t("scan_or"), " ", h("b", { style: "color:var(--st-fg)" }, SHORT_URL)),
    h("div", { class: "code" }, S.code), count, crowd));
  return { el, update() {
    for (const [pid, p] of Object.entries(S.players)) if (!seen.has(pid)) { seen.add(pid); crowd.append(h("span", { style: "border-color:" + TEAMS[p.team].c }, p.emoji + " " + p.name)); }
    count.textContent = t("n_joined", { n: Object.keys(S.players).length });
  } };
}
function barsView(labels, colors, counts, opts = {}) {
  const max = Math.max(1, ...counts), total = counts.reduce((x, y) => x + y, 0);
  return h("div", { class: opts.cls || "bars" }, labels.map((l, j) => h("div", { class: "bar" + (opts.right != null ? (j === opts.right ? " right" : " wrong") : "") },
    h("div", { class: "tr" }, h("div", { class: "fill", style: `width:${(counts[j] / max) * 100}%;background:${colors[j]}` }), h("div", { class: "lb" }, l)),
    h("div", { class: "num" }, opts.raw ? counts[j] : total ? Math.round((counts[j] / total) * 100) + "%" : "0"))));
}
const VIEWS = {
  slide(a) {
    return { el: h("div", { class: "s-center" }, a.title ? h("div", { class: "slide-title" }, a.title) : null, a.text ? h("div", { class: "slide-text" }, a.text) : null) };
  },
  poll(a, r) {
    const box = h("div"), ans = answeredLine();
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0" }, head(a, r.phase === "closed" ? t("closed") : null), h("div", { class: "s-q" }, a.q), box, ans);
    return { el, update() {
      const A = ansOf(), c = a.options.map(() => 0); for (const x of Object.values(A)) c[x.v]++;
      box.replaceChildren(barsView(a.options.map((o, j) => [h("span", null, SHAPES[j % 4]), o]), a.options.map((_, j) => QCOL[j]), c));
      setAnswered(ans, Object.keys(A).length);
    } };
  },
  quiz(a, r) {
    if (r.phase === "ready") {
      const n = h("div", { class: "countdown" }, "");
      return { el: h("div", { class: "s-center" }, head(a, t("get_ready")), h("div", { class: "s-q" }, a.q), n), tick(now) { const s = Math.max(0, Math.ceil((4000 - (now - (r.readyAt || (r.readyAt = now)))) / 1000)); if (n.textContent !== String(s)) n.textContent = s || "⚡"; } };
    }
    const timer = h("div", { class: "timer" }), ans = answeredLine(), box = h("div", { style: "width:100%" });
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0;gap:1vh" }, head(a), h("div", { class: "qhead" }, h("div", { class: "s-q" }, a.q), r.phase === "open" ? timer : null), box, ans);
    return { el,
      tick(now) { if (r.phase !== "open") return; const s = Math.max(0, Math.ceil((r.endAt - now) / 1000)); if (timer.textContent !== String(s)) { timer.textContent = s; timer.classList.toggle("low", s <= 5); if (s <= 5 && s > 0 && lastTick !== s) { lastTick = s; sfx.tick(); } } },
      update() {
        const A = ansOf();
        if (r.phase === "open") {
          if (!box.childElementCount) box.append(h("div", { class: "qopts" }, a.options.map((o, j) => h("div", { class: "qo", style: "background:" + QCOL[j] }, h("span", { class: "shp" }, SHAPES[j]), o))));
          setAnswered(ans, Object.keys(A).length);
        } else {
          const c = a.options.map(() => 0); for (const x of Object.values(A)) c[x.v]++;
          const top = ranked().slice(0, 3);
          box.replaceChildren(barsView(a.options.map((o, j) => [h("span", null, j === a.correct ? "✅" : SHAPES[j]), o]), a.options.map((_, j) => QCOL[j]), c, { right: a.correct, raw: true }),
            top.length ? h("div", { class: "podium", style: "margin-top:2vh;flex-direction:row;flex-wrap:wrap;justify-content:center" }, top.map(([, p], i) => h("div", null, ["🥇", "🥈", "🥉"][i], " ", p.emoji, " ", p.name, h("b", null, p.score)))) : null);
          const ok = Object.values(A).filter((x) => x.ok).length;
          ans.textContent = Object.keys(A).length ? t("n_correct", { n: ok, of: Object.keys(A).length }) : "";
        }
      } };
  },
  words(a, r) {
    const cloud = h("div", { class: "cloud" }), ans = answeredLine();
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0" }, head(a, r.phase === "closed" ? t("closed") : null), h("div", { class: "s-q", style: "font-size:clamp(24px,3.2vw,48px)" }, a.q), cloud, ans);
    return { el, update() {
      const cnt = {}; for (const L of Object.values(ansOf())) for (const w of L) cnt[w] = (cnt[w] || 0) + 1;
      const words = Object.entries(cnt).sort((x, y) => y[1] - x[1]).slice(0, 60);
      const max = words.length ? words[0][1] : 1;
      const arranged = []; words.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)));
      cloud.replaceChildren(...arranged.map(([w, n], i) => h("span", { style: `font-size:${Math.round(22 + 88 * Math.sqrt(n / max))}px;color:${[...QCOL, "#ffd23f", "#3bd5ff", "#fff"][(w.length + i) % 9]}` }, w)));
      if (!words.length) cloud.append(h("div", { class: "s-sub" }, "☁️ " + t("waiting_answers")));
      setAnswered(ans, Object.keys(ansOf()).length);
    } };
  },
  scale(a, r) {
    const avg = h("div", { class: "scale-avg" }), hist = h("div", { class: "hist" }), ans = answeredLine();
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0;align-items:center" }, h("div", { style: "align-self:stretch" }, head(a, r.phase === "closed" ? t("closed") : null), h("div", { class: "s-q" }, a.q)), avg, hist, h("div", { class: "ends" }, h("span", null, "1 · " + (a.left || "")), h("span", null, (a.right || "") + " · 10")), ans);
    return { el, update() {
      const c = Array(10).fill(0); let s = 0, n = 0; for (const x of Object.values(ansOf())) { c[x.v - 1]++; s += x.v; n++; }
      avg.textContent = n ? (s / n).toFixed(1) : "–"; const max = Math.max(1, ...c);
      hist.replaceChildren(...c.map((k, i) => h("div", null, k ? String(k) : "", h("i", { style: `height:${(k / max) * 100}%;min-height:4px` }), String(i + 1))));
      setAnswered(ans, n);
    } };
  },
  open(a, r) {
    const wall = h("div", { class: "wall" }); const hidden = (r.hidden = r.hidden || []);
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0" }, head(a, r.phase === "closed" ? t("closed") : null), h("div", { class: "s-q", style: "font-size:clamp(24px,3.2vw,48px)" }, a.q), wall);
    return { el, update() {
      const items = []; for (const [pid, L] of Object.entries(ansOf())) L.forEach((x, i) => { const id = pid + ":" + i; if (!hidden.includes(id)) items.push([id, x]); });
      wall.replaceChildren(...items.map(([id, x], i) => h("div", { class: "note", style: "background:" + NOTE_COLORS[i % NOTE_COLORS.length] }, x,
        h("button", { type: "button", "aria-label": t("hide"), title: t("hide"), onclick: () => { hidden.push(id); saveLive(); stageUpdate(); } }, "✕"))));
      if (!items.length) wall.append(h("div", { class: "s-sub" }, "💬 " + t("waiting_answers")));
    } };
  },
  prayer(a, r) {
    const n = h("div", { class: "scale-avg" });
    const el = h("div", { class: "s-center" }, head(a, r.phase === "closed" ? t("closed") : null), h("div", { class: "s-q" }, a.q), n,
      h("div", { class: "s-sub" }, t("prayer_stage")),
      h("button", { class: "btn", type: "button", style: "margin-top:2vh", onclick: openPrivate }, "🔒 " + t("read_prayers")));
    return { el, update() { let k = 0; for (const L of Object.values(ansOf())) k += L.length; n.textContent = "🙏 " + k; } };
  },
  qa(a) {
    const list = h("div", { class: "qa-list" });
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0" }, head(a), h("div", { class: "s-q", style: "font-size:clamp(24px,3.2vw,48px)" }, a.q || t("def_qa")), list);
    return { el, update() {
      const qs = S.qa.filter((q) => !q.hidden).sort((x, y) => (x.done - y.done) || (y.votes.length - x.votes.length));
      list.replaceChildren(...qs.map((q) => h("div", { class: "qa" + (q.done ? " done" : "") }, h("div", { class: "v" }, "👍" + q.votes.length),
        h("div", { class: "tx" }, q.text, q.jv ? h("div", { class: "jv-ans" }, "🤖 " + q.jv) : null),
        h("button", { type: "button", title: t("jv_ask"), onclick: () => jvAnswer(q) }, "🤖"),
        h("button", { type: "button", title: t("answered_mark"), onclick: () => { q.done = !q.done; qaChanged(); } }, q.done ? "↺" : "✓"),
        h("button", { type: "button", title: t("hide"), "aria-label": t("hide"), onclick: () => { q.hidden = true; qaChanged(); } }, "✕"))));
      if (!qs.length) list.append(h("div", { class: "s-sub", style: "text-align:center;margin-top:6vh" }, "🙋 " + t("qa_empty")));
    } };
  },
  verse(a, r) {
    const fin = h("div", { class: "finish" });
    const top = r.phase === "reveal"
      ? h("div", { class: "s-center", style: "flex:none" }, h("div", { class: "verse-big" }, "“" + a.text + "”"), h("div", { class: "s-sub", style: "font-weight:800;color:var(--sun)" }, a.ref))
      : h("div", { class: "s-center", style: "flex:none" }, h("div", { class: "slide-title" }, a.ref || tn("verse")), h("div", { class: "s-sub" }, r.phase === "ready" ? t("verse_ready") : t("verse_go")));
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0;gap:2vh" }, head(a), top, fin);
    return { el, update() {
      const L = Object.entries(ansOf()).sort((x, y) => x[1].rank - y[1].rank).slice(0, r.phase === "reveal" ? 5 : 8);
      fin.replaceChildren(...L.map(([pid, x]) => { const p = S.players[pid]; return h("div", null, h("span", null, ["🥇", "🥈", "🥉"][x.rank - 1] || "#" + x.rank), p.emoji + " " + p.name, h("span", { style: "margin-left:auto;color:var(--st-dim)" }, (x.ms / 1000).toFixed(1) + "s")); }));
    } };
  },
  tap(a, r) {
    if (r.phase === "count") {
      const n = h("div", { class: "countdown" });
      return { el: h("div", { class: "s-center" }, head(a), n), tick(now) { const s = Math.max(1, Math.ceil((r.countAt - now) / 1000)); if (n.textContent !== String(s)) { n.textContent = s; sfx.tick(); } } };
    }
    const race = h("div", { class: "race" }), timer = h("div", { class: "timer" });
    const title = r.phase === "reveal" && r.win != null
      ? h("div", { class: "slide-title", style: "text-align:center;color:" + TEAMS[r.win].c }, TEAMS[r.win].e + " " + t("team_wins", { t: TEAMS[r.win].n }))
      : h("div", { class: "qhead" }, h("div", { class: "s-q" }, a.q || tn("tap")), r.phase === "open" ? timer : null);
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0;gap:2vh;justify-content:center" }, head(a), title, race,
      r.phase === "ready" ? h("div", { class: "s-sub", style: "text-align:center" }, t("tap_ready")) : null);
    return { el,
      tick(now) { if (r.phase === "open") timer.textContent = Math.max(0, Math.ceil((r.endAt - now) / 1000)); },
      update() {
        const per = tapTeams(r), n = TEAMS.map(() => 0); for (const p of Object.values(S.players)) n[p.team]++;
        race.replaceChildren(barsView(TEAMS.map((tm, i) => [tm.e, " ", tm.n, h("span", { style: "opacity:.7;font-size:.7em" }, " (" + n[i] + ")")]), TEAMS.map((x) => x.c), per, { raw: true, right: r.phase === "reveal" ? r.win : null }));
      } };
  },
  board(a) {
    const el = h("div", { style: "display:flex;flex-direction:column;flex:1;min-height:0;gap:2vh" }, head(a), h("div", { class: "board", id: "boardBox" }));
    return { el, update() {
      const tot = teamTotals(), order = TEAMS.map((_, i) => i).sort((x, y) => tot[y] - tot[x]);
      el.querySelector("#boardBox").replaceChildren(
        h("div", null, h("h3", null, t("teams")), barsView(order.map((i) => [TEAMS[i].e, " ", TEAMS[i].n]), order.map((i) => TEAMS[i].c), order.map((i) => tot[i]), { raw: true })),
        h("div", null, h("h3", null, t("top_players")), h("div", { class: "podium" }, ranked().slice(0, 6).map(([, p], i) => h("div", null, ["🥇", "🥈", "🥉"][i] || i + 1 + ".", p.emoji, " ", p.name, h("b", null, p.score))))));
    } };
  },
};

// --- results file ---
function downloadSummary(s) {
  if (!s || !s.kit) return;
  const L = [];
  L.push("GUGAH! — " + s.kit.title, [s.kit.date, s.kit.verse].filter(Boolean).join(" · "), t("players") + ": " + Object.keys(s.players || {}).length, "");
  s.kit.acts.forEach((a, i) => {
    const A = (s.ans || {})[i] || {}, r = (s.run || {})[i] || {};
    if (a.type === "slide" || a.type === "board") return;
    L.push("== " + (i + 1) + ". " + tn(a.type) + ": " + actLabel(a));
    if (a.type === "poll" || a.type === "quiz") { const c = a.options.map(() => 0); for (const x of Object.values(A)) c[x.v]++; a.options.forEach((o, j) => L.push("  " + (a.type === "quiz" && j === a.correct ? "✓ " : "  ") + o + ": " + c[j])); }
    if (a.type === "scale") { const v = Object.values(A).map((x) => x.v); L.push("  " + t("average") + ": " + (v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(1) : "–") + " (" + v.length + ")"); }
    if (a.type === "words") { const cnt = {}; for (const W of Object.values(A)) for (const w of W) cnt[w] = (cnt[w] || 0) + 1; L.push("  " + Object.entries(cnt).sort((x, y) => y[1] - x[1]).map(([w, n]) => w + (n > 1 ? " ×" + n : "")).join(", ")); }
    if (a.type === "open" || a.type === "prayer") for (const W of Object.values(A)) for (const x of W) L.push("  - " + x.replace(/\n/g, " "));
    if (a.type === "verse") L.push("  " + t("finished") + ": " + Object.keys(A).length);
    if (a.type === "tap" && r.win != null) L.push("  " + t("team_wins", { t: TEAMS[r.win].n }));
    L.push("");
  });
  L.push("== " + t("type_qa"));
  for (const q of (s.qa || []).slice().sort((a, b) => b.votes.length - a.votes.length)) L.push("  [👍" + q.votes.length + "] " + q.text + (q.done ? " ✓" : ""));
  L.push("", "== " + t("teams"));
  const tot = TEAMS.map(() => 0); for (const p of Object.values(s.players || {})) tot[p.team] += p.score;
  TEAMS.forEach((tm, i) => L.push("  " + tm.n + ": " + tot[i]));
  L.push("", "== " + t("top_players"));
  Object.values(s.players || {}).sort((a, b) => b.score - a.score).slice(0, 10).forEach((p, i) => L.push("  " + (i + 1) + ". " + p.name + " — " + p.score));
  download("Gugah " + (s.kit.date || "") + " " + s.kit.title.replace(/[^\w\- ]+/g, "").trim() + ".txt", L.join("\n"));
}

document.addEventListener("keydown", (e) => {
  if (!S || $("#stage").hidden || modalOpen() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); step(); }
  else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); goTo(S.idx - 1); }
  else if (e.key === "f" || e.key === "F") toggleFS();
});

// =====================================================================
// PLAYER (a youth's phone)
// =====================================================================
let P = null;
function startPlayer(code) {
  code = String(code).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  show("player");
  const me = store.get("me", {});
  P = { code, pid: (me.pids || {})[code] || null, name: me.name || "", emoji: me.emoji || pick(AVATARS), team: 0, state: null, qa: [], key: "", tries: 0, ever: false };
  if (P.pid && P.name) connectPlayer(); else renderJoinForm();
}
function renderJoinForm() {
  const root = $("#player"); root.replaceChildren();
  const name = h("input", { class: "pin", type: "text", maxlength: 24, placeholder: t("nick_ph"), value: P.name, "aria-label": t("nickname"), autocomplete: "off" });
  const emo = h("div", { class: "emo", role: "group", "aria-label": t("pick_avatar") });
  const drawEmo = () => emo.replaceChildren(...AVATARS.map((e) => h("button", { type: "button", "aria-pressed": String(P.emoji === e), onclick: () => { P.emoji = e; drawEmo(); } }, e)));
  drawEmo();
  const go = () => {
    P.name = clean(name.value, 24) || randomNick();
    const me = store.get("me", {}); me.name = P.name; me.emoji = P.emoji; store.set("me", me);
    connectPlayer();
  };
  root.append(
    h("div", { class: "ptop" }, h("div", { class: "me" }, h("img", { src: "icon.svg", alt: "", width: 28, height: 28, style: "border-radius:6px" }), h("span", null, "Gugah!")), h("div", { class: "sp", style: "flex:1" }), langSwitch(renderJoinForm)),
    h("div", { class: "pmain", style: "justify-content:flex-start" },
      h("div", { class: "pbig" }, "👋"),
      h("h2", null, t("join_room", { c: P.code })),
      h("p", { class: "hint" }, t("anon_note")),
      h("div", { style: "display:flex;gap:8px" }, name, h("button", { class: "pb", type: "button", style: "flex:none;min-height:0;padding:0 14px", "aria-label": t("random_name"), title: t("random_name"), onclick: () => { name.value = randomNick(); } }, "🎲")),
      h("p", { class: "hint small", style: "margin:0" }, t("pick_avatar")), emo,
      h("button", { class: "psend", type: "button", onclick: go }, t("lets_go") + " 🚀")));
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}
function playerStatus(msg, sub, withChange) {
  P.key = "";
  const root = $("#player"); root.replaceChildren(
    h("div", { class: "pmain" }, h("div", { class: "pbig" }, "📡"), h("h2", null, msg), sub ? h("p", { class: "hint" }, sub) : null,
      withChange ? h("button", { class: "askbtn", type: "button", onclick: () => { location.href = BASE_URL; } }, t("change_code")) : null));
}
function connectPlayer() {
  clearTimeout(P.retryT);
  if (!window.Peer) { playerStatus(t("net_nolib")); return; }
  if (!P.ever) playerStatus(t("connecting"), t("code") + " " + P.code);
  if (!P.peer || P.peer.destroyed) {
    const pr = new Peer({ debug: 0 }); P.peer = pr;
    pr.on("open", () => dial());
    pr.on("disconnected", () => { setTimeout(() => { try { if (!pr.destroyed) pr.reconnect(); } catch {} }, 1500); });
    pr.on("error", (e) => {
      if (P.peer !== pr) return;
      if (e.type === "peer-unavailable") {
        P.tries++;
        if (!P.ever) playerStatus(P.tries > 2 ? t("not_found", { c: P.code }) : t("waiting_teacher"), P.tries > 2 ? t("not_found_sub") : null, P.tries > 2);
        P.retryT = setTimeout(dial, Math.min(8000, 2000 + P.tries * 1000));
      } else if (["network", "server-error", "socket-error", "socket-closed"].includes(e.type)) {
        setOnline(false); P.retryT = setTimeout(() => { try { pr.destroy(); } catch {} P.peer = null; connectPlayer(); }, 4000);
      }
    });
  } else if (P.peer.open) dial();
}
function dial() {
  if (!P.peer || !P.peer.open) return;
  if (P.conn && P.conn.open) return;
  if (P.conn) { const old = P.conn; P.conn = null; try { old.close(); } catch {} }
  const c = P.peer.connect(PEER_PREFIX + P.code.toLowerCase(), { reliable: true });
  P.conn = c; P.dialAt = Date.now();
  c.on("open", () => { P.tries = 0; P.lastMsg = Date.now(); c.send({ t: "hello", pid: P.pid, name: P.name, emoji: P.emoji }); setOnline(true); });
  c.on("data", onHostMsg);
  c.on("close", () => { if (P.conn === c) { P.conn = null; setOnline(false); P.retryT = setTimeout(connectPlayer, 1500); } });
  c.on("error", () => {});
}
function psend(m) { if (P.conn && P.conn.open) { try { P.conn.send(m); return true; } catch {} } toast(t("offline_try")); return false; }
function setOnline(on) { const d = $("#pdot"); if (d) d.classList.toggle("off", !on); }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (wakeLock === null || wakeLock.released) keepAwake();
  if (P && !$("#player").hidden && !(P.conn && P.conn.open)) connectPlayer();
});
// Watchdog: a connection can die silently (phone locked, teacher reloaded). Redial when nothing is heard.
setInterval(() => {
  if (!P || P.ended || !P.name || $("#player").hidden) return;
  const now = Date.now(), open = P.conn && P.conn.open;
  if (open && now - (P.lastMsg || now) > 14000) { setOnline(false); const old = P.conn; P.conn = null; try { old.close(); } catch {} connectPlayer(); }
  else if (!open && P.peer && now - (P.dialAt || 0) > 8000) {
    if (P.peer.destroyed) { P.peer = null; connectPlayer(); }
    else if (P.peer.disconnected) { try { P.peer.reconnect(); } catch {} }
    else if (P.peer.open) dial();
  }
}, 3000);
function onHostMsg(m) {
  if (!m || typeof m !== "object") return;
  P.lastMsg = Date.now();
  if (m.t === "ping") return;
  if (m.t === "welcome") {
    P.pid = m.pid; P.team = m.team; P.name = m.name; P.emoji = m.emoji; P.ever = true;
    const me = store.get("me", {}); me.pids = me.pids || {}; me.pids[P.code] = m.pid; store.set("me", me);
    keepAwake();
  } else if (m.t === "state") { P.state = m; renderPlayer(); }
  else if (m.t === "qa") { P.qa = m.list; if (P.state && P.state.act && P.state.act.type === "qa") { P.state.qa = m.list; renderPlayer(true); } if (P.qaSheet) P.qaSheet(); }
  else if (m.t === "end") { P.ended = true; try { P.peer.destroy(); } catch {} playerEnded(); }
}
function playerEnded() {
  const s = P.state || {};
  $("#player").replaceChildren(h("div", { class: "pmain" }, h("div", { class: "pbig" }, "🙌"), h("h2", null, t("thanks_end")),
    s.score != null ? h("p", { class: "hint" }, t("your_score", { s: s.score, r: s.rank, n: s.of })) : null,
    h("p", { class: "hint" }, "Horas! Tuhan memberkati."),
    h("button", { class: "askbtn", type: "button", onclick: () => (location.href = BASE_URL) }, t("join_another"))));
}
function pTop() {
  const s = P.state || {}, tm = TEAMS[s.team != null ? s.team : P.team];
  return h("div", { class: "ptop" },
    h("div", { class: "me" }, h("i", { class: "status-dot", id: "pdot" }), h("span", null, P.emoji + " " + P.name)),
    h("span", { class: "team", style: "background:" + tm.c }, tm.e + " " + tm.n),
    h("div", { class: "score", id: "pscore" }, "⭐ " + (s.score || 0)));
}
function pFoot() {
  return h("div", null,
    h("button", { class: "askbtn", type: "button", onclick: openAsk }, "🙋 " + t("ask_anon")),
    h("div", { class: "react" }, REACTS.map((e) => h("button", { type: "button", "aria-label": e, onclick: () => { psend({ t: "react", e }); if (navigator.vibrate) navigator.vibrate(15); } }, e))));
}
function renderPlayer(force) {
  const s = P.state; if (!s) return;
  const a = s.act;
  const key = s.idx + "|" + s.phase + "|" + (a ? a.type : "") + "|" + JSON.stringify(s.mine || null) + (a && a.type === "qa" ? "|" + JSON.stringify(s.qa) : "");
  if (key === P.key && !force) { const sc = $("#pscore"); if (sc) sc.textContent = "⭐ " + s.score; return; }
  // keep half-typed text when the screen redraws for the same activity
  const keepTxt = P.key && P.key.split("|")[0] === String(s.idx) && $("#ptxt") ? $("#ptxt").value : "";
  P.key = key;
  if (P.tapT) { clearInterval(P.tapT); P.tapT = 0; }
  const main = h("div", { class: "pmain" });
  fillPlayer(main, s, a);
  $("#player").replaceChildren(pTop(), main, pFoot());
  const tx = $("#ptxt"); if (tx && keepTxt) tx.value = keepTxt;
}
function waitScreen(main, emoji, title, sub) { main.append(h("div", { class: "pbig" }, emoji), h("h2", null, title), sub ? h("p", { class: "hint" }, sub) : null); }
function textForm(main, idx, opts) {
  const ta = h("textarea", { class: "pin", id: "ptxt", rows: opts.rows || 2, maxlength: opts.max, placeholder: opts.ph });
  const btn = h("button", { class: "psend", type: "button", onclick: () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } if (psend({ t: "ans", idx, v })) { ta.value = ""; toast(t("sent")); } } }, opts.btn || t("send"));
  if (opts.single) ta.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); btn.click(); } });
  main.append(ta, btn);
}
function fillPlayer(main, s, a) {
  const tm = TEAMS[s.team];
  if (!a) { waitScreen(main, "🎉", t("youre_in"), t("on_team", { t: tm.e + " " + tm.n })); return; }
  const q = a.q || a.title || "";
  const closed = s.phase === "closed";
  switch (a.type) {
    case "slide": waitScreen(main, "👀", a.title || t("look_up"), t("listen_hint")); break;
    case "board": waitScreen(main, s.rank === 1 ? "🏆" : "⭐", t("your_score_short", { s: s.score }), t("rank_of", { r: s.rank, n: s.of }) + " · " + tm.e + " " + tm.n); break;
    case "poll":
      main.append(h("h2", null, q));
      if (s.mine) main.append(h("div", { class: "pbig" }, "✅"), h("p", { class: "hint" }, t("vote_sent", { o: a.options[s.mine.v] })));
      else if (closed) main.append(h("p", { class: "hint" }, t("closed_msg")));
      else main.append(h("div", { class: "pbtns" }, a.options.map((o, j) => h("button", { class: "pb", type: "button", style: "border-color:" + QCOL[j], onclick: () => psend({ t: "ans", idx: s.idx, v: j }) }, h("span", null, SHAPES[j % 4]), o))));
      break;
    case "quiz":
      if (s.phase === "ready") { waitScreen(main, "⚡", t("get_ready"), q); break; }
      if (s.phase === "reveal") {
        if (!s.mine) waitScreen(main, "⌛", t("no_answer"), t("correct_was", { o: a.options[a.correct] }));
        else main.append(h("div", { class: "result " + (s.mine.ok ? "ok" : "no") }, s.mine.ok ? "✅ " + t("right") + " +" + s.mine.pts : "❌ " + t("wrong")),
          h("p", { class: "hint" }, s.mine.ok ? t("rank_of", { r: s.rank, n: s.of }) : t("correct_was", { o: a.options[a.correct] })));
        if (s.mine && navigator.vibrate) navigator.vibrate(s.mine.ok ? [60, 40, 60] : 200);
        break;
      }
      if (s.mine) { waitScreen(main, "🤞", t("locked_in"), t("look_up")); break; }
      main.append(h("p", { class: "hint", style: "margin:0" }, q), h("div", { class: "pbtns two" }, a.options.map((o, j) => h("button", { class: "pb q", type: "button", style: "background:" + QCOL[j] + ";border-color:" + QCOL[j], "aria-label": o, onclick: () => psend({ t: "ans", idx: s.idx, v: j }) }, h("div", null, SHAPES[j], h("small", null, o))))));
      break;
    case "words":
      main.append(h("h2", null, q));
      if (closed) { main.append(h("p", { class: "hint" }, t("closed_msg"))); break; }
      if (s.mine.n >= 3) { main.append(h("div", { class: "pbig" }, "☁️"), h("p", { class: "hint" }, t("words_done"))); break; }
      textForm(main, s.idx, { max: 30, rows: 1, single: true, ph: t("words_ph"), btn: t("send") + (s.mine.n ? ` (${s.mine.n}/3)` : "") });
      break;
    case "scale": {
      main.append(h("h2", null, q));
      if (closed) { main.append(h("p", { class: "hint" }, s.mine ? t("you_chose", { v: s.mine.v }) : t("closed_msg"))); break; }
      const val = h("div", { class: "sval" }, s.mine ? s.mine.v : 5);
      const sl = h("input", { type: "range", class: "slider", min: 1, max: 10, step: 1, value: s.mine ? s.mine.v : 5, "aria-label": q, oninput: (e) => (val.textContent = e.target.value) });
      main.append(val, sl, h("div", { class: "ends", style: "font-size:14px" }, h("span", null, "1 · " + (a.left || "")), h("span", null, (a.right || "") + " · 10")),
        h("button", { class: "psend", type: "button", onclick: () => { if (psend({ t: "ans", idx: s.idx, v: +sl.value })) toast(t("sent")); } }, s.mine ? t("update") : t("send")));
      break;
    }
    case "open":
      main.append(h("h2", null, q));
      if (closed) { main.append(h("p", { class: "hint" }, t("closed_msg"))); break; }
      if (s.mine.n >= 5) { waitScreen(main, "💬", t("thanks_sharing")); break; }
      main.append(h("p", { class: "hint", style: "margin:0" }, t("open_hint")));
      textForm(main, s.idx, { max: 240, rows: 3, ph: t("open_ph") });
      if (s.mine.n) main.append(h("p", { class: "hint" }, t("n_sent", { n: s.mine.n })));
      break;
    case "prayer":
      main.append(h("div", { class: "pbig" }, "🙏"), h("h2", null, q));
      if (closed) { main.append(h("p", { class: "hint" }, t("closed_msg"))); break; }
      main.append(h("p", { class: "hint", style: "margin:0" }, "🔒 " + t("prayer_private")));
      textForm(main, s.idx, { max: 500, rows: 4, ph: t("prayer_ph") });
      if (s.mine.n) main.append(h("p", { class: "hint" }, t("prayer_sent")));
      break;
    case "qa": {
      main.style.justifyContent = "flex-start";
      main.append(h("h2", null, q || t("def_qa")));
      textForm(main, s.idx, { max: 220, rows: 2, ph: t("ask_ph"), btn: t("ask_send") });
      // questions go through the "ask" message, not an answer
      const btn = main.querySelector(".psend"); btn.onclick = null;
      btn.addEventListener("click", (e) => { e.stopImmediatePropagation(); const ta = $("#ptxt", main); const v = ta.value.trim(); if (!v) return; if (psend({ t: "ask", text: v })) { ta.value = ""; toast(t("asked")); } }, true);
      main.append(qaList(s.qa || P.qa));
      break;
    }
    case "verse": {
      if (s.phase === "ready") { waitScreen(main, "🧩", a.ref || tn("verse"), t("verse_ready_p")); break; }
      if (s.mine) { waitScreen(main, ["🥇", "🥈", "🥉"][s.mine.rank - 1] || "🎉", t("verse_done", { r: s.mine.rank }), "+" + s.mine.pts); break; }
      if (s.phase === "reveal") { waitScreen(main, "📖", a.ref, a.text); break; }
      const order = a.chunks; let pos = 0, miss = 0;
      const built = h("div", { class: "built", "aria-live": "polite" });
      const chips = h("div", { class: "chips" }, shuffle(order.map((c, i) => [c, i])).map(([c]) => {
        const b = h("button", { type: "button", onclick: () => {
          if (c === order[pos]) { b.classList.add("used"); built.textContent = order.slice(0, ++pos).join(" "); if (pos === order.length) psend({ t: "ans", idx: s.idx, v: miss }); }
          else { miss++; b.classList.remove("bad"); void b.offsetWidth; b.classList.add("bad"); if (navigator.vibrate) navigator.vibrate(80); }
        } }, c); return b; }));
      main.style.justifyContent = "flex-start";
      main.append(h("h2", null, "🧩 " + (a.ref || "")), h("p", { class: "hint", style: "margin:0" }, t("verse_how")), built, chips);
      break;
    }
    case "tap": {
      if (s.phase === "ready") { waitScreen(main, "👆", t("tap_get_ready"), t("on_team", { t: tm.e + " " + tm.n })); break; }
      if (s.phase === "count") { waitScreen(main, "⏱️", t("get_ready"), t("tap_soon")); break; }
      if (s.phase === "reveal") { const w = s.mine && s.mine.win; waitScreen(main, w === s.team ? "🏆" : "💪", w != null ? t("team_wins", { t: TEAMS[w].n }) : t("done"), w === s.team ? t("tap_won") : t("tap_lost")); break; }
      let pending = 0, total = 0;
      const cnt = h("div", { class: "sval" }, "0");
      const btn = h("button", { class: "tapbtn", type: "button", style: "background:" + tm.c }, "TAP!");
      btn.addEventListener("pointerdown", (e) => { e.preventDefault(); pending++; total++; cnt.textContent = total; });
      P.tapT = setInterval(() => { if (pending) { psend({ t: "tap", n: pending }); pending = 0; } }, 250);
      main.append(cnt, btn, h("p", { class: "hint" }, t("tap_go")));
      break;
    }
    default: waitScreen(main, "👀", t("look_up"));
  }
}
function qaList(list) {
  return h("div", { class: "pqa" }, (list || []).map((q) => h("button", { type: "button", class: q.me ? "on" : "", disabled: q.own, "aria-pressed": String(q.me), onclick: () => psend({ t: "vote", id: q.id }) },
    h("b", null, "👍" + q.v), h("span", { style: "flex:1" + (q.done ? ";opacity:.5" : "") }, q.text), q.own ? h("small", { class: "hint" }, t("yours")) : null)));
}
function openAsk() {
  const ta = h("textarea", { class: "inp", rows: 3, maxlength: 220, placeholder: t("ask_ph") });
  const listBox = h("div");
  P.qaSheet = () => listBox.replaceChildren(P.qa && P.qa.length ? h("div", null, h("p", { class: "small", style: "font-weight:800;margin:4px 0 8px" }, t("vote_others")), qaList(P.qa)) : "");
  P.qaSheet();
  modal("🙋 " + t("ask_anon"), h("div", { style: "display:flex;flex-direction:column;gap:10px" },
    h("p", { class: "small", style: "color:var(--st-dim)" }, "🔒 " + t("ask_private")), ta,
    h("button", { class: "psend", type: "button", onclick: () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } if (psend({ t: "ask", text: v })) { ta.value = ""; toast(t("asked")); } } }, t("ask_send")),
    listBox), { dark: true, onClose: () => { P.qaSheet = null; } });
}

// =====================================================================
// BOOT
// =====================================================================
(async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get("j")) { startPlayer(params.get("j")); return; }
  renderHome();
  // another app (e.g. the Natal app) can hand over a ready-made session file: ?kit=../natal/quiz.json
  const kitUrl = params.get("kit");
  if (kitUrl) {
    history.replaceState(null, "", location.pathname);
    try {
      const u = new URL(kitUrl, location.href);
      if (u.origin !== location.origin) throw new Error("other site");
      offerKit(await (await fetch(u)).json());
    } catch { toast(t("import_bad")); }
  }
  checkHash();
})();
// a shared session arrives inside the link: #k=...
async function checkHash() {
  const m = location.hash.match(/^#k=([A-Za-z0-9_\-]+)/);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search);
  try { offerKit(await unpackKit(m[1])); } catch { toast(t("import_bad")); }
}
window.addEventListener("hashchange", () => { if ($("#player").hidden) checkHash(); });
function offerKit(k) {
      const close = modal("📥 " + t("shared_title"), h("div", { style: "display:flex;flex-direction:column;gap:12px" },
        h("p", null, t("shared_q", { t: k.title, n: (k.acts || []).length })),
        h("div", { class: "row" }, h("button", { class: "btn pri", type: "button", onclick: () => { close(); addKit(k, true); } }, t("add_mine")), h("button", { class: "btn", type: "button", onclick: () => close() }, t("cancel")))));
}
