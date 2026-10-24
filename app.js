// Jarvis: voice assistant with a talking avatar. Brain: Claude API with the user's own key (default), or free Claude through Puter as a backup.
import { startAvatar } from "./avatar.js?v=20";
// The Claude SDK loads on demand, so the app still starts if the CDN is slow or blocked.
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";
let Anthropic = null;
const loadSDK = () => Anthropic ? Promise.resolve(Anthropic) : import(SDK_URL).then((m) => (Anthropic = m.default));
loadSDK().catch(() => {});
window.__jarvisBooted = true;

const $ = (id) => document.getElementById(id);
const MODEL = "claude-opus-5-5";

// ---------- storage (best effort) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("butet." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("butet." + k, JSON.stringify(v)); } catch {} },
};
const settings = Object.assign({
  apiKey: "", name: "", voice: "", rate: 1.02, pitch: 0.92,
  speak: true, followUp: false, web: true, deep: false, wake: false, brain: "key", voiceV: 0, avatar: "auto", avatarV: 0, needName: false, myApps: "", pause: 0.8, idVoice: "", listenLang: "id-ID",
}, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
if (settings.avatarV !== 1) { settings.avatar = "auto"; settings.avatarV = 1; saveSettings(); } // new default: face only while talking
let notes = store.get("notes", []);
let history = store.get("history", []);
// Ignore chat history saved by the short-lived free-only version (different message format).
if (history.some(m => typeof m.content === "string" || m.role === "tool" || m.role === "system")) history = [];

// ---------- shared state + UI ----------
const S = { mode: "idle", speaking: false, wordPulse: 0, style: settings.avatar, photo: null };
// Optional real photo for the talking face (Settings > Look). Kept on this phone only.
function loadPhoto() {
  const p = store.get("photo", null);
  if (!p || !p.src) { S.photo = null; return; }
  const img = new Image(); img.src = p.src; S.photo = { img, mx: p.mx ?? 0.5, my: p.my ?? 0.72 };
}
loadPhoto();
startAvatar($("face"), S);
const stateLabels = { idle: "Off", waiting: "Standby", listening: "Listening", thinking: "Thinking", speaking: "Speaking", error: "Problem" };
function setMode(m) { S.mode = m; $("state").dataset.s = m; $("stateText").textContent = stateLabels[m]; }
const logEl = $("log");
function addMsg(kind, text) {
  const d = document.createElement("div"); d.className = "msg " + kind; d.textContent = text;
  logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; return d;
}
function caption(text, hint) { const c = $("caption"); c.textContent = text; c.classList.toggle("hint", !!hint); c.scrollTop = c.scrollHeight; }
const callName = () => (settings.name || "sir").trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- sound ----------
let audioCtx = null, unlocked = false;
function unlockAudio() {
  if (unlocked) return; unlocked = true;
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch {}
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
}
function chime() {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
    o.type = "sine"; o.frequency.setValueAtTime(660, t); o.frequency.linearRampToValueAtTime(990, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.25);
  } catch {}
}

// ---------- speech output ----------
const synth = window.speechSynthesis || null;
let voices = [], speakQueue = 0;
function fillVoices(selId, prefix, key, prefs) {
  const sel = $(selId); sel.innerHTML = "";
  const list = voices.filter(v => v.lang.toLowerCase().replace("_", "-").startsWith(prefix)).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "Phone default (no " + (prefix === "id" ? "Indonesian" : "English") + " voice installed)"; sel.appendChild(o); }
  for (const v of list) { const o = document.createElement("option"); o.value = v.name; o.textContent = v.name + " (" + v.lang + ")"; sel.appendChild(o); }
  if (!settings[key] || !list.some(v => v.name === settings[key])) {
    let pick = null;
    for (const p of prefs) { pick = list.find(v => p.test(v.name) || p.test(v.lang)); if (pick) break; }
    pick = pick || list[0];
    settings[key] = pick ? pick.name : "";
  }
  sel.value = settings[key];
}
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  // Closest thing to the film's Jarvis: a calm British male voice.
  if (settings.voiceV !== 2 && voices.length) { settings.voice = ""; settings.voiceV = 2; settings.pitch = 0.85; settings.rate = 1.05; saveSettings(); }
  fillVoices("voice", "en", "voice", [/daniel/i, /uk english male/i, /en-gb-x-rjs/i, /en-gb-x-gbd/i, /arthur/i, /oliver/i, /george/i, /malcolm/i, /ryan/i, /thomas/i, /en-GB.*male/i, /en[-_]GB/i]);
  fillVoices("idVoice", "id", "idVoice", [/google/i, /damayanti/i, /ardi/i, /id-ID/i]);
}
// Which language is this sentence in? Indonesian and Batak Toba both use the Indonesian voice.
const ID_WORDS = new Set("yang dan di ke dari tidak aku saya kamu anda ini itu dengan untuk ada bisa sudah akan sedang juga atau karena jadi apa siapa kapan bagaimana berapa sekarang hari jam menit detik baik terima kasih selamat pagi siang sore malam horas ahu ho hamu ndang dang do na ma ni tu molo boi songon jala alai nunga naeng aha ise sadia mauliate tabo ate da".split(" "));
const EN_WORDS = new Set("the and you your is are was were to of it that this for will can have has with what when how sir done minutes seconds timer note today time good morning evening afternoon please".split(" "));
function langOf(text) {
  let id = 0, en = 0;
  for (const w of text.toLowerCase().match(/[a-z]+/g) || []) { if (ID_WORDS.has(w)) id++; if (EN_WORDS.has(w)) en++; }
  if (id === en) return settings.listenLang.startsWith("en") ? "en" : "id";
  return id > en ? "id" : "en";
}
if (synth) { loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices); }
function cleanForSpeech(t) {
  return t.replace(/```[\s\S]*?```/g, " ").replace(/[*_#`>|~]/g, "").replace(/\[(.*?)\]\((.*?)\)/g, "$1").replace(/https?:\/\/\S+/g, "link").replace(/\s+/g, " ").trim();
}
const liveUtts = new Set();
function speak(text) {
  if (!synth || !settings.speak) return;
  const clean = cleanForSpeech(text); if (!clean) return;
  stopListening(); // don't let the mic hear Jarvis talking
  const u = new SpeechSynthesisUtterance(clean);
  const lang = langOf(clean);
  const vName = lang === "id" ? settings.idVoice : settings.voice;
  const v = voices.find(v => v.name === vName);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === "id" ? "id-ID" : "en-US";
  u.rate = settings.rate; u.pitch = settings.pitch;
  speakQueue++;
  u.onstart = () => { S.speaking = true; setMode("speaking"); };
  u.onboundary = () => { S.wordPulse = 1; };
  const end = () => { speakQueue = Math.max(0, speakQueue - 1); if (speakQueue === 0) { S.speaking = false; afterSpeech(); } };
  u.onend = () => { liveUtts.delete(u); end(); }; u.onerror = u.onend;
  liveUtts.add(u); // iPhone drops the 'end' event if the utterance is garbage-collected
  synth.speak(u);
}
function stopSpeaking() { if (synth) synth.cancel(); speakQueue = 0; S.speaking = false; }
function afterSpeech() { if (busy) return; setMode("idle"); setTimeout(resumeListening, 150); } // short gap so the mic doesn't catch the voice's tail

// ---------- speech input: always-on listening + one-shot commands ----------
// WAKE turns the mic on right away and keeps it on. Whatever you say is answered as soon as you pause
// (no wake word needed, unless "Only answer when I say Jarvis" is switched on in Settings).
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listenKind = null, micOK = !!SR;
const WAKE = /\b(?:hey |ok |okay |halo |hai |horas )?(jarvis|jarvas|jervis|javis|jarvi|jarvies|travis|harvis)\b[,.!?]?\s*/i;

function micBlocked(msg) {
  micOK = false; settings.wake = false; saveSettings(); syncWake();
  caption(msg || "I can't use the microphone. Allow microphone access for this site in your browser settings, or type below.", true);
  setMode("idle");
}
function stopListening() {
  listenKind = null;
  if (recog) { const r = recog; recog = null; try { r.abort(); } catch {} }
}
// Conversation mode: saying "Jarvis" (or tapping WAKE or the face) starts a conversation. From then on
// everything you say is answered, until you say "Done" (or "selesai" / "cukup"). Then Jarvis goes back
// to standby and waits for its name again.
let inConvo = false;
const STOP = /^\s*(?:ok(?:ay)?|oke|baik|thanks?|thank you|terima kasih)?[\s,]*(?:jarvis[\s,]*)?(?:done|i'?m done|we'?re done|that'?s all|that is all|stop|selesai|sudah selesai|udah selesai|sudah|udah|cukup|sudah cukup|udah cukup)[\s,]*(?:jarvis|thanks?|thank you|terima kasih)?[\s.!]*$/i;
function endConvo(text) {
  inConvo = false;
  const bye = langOf(text) === "id" && !/\b(done|that|stop)\b/i.test(text)
    ? "Baik, saya standby. Panggil \u201cJarvis\u201d kalau butuh saya."
    : "Very good, " + callName() + ". I'll be on standby.";
  addMsg("sys", "Conversation ended"); addMsg("ai", bye); caption(bye); chime(); speak(bye);
  if (!synth || !settings.speak) resumeListening();
}
// What to do with a finished utterance.
function handleHeard(text, auto) {
  text = text.trim();
  if (STOP.test(text)) { endConvo(text); return; }
  const m = text.match(WAKE);
  if (auto && !inConvo) {
    if (!m) { resumeListening(); return; } // on standby: ignore anything that isn't for Jarvis
    inConvo = true;
  }
  const cmd = m && m.index < 12 ? (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).trim() : text;
  if (cmd.replace(/[^\p{L}\p{N}]/gu, "").length < 2) { chime(); caption(langOf(text) === "id" ? "Ya?" : "Yes?", true); startRecognizer(auto); return; }
  ask(cmd);
}
function startRecognizer(auto) {
  if (!SR) { micBlocked("Voice input isn't supported in this browser. Try Chrome on Android or Safari on iPhone, or type below."); return; }
  if (!micOK) return;
  stopListening();
  const r = new SR();
  r.lang = settings.listenLang;
  r.interimResults = true;
  r.continuous = true;
  r.maxAlternatives = 1;
  let heard = "", done = false, silence = null;
  recog = r; listenKind = "command"; r._born = Date.now(); r._last = 0;
  const finish = () => {
    if (done || recog !== r) return;
    done = true; clearTimeout(silence);
    const text = heard; stopListening(); $("mic").classList.remove("live");
    if (text.trim()) handleHeard(text, auto);
  };
  r.onstart = () => {
    if (recog !== r) return;
    r._last = Date.now();
    const standby = auto && !inConvo;
    $("mic").classList.toggle("live", !standby); setMode(standby ? "waiting" : "listening");
    if (standby) caption("Standby. Say \u201cJarvis\u201d to start talking.", true);
    else if (!heard) caption("Listening\u2026", true);
  };
  r.onresult = (e) => {
    if (recog !== r || done) return;
    let txt = ""; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    r._last = Date.now();
    heard = txt; if (txt.trim() && (inConvo || !auto || WAKE.test(txt))) caption(txt);
    // Answer as soon as you pause.
    clearTimeout(silence);
    silence = setTimeout(finish, Math.round(settings.pause * 1000));
  };
  r.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") { if (recog === r) recog = null; micBlocked(); }
  };
  r.onend = () => {
    if (recog !== r) return; // stopped on purpose
    if (heard.trim()) { finish(); return; }
    recog = null; listenKind = null; $("mic").classList.remove("live");
    if (settings.wake && !busy && !S.speaking && !document.hidden) {
      setTimeout(() => { if (!recog && settings.wake && !busy && !S.speaking) startRecognizer(true); }, 120); // keep the mic on
    } else {
      if (!auto) caption("I didn't catch that. Tap to try again.", true);
      setMode("idle");
    }
  };
  try { r.start(); } catch { recog = null; listenKind = null; }
}
// After a reply: keep listening in WAKE mode, or once for a follow-up if that's switched on.
function resumeListening() {
  if (busy || S.speaking || document.hidden || !micOK || recog) return;
  if (settings.wake) startRecognizer(true);
  else if (settings.followUp && inConvo) startRecognizer(false);
}
// Watchdog: phones (iPhone especially) sometimes drop speech events, which used to leave the mic off
// after the first answer. Every 50 ms (about as fast as a phone runs timers), check that the mic is really listening and restart it if not.
let quietSince = 0;
setInterval(() => {
  const wantMic = settings.wake || (settings.followUp && inConvo);
  if (!wantMic || !micOK || document.hidden || busy) { quietSince = 0; return; }
  if (S.speaking || speakQueue > 0) {
    // The voice finished but the phone never said so.
    if (synth && !synth.speaking && !synth.pending) {
      if (!quietSince) quietSince = Date.now();
      else if (Date.now() - quietSince > 400) { quietSince = 0; speakQueue = 0; liveUtts.clear(); S.speaking = false; afterSpeech(); }
    } else quietSince = 0;
    return;
  }
  quietSince = 0;
  const now = Date.now();
  if (recog) {
    const r = recog;
    const stuck = (!r._last && now - r._born > 1500) // never started
      || (r._last && now - r._last > 20000);          // started, but no sound events for a long time
    if (stuck && listenKind === "command") { stopListening(); startRecognizer(settings.wake); }
    return;
  }
  if (settings.wake) startRecognizer(true);
}, 50);
function tapToTalk() {
  unlockAudio();
  if (listenKind === "command" && !settings.wake) { const r = recog; if (r) try { r.stop(); } catch {} return; }
  if (S.speaking) { stopSpeaking(); setMode("idle"); if (settings.wake) startRecognizer(true); return; }
  if (busy) abortTurn();
  micOK = !!SR; chime(); inConvo = true; startRecognizer(settings.wake);
}
$("mic").addEventListener("click", tapToTalk);
$("face").addEventListener("click", tapToTalk);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopListening();
  else { if (settings.wake) requestWakeLock(); resumeListening(); }
});

// ---------- timers ----------
const timers = [];
function renderTimers() {
  const box = $("timers"); box.innerHTML = "";
  for (const t of timers) {
    const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
    const c = document.createElement("span"); c.className = "chip";
    c.textContent = (t.label || "Timer") + " " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    box.appendChild(c);
  }
}
setInterval(() => {
  const now = Date.now();
  for (let i = timers.length - 1; i >= 0; i--) {
    if (timers[i].end <= now) {
      const t = timers.splice(i, 1)[0];
      const line = cap(callName()) + ", your " + (t.label || "timer") + " is done.";
      addMsg("ai", line); caption(line); chime(); speak(line);
      try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {}
    }
  }
  if (timers.length || $("timers").childElementCount) renderTimers();
}, 1000);

// ---------- apps Jarvis can open ----------
// Web apps can't see what's installed, but most phone apps answer to a link (a "URL scheme").
// Names are matched loosely; Indonesian names work too. Any other app: add it in Settings,
// or make an iPhone Shortcut and say "run shortcut <name>".
const APPS = [
  // The HTML workbench is served next to Jarvis, so it opens for anyone using Jarvis on any device.
  { name: "Tata Ibadah Workbench", url: new URL("workbench/", location.href).href, alias: "tata ibadah|workbench|church workbench|liturgi|tata ibadah workbench" },
  // The owner's own copy inside Claude (only opens for the owner's Claude account).
  // Gugah! youth sermon games (teacher screen + phones join by QR code), also served next to Jarvis.
  { name: "Gugah Youth", url: new URL("youth/", location.href).href, alias: "gugah|youth|youth app|youth sermon|pemuda|naposo|remaja|sekolah minggu remaja|kuis pemuda|youth quiz" },
  // Christmas (Natal) app for the youth, also served next to Jarvis.
  { name: "Natal", url: new URL("natal/", location.href).href, alias: "natal|christmas|christmas app|natal naposo|buka natal|advent" },
  { name: "Tata Ibadah Workbench in Claude", url: "https://claude.ai/artifact/85CBgHbEwL7LBAJ8eKR2iH", alias: "workbench in claude|claude workbench|tata ibadah in claude" },
  { name: "WhatsApp", url: "whatsapp://", alias: "wa|whatsapp|watsap" },
  { name: "Telegram", url: "tg://", alias: "telegram" },
  { name: "Instagram", url: "instagram://", alias: "instagram|ig" },
  { name: "Facebook", url: "fb://", alias: "facebook|fb" },
  { name: "Messenger", url: "fb-messenger://", alias: "messenger" },
  { name: "TikTok", url: "snssdk1233://", alias: "tiktok|tik tok" },
  { name: "X", url: "twitter://", alias: "x|twitter" },
  { name: "LinkedIn", url: "linkedin://", alias: "linkedin" },
  { name: "YouTube", url: "youtube://", alias: "youtube" },
  { name: "YouTube Music", url: "youtubemusic://", alias: "youtube music" },
  { name: "Spotify", url: "spotify://", alias: "spotify" },
  { name: "Netflix", url: "nflx://", alias: "netflix" },
  { name: "Apple Music", url: "music://", alias: "music|apple music|musik" },
  { name: "Podcasts", url: "podcasts://", alias: "podcast|podcasts" },
  { name: "Gmail", url: "googlegmail://", alias: "gmail" },
  { name: "Mail", url: "message://", alias: "mail|email|surel" },
  { name: "Outlook", url: "ms-outlook://", alias: "outlook" },
  { name: "Teams", url: "msteams://", alias: "teams|microsoft teams" },
  { name: "Zoom", url: "zoomus://", alias: "zoom" },
  { name: "Google Maps", url: "comgooglemaps://", alias: "google maps|gmaps" },
  { name: "Maps", url: "maps://", alias: "maps|apple maps|peta" },
  { name: "Waze", url: "waze://", alias: "waze" },
  { name: "Gojek", url: "gojek://", alias: "gojek|go jek" },
  { name: "Grab", url: "grab://", alias: "grab" },
  { name: "Tokopedia", url: "tokopedia://", alias: "tokopedia|tokped" },
  { name: "Shopee", url: "shopeeid://", alias: "shopee" },
  { name: "Chrome", url: "googlechrome://", alias: "chrome|google chrome" },
  { name: "Google", url: "https://www.google.com/", alias: "google|safari|browser" },
  { name: "Claude", url: "https://claude.ai/", alias: "claude" },
  { name: "Bible", url: "youversion://", alias: "bible|alkitab|youversion" },
  { name: "Phone", url: "tel:", alias: "phone|telepon|telpon|dialer" },
  { name: "Messages", url: "sms:", alias: "messages|sms|pesan|imessage" },
  { name: "FaceTime", url: "facetime:", alias: "facetime" },
  { name: "Photos", url: "photos-redirect://", alias: "photos|foto|galeri|gallery" },
  { name: "Calendar", url: "calshow://", alias: "calendar|kalender" },
  { name: "Notes", url: "mobilenotes://", alias: "notes|catatan" },
  { name: "Reminders", url: "x-apple-reminderkit://", alias: "reminders|pengingat" },
  { name: "Clock", url: "clock-alarm://", alias: "clock|alarm|jam" },
  { name: "Wallet", url: "shoebox://", alias: "wallet|dompet" },
  { name: "App Store", url: "itms-apps://", alias: "app store|appstore" },
  { name: "Files", url: "shareddocuments://", alias: "files|file" },
  { name: "Shortcuts", url: "shortcuts://", alias: "shortcuts|pintasan" },
];
// Your own apps from Settings: one per line, "Name = link".
function customApps() {
  return String(settings.myApps || "").split("\n").map(l => l.split("=")).filter(p => p.length >= 2 && p[0].trim() && p.slice(1).join("=").trim())
    .map(p => ({ name: p[0].trim(), url: p.slice(1).join("=").trim(), alias: p[0].trim().toLowerCase() }));
}
const norm = (t) => String(t || "").toLowerCase().replace(/\b(the|app|aplikasi|my|saya|ku)\b/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
function findApp(q) {
  const n = norm(q); if (!n) return null;
  const all = [...customApps(), ...APPS];
  for (const a of all) if (norm(a.name) === n || a.alias.split("|").includes(n)) return a;   // exact
  for (const a of all) if (a.alias.split("|").some(x => x.length > 2 && (n.includes(x) || x.includes(n)))) return a; // loose
  return null;
}
function launch(name, url) {
  // Always leave a button in the chat, because phones often block links that open without a tap.
  const row = addMsg("sys", ""); const a = document.createElement("a");
  a.href = url; a.className = "openbtn"; a.textContent = "Open " + name;
  if (/^https?:/.test(url)) { a.target = "_blank"; a.rel = "noopener"; }
  row.appendChild(a);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  setTimeout(() => {
    const sameSite = url.startsWith(location.origin);
    if (!/^https?:/.test(url) || (standalone && !sameSite)) { location.href = url; return; } // apps, or home-screen mode: opens on top of Jarvis
    const w = window.open(url, "_blank"); if (w) try { w.opener = null; } catch {}
    if (!w) caption("Tap “Open " + name + "” below to open it.", true);
  }, 1500); // let Jarvis say it's opening first
}
function openApp(q) {
  const app = findApp(q);
  if (!app) return { error: "No app called '" + q + "' is set up. Known apps: " + [...customApps(), ...APPS].map(a => a.name).join(", ") + ". The user can add any app in Jarvis Settings under 'My apps', or make an iPhone Shortcut that opens it and ask you to run that shortcut." };
  launch(app.name, app.url);
  return { opening: app.name, note: "If the app isn't installed nothing will happen. A button 'Open " + app.name + "' is also in the chat in case the phone blocks it." };
}
function runShortcut(name) {
  name = String(name || "").trim(); if (!name) return { error: "No shortcut name." };
  launch("shortcut " + name, "shortcuts://run-shortcut?name=" + encodeURIComponent(name));
  return { running: name, note: "Runs the user's iPhone Shortcut with that exact name, if it exists." };
}

// ---------- builder: Jarvis writes small apps from spoken instructions ----------
// Each build is one self-contained HTML file, kept on this phone (last 12). The preview runs in a locked-down
// sandbox with its own empty origin, so a built app can never read Jarvis's settings or your API key.
let builds = store.get("builds", []);
const saveBuilds = () => { while (builds.length > 12) builds.shift(); try { localStorage.setItem("butet.builds", JSON.stringify(builds)); } catch { if (builds.length > 1) { builds.shift(); saveBuilds(); } } };
const findBuild = (name) => { const n = norm(name); return builds.slice().reverse().find(b => norm(b.name) === n) || builds.slice().reverse().find(b => n && (norm(b.name).includes(n) || n.includes(norm(b.name)))); };
const BUILD_SYSTEM = `You write complete, working single-file web apps. Output ONLY the HTML document, starting with <!doctype html>, with no explanation and no markdown fences.
- Everything inline in one file (CSS in <style>, JS in <script>). External libraries only from https://cdnjs.cloudflare.com with exact versions, and only when really needed.
- It must work well on a phone screen (viewport meta, touch-friendly, no horizontal scroll) and look polished: clear layout, good spacing, a pleasant colour scheme.
- If the app keeps data, use localStorage wrapped in try/catch and keep working in memory when storage is unavailable (the preview runs in a sandbox without storage).
- No backend, no API keys, no tracking. Text in the language the user's request is written in (Indonesian, Batak Toba or English).
- When given an existing app to change, return the whole updated file, keeping everything the user didn't ask to change.`;
function showBuild(b) {
  let ov = $("buildView");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "buildView";
    ov.innerHTML = '<div class="bvbar"><span id="bvName"></span><button class="iconbtn" id="bvSave">SAVE</button><button class="iconbtn" id="bvClose">CLOSE</button></div><iframe id="bvFrame" sandbox="allow-scripts allow-forms allow-modals"></iframe>';
    document.body.appendChild(ov);
    $("bvClose").onclick = () => { ov.hidden = true; $("bvFrame").srcdoc = ""; };
  }
  $("bvName").textContent = b.name; $("bvFrame").srcdoc = b.html; ov.hidden = false;
  $("bvSave").onclick = () => { // download the file; opened on its own it works fully, saving data included
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([b.html], { type: "text/html" }));
    a.download = (b.name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-").toLowerCase() || "app") + ".html"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
}
function buildButton(b) {
  const row = addMsg("sys", ""); const btn = document.createElement("button");
  btn.type = "button"; btn.className = "openbtn"; btn.textContent = "Open " + b.name; btn.onclick = () => showBuild(b);
  row.appendChild(btn);
}
async function runBuild(name, instructions, base) {
  const note = addMsg("sys", "Building “" + name + "”…");
  try {
    const c = await getClient(); if (!c) throw new Error("no key");
    const content = base
      ? `Here is my app "${base.name}":\n\n${base.html}\n\nChange it like this: ${instructions}`
      : `Build me an app called "${name}". ${instructions}`;
    const stream = c.beta.messages.stream({
      model: MODEL, max_tokens: 32000, system: BUILD_SYSTEM, messages: [{ role: "user", content }],
      thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: { effort: "medium" }, fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
    });
    let n = 0; stream.on("text", (d) => { n += d.length; note.textContent = "Building “" + name + "”… " + Math.round(n / 1000) + "k characters written"; });
    const msg = await stream.finalMessage();
    let html = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    html = html.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
    const i = html.search(/<!doctype html|<html/i); if (i > 0) html = html.slice(i);
    if (!/<html|<body|<script|<div/i.test(html)) throw new Error("no html");
    builds = builds.filter(b => norm(b.name) !== norm(name));
    const b = { name, html, at: new Date().toISOString(), request: instructions.slice(0, 500) };
    builds.push(b); saveBuilds();
    note.textContent = (base ? "Updated" : "Built") + " “" + name + "”";
    buildButton(b);
    const line = base ? "I've updated " + name + ", " + callName() + ". Tap Open to see it." : "Your app " + name + " is ready, " + callName() + ". Tap Open to try it.";
    addMsg("ai", line); if (!busy) { caption(line); chime(); speak(line); }
  } catch (e) {
    const m = e && e.message === "no key" ? "Building apps needs your Claude API key in Settings." : "I couldn't finish building " + name + ". Please try again.";
    note.textContent = "Build failed"; addMsg("err", m); if (!busy) { caption(m, true); speak(m); }
  }
}
function startBuild(i) {
  if (settings.brain === "free" || !settings.apiKey) return { error: "Building apps needs the user's Claude API key (Settings > Brain). It doesn't work in free mode." };
  const instructions = String(i.instructions || "").trim(); if (!instructions) return { error: "No instructions." };
  let name = String(i.name || "").trim().slice(0, 40);
  const base = i.change_existing ? findBuild(name || instructions) : null;
  if (i.change_existing && !base) return { error: "No saved app by that name. Saved apps: " + (builds.map(b => b.name).join(", ") || "none") };
  if (base) name = base.name; if (!name) name = "New app";
  runBuild(name, instructions, base);
  return { started: true, name, note: "Building in the background; it takes about a minute. Jarvis announces when it's ready and shows an Open button." };
}
function sendToClaude(prompt) {
  prompt = String(prompt || "").trim(); if (!prompt) return { error: "Nothing to send." };
  try { navigator.clipboard && navigator.clipboard.writeText(prompt).catch(() => {}); } catch {}
  launch("Claude", "https://claude.ai/new?q=" + encodeURIComponent(prompt));
  return { opened: "Claude", note: "Opens the user's own Claude with the request filled in (also copied to the clipboard in case it shows up empty)." };
}

// ---------- tools Jarvis can use on the phone ----------
const localTools = {
  build_app: {
    description: "Writes a working app (a single web page: tools, games, calculators, trackers, lists, forms, slideshows and so on) from the user's spoken instructions, or changes an app built earlier. Runs in the background for about a minute and then shows an Open button. Ask one short question first only if the request is too vague to build anything sensible.",
    schema: { properties: { name: { type: "string", description: "Short app name, e.g. 'Tithe tracker'" }, instructions: { type: "string", description: "Everything the user wants, in detail, including earlier details from the conversation" }, change_existing: { type: "boolean", description: "true to change an app built earlier (name = that app's name)" } }, required: ["instructions"] },
    run: (i) => startBuild(i),
  },
  list_builds: { description: "Lists apps Jarvis built earlier on this phone, newest last.", run: () => ({ apps: builds.map(b => ({ name: b.name, built: b.at, request: b.request })) }) },
  open_build: {
    description: "Opens an app Jarvis built earlier, full screen.",
    schema: { properties: { name: { type: "string" } }, required: ["name"] },
    run: (i) => { const b = findBuild(i.name); if (!b) return { error: "Not found. Saved apps: " + (builds.map(b => b.name).join(", ") || "none") }; showBuild(b); return { opened: b.name }; },
  },
  send_to_claude: {
    description: "Opens the user's own Claude (claude.ai) with a request filled in, for big jobs Jarvis can't do here: work on their GitHub code, long documents, their Claude projects. Write the prompt in full so Claude has everything it needs.",
    schema: { properties: { prompt: { type: "string" } }, required: ["prompt"] },
    run: (i) => sendToClaude(i.prompt),
  },
  open_app: {
    description: "Opens an app on the user's phone by name, e.g. WhatsApp, YouTube, Spotify, Maps, Phone, Messages, Camera roll (Photos), Gojek, the Natal app (Christmas countdown and programme; aliases: christmas, natal), the Gugah Youth app (live polls, quizzes and games for the youth sermon; aliases: youth, naposo, pemuda, remaja), or the Tata Ibadah Workbench (the church order-of-service app; use 'Tata Ibadah Workbench in Claude' only if they ask for the Claude version). Also opens any app the user added in Settings. Returns the list of known apps if the name isn't found.",
    schema: { properties: { app: { type: "string", description: "The app's name as the user said it" } }, required: ["app"] },
    run: (i) => openApp(i.app),
  },
  run_shortcut: {
    description: "Runs one of the user's iPhone Shortcuts by its exact name. Use for apps open_app doesn't know, if the user has made a Shortcut for them, or when they ask to run a shortcut.",
    schema: { properties: { name: { type: "string" } }, required: ["name"] },
    run: (i) => runShortcut(i.name),
  },
  get_current_time: {
    description: "Returns the user's current local date, time and time zone. Use for any question about the time, date or day.",
    run: () => { const d = new Date(); return { local: d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }; },
  },
  set_timer: {
    description: "Starts a countdown timer on the user's phone that announces itself out loud when done. Returns when it ends.",
    schema: { properties: { seconds: { type: "number", description: "Length in seconds" }, label: { type: "string", description: "Short name, e.g. 'pasta'" } }, required: ["seconds"] },
    run: (i) => { const s = Math.max(1, Math.min(86400, Number(i.seconds) || 0)); const t = { end: Date.now() + s * 1000, label: String(i.label || "timer").slice(0, 40) }; timers.push(t); renderTimers(); return { ok: true, ends: new Date(t.end).toLocaleTimeString() }; },
  },
  cancel_timers: {
    description: "Cancels all running timers. Returns how many were cancelled.",
    run: () => { const n = timers.length; timers.length = 0; renderTimers(); return { cancelled: n }; },
  },
  save_note: {
    description: "Saves a note or reminder on the user's phone for later. Returns the total number of notes.",
    schema: { properties: { text: { type: "string" } }, required: ["text"] },
    run: (i) => { notes.push({ text: String(i.text || "").slice(0, 2000), at: new Date().toISOString() }); store.set("notes", notes); return { saved: true, total: notes.length }; },
  },
  read_notes: { description: "Returns all notes the user saved earlier, oldest first.", run: () => ({ notes }) },
  clear_notes: {
    description: "Deletes all saved notes. Only use when the user clearly asks to delete their notes.",
    run: () => { const n = notes.length; notes = []; store.set("notes", notes); return { deleted: n }; },
  },
  get_battery: {
    description: "Returns the phone's battery level and charging state, if the browser allows it.",
    run: async () => { try { const b = await navigator.getBattery(); return { percent: Math.round(b.level * 100), charging: b.charging }; } catch { return { error: "Battery info isn't available in this browser." }; } },
  },
  get_location: {
    description: "Returns the user's approximate latitude and longitude from the phone (asks permission). Use before a web search for local weather or nearby places.",
    run: () => new Promise((res) => {
      if (!navigator.geolocation) return res({ error: "Location isn't available." });
      navigator.geolocation.getCurrentPosition(
        (p) => res({ latitude: +p.coords.latitude.toFixed(3), longitude: +p.coords.longitude.toFixed(3) }),
        () => res({ error: "The user didn't allow location access." }),
        { timeout: 10000, maximumAge: 600000 });
    }),
  },
};
// The tool list stays the same for the whole conversation (changing it mid-chat would invalidate Claude's earlier reasoning).
const API_TOOLS = [
  ...Object.entries(localTools).map(([name, t]) => ({ name, description: t.description, input_schema: { type: "object", properties: {}, ...(t.schema || {}) } })),
  { type: "web_search_20260209", name: "web_search", max_uses: 3 },
];

// ---------- brain: Claude API ----------
let client = null, clientKey = "";
async function getClient() {
  if (!settings.apiKey) return null;
  await loadSDK();
  if (!client || clientKey !== settings.apiKey) { client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true }); clientKey = settings.apiKey; }
  return client;
}
const persona = () => `You are J.A.R.V.I.S. (Jarvis), a personal AI assistant modelled on Tony Stark's AI butler from Iron Man: calm, capable, quietly witty, with a dry British politeness. Address the user as "${callName()}". Your words are spoken aloud by a voice on the user's phone, so:
- You speak only three languages: Bahasa Indonesia, Bahasa Batak Toba, and English. Reply in whichever of the three the user used. If the user writes in any other language, answer briefly in Bahasa Indonesia that you only speak Indonesian, Batak Toba and English.
- Speech recognition may turn spoken Batak Toba into odd Indonesian-looking text; if a message reads like Batak Toba, treat it as Batak Toba and reply in Batak Toba.
- Reply in plain spoken sentences. No markdown, no lists, no emoji, no URLs unless asked.
- This is a live, spoken back-and-forth conversation. Talk naturally, like a person in the room: react to what they said, remember everything said earlier in the conversation, and ask a short follow-up question when it helps. Keep it short: one to three sentences unless the user asks for detail.
- Speech recognition can mishear words. If a message seems garbled, make your best guess from context, or briefly ask what they meant.
- When the user says \"done\" the app ends the conversation itself; you don't need to handle that.
- When the user asks to open an app (\"open WhatsApp\", \"buka YouTube\", \"open my tata ibadah workbench\"), call open_app and say in a few words that you're opening it. If it isn't known, say so and mention they can add it under My apps in Settings or make a Shortcut for it.
- You can build apps: when the user asks you to make, code or build something (an app, a tool, a game, a page), call build_app with full instructions and say in one sentence that you're on it. To change it later, call build_app with change_existing. You can't see the user's Claude chats, projects or GitHub; for jobs that need those, offer send_to_claude.
- Use your tools when they help: time, timers, notes, battery, location, and web search for current events, weather, scores and facts you aren't sure of. Never invent the time or date; call get_current_time.
- ${settings.web ? "You may search the web when it helps." : "Web search is switched off by the user; don't use it, and say so if they ask for live information."}
- You cannot control other apps, make calls or send messages. If asked, say so briefly and offer what you can do.`;

let busy = false, currentStream = null, aborted = false;
function setSendStop(on) {
  $("send").classList.toggle("stop", on);
  $("send").setAttribute("aria-label", on ? "Stop" : "Send");
  $("sendIcon").innerHTML = on ? '<rect x="7" y="7" width="10" height="10" rx="1"/>' : '<path d="M4 12l16-8-6 16-2-7-8-1z"/>';
}
function abortTurn() { aborted = true; try { currentStream && currentStream.abort(); } catch {} try { freeCtl && freeCtl.abort(); } catch {} }

function errorCopy(e) {
  if (Anthropic && e instanceof Anthropic.AuthenticationError) return "Your API key was rejected. Check it in Settings.";
  if (Anthropic && e instanceof Anthropic.PermissionDeniedError) return "That API key isn't allowed to use this model.";
  if (Anthropic && e instanceof Anthropic.RateLimitError) return "I'm getting too many requests. Give me a moment and ask again.";
  if (Anthropic && e instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(e.message || "")) return "Your Claude API account is out of credit. Add credit at console.anthropic.com, then ask again.";
    return "Claude couldn't accept that request. Try clearing the chat in Settings.";
  }
  if (Anthropic && e instanceof Anthropic.APIConnectionError) return "I can't reach the internet right now.";
  if (Anthropic && e instanceof Anthropic.InternalServerError || (e && e.status === 529)) return "Anthropic's servers are busy. Please try again shortly.";
  return "Something went wrong reaching my brain. Please try again.";
}

function trimHistory() {
  // Keep the conversation from growing forever: cut at a plain user message near the end.
  if (history.length <= 40) return;
  for (let i = history.length - 20; i < history.length; i++) {
    const m = history[i];
    if (m.role === "user" && Array.isArray(m.content) && m.content.some(b => b.type === "text")) { history = history.slice(i); return; }
  }
}

function ask(text) {
  unlockAudio();
  if (busy) abortTurn();
  stopSpeaking(); stopListening();
  addMsg("user", text);
  return settings.brain === "free" ? askFree(text) : askKey(text);
}

async function askKey(text) {
  let c;
  try { c = await getClient(); } catch {
    const m = "I can't load my brain right now. Check your internet and try again.";
    addMsg("err", m); caption(m, true); setMode("idle"); resumeListening(); return;
  }
  if (!c) {
    const m = "I need your Claude API key before I can think. Add it in Settings.";
    addMsg("err", m); caption(m, true); openSheet(true); $("apiKey").focus(); return;
  }
  trimHistory();
  const startLen = history.length;
  history.push({ role: "user", content: [{ type: "text", text }] });
  busy = true; aborted = false; setMode("thinking"); caption("Thinking…", true); setSendStop(true);
  const bubble = addMsg("ai", "…");
  let said = "", spokenUpTo = 0;
  const flush = (final) => {
    const rest = said.slice(spokenUpTo);
    const re = /[^.!?\n]+[.!?]+["')\]]*\s+|[^\n]+\n/g; let m, last = 0;
    while ((m = re.exec(rest))) { if (m[0].trim().length > 1) speak(m[0]); last = re.lastIndex; }
    spokenUpTo += last;
    if (final) { const tail = said.slice(spokenUpTo); if (tail.trim()) speak(tail); spokenUpTo = said.length; }
  };
  try {
    for (let round = 0; round < 8; round++) {
      currentStream = c.beta.messages.stream({
        model: MODEL,
        max_tokens: 4096,
        system: persona(),
        tools: API_TOOLS,
        messages: history,
        thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
        output_config: { effort: settings.deep ? "medium" : "low" },
        fallbacks: "default",
        betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
      });
      currentStream.on("text", (delta) => {
        said += delta; bubble.textContent = said; caption(said);
        logEl.scrollTop = logEl.scrollHeight; flush(false);
      });
      const msg = await currentStream.finalMessage();
      currentStream = null;
      history.push({ role: "assistant", content: msg.content });
      if (msg.stop_reason === "refusal") {
        if (!said.trim()) { said = "I'm afraid I can't help with that one, " + callName() + "."; bubble.textContent = said; }
        break;
      }
      if (msg.stop_reason === "pause_turn") continue; // web search needs another round
      if (msg.stop_reason !== "tool_use") break;
      const results = [];
      for (const b of msg.content) {
        if (b.type !== "tool_use") continue;
        const tool = localTools[b.name];
        let out;
        try { out = tool ? await tool.run(b.input || {}) : { error: "Unknown tool" }; } catch (err) { out = { error: String(err && err.message || err) }; }
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out), ...(out && out.error ? { is_error: true } : {}) });
      }
      history.push({ role: "user", content: results });
      if (said && !/\s$/.test(said)) said += " ";
    }
    flush(true);
    if (!said.trim()) { said = "Done."; bubble.textContent = said; }
    caption(said);
    store.set("history", history);
    busy = false; setSendStop(false);
    if (!speakQueue) afterSpeech();
  } catch (e) {
    currentStream = null; busy = false; setSendStop(false);
    history = history.slice(0, startLen); // roll back the unfinished turn so the history stays valid
    store.set("history", history);
    if (aborted || Anthropic && e instanceof Anthropic.APIUserAbortError) {
      bubble.textContent = (said || "") + " (stopped)"; setMode("idle"); caption("Stopped.", true);
    } else {
      bubble.remove();
      const m = errorCopy(e); addMsg("err", m); caption(m, true); setMode("error"); speak(m);
      console.error(e);
    }
  }
}

// ---------- backup brain: free Claude through Puter (no API key) ----------
// Loaded only when the user picks "Free" in Settings. Each user runs on their own Puter account's monthly allowance.
const FREE_MODELS = { fast: "anthropic/claude-haiku-5-5", smart: "anthropic/claude-sonnet-5-5" };
const FREE_TOOLS = Object.entries(localTools).filter(([n]) => n !== "get_location").map(([name, t]) => ({
  type: "function",
  function: { name, description: t.description, parameters: { type: "object", properties: {}, ...(t.schema || {}) } },
}));
let freeHistory = store.get("freeHistory", []), freeCtl = null, puterLoading = null;
const P = () => window.puter;
function loadPuter() {
  if (P()) return Promise.resolve(true);
  if (!puterLoading) puterLoading = new Promise((res) => {
    const s = document.createElement("script"); s.src = "https://js.puter.com/v2/";
    s.onload = () => res(!!P()); s.onerror = () => { puterLoading = null; res(false); };
    document.head.appendChild(s);
  });
  return puterLoading;
}
function freeSignedIn() { try { return !!(P() && P().auth.isSignedIn()); } catch { return false; } }
function syncAccount() {
  const ok = freeSignedIn();
  $("acctStatus").textContent = ok ? "Signed in. Free mode is ready." : "Not signed in yet.";
  $("signInBtn").textContent = ok ? "Sign out" : "Sign in";
}
$("signInBtn").onclick = async () => {
  if (freeSignedIn()) { try { P().auth.signOut(); } catch {} syncAccount(); return; }
  if (!(await loadPuter())) { $("acctStatus").textContent = "Couldn't load Puter. Check your connection."; return; }
  try { await P().auth.signIn(); } catch {}
  syncAccount();
};
const freePersona = () => persona().replace(/- Use your tools[\s\S]*$/, `- Use your tools when they help: time, timers, notes, battery. Never invent the time or date; call get_current_time.
- You cannot browse the web, see live news or weather, control other apps, make calls or send messages. If asked, say so briefly and offer what you can do.`);
function freeErrorCopy(e) {
  const msg = String((e && (e.error?.message || e.message || e.code)) || e || "");
  if (/insufficient|funds|limit|quota|usage|credit/i.test(msg)) return "You've used up this month's free Puter allowance. Switch to your API key in Settings, or wait for it to refill next month.";
  if (/auth|sign|token|401|403/i.test(msg)) return "I need you to sign in to Puter again. Open Settings and tap Sign in.";
  if (/network|fetch|offline|timeout/i.test(msg)) return "I can't reach the internet right now.";
  return "Something went wrong reaching my brain. Please try again.";
}
async function askFree(text) {
  await loadPuter();
  if (!freeSignedIn()) {
    const m = "Tap “Sign in” in Settings once to use free mode, or switch to your API key.";
    addMsg("err", m); caption(m, true); openSheet(true); return;
  }
  if (freeHistory.length > 40) { const i = freeHistory.findIndex((m, k) => k >= freeHistory.length - 20 && m.role === "user"); if (i > 0) freeHistory = freeHistory.slice(i); }
  const startLen = freeHistory.length;
  freeHistory.push({ role: "user", content: text });
  busy = true; setMode("thinking"); caption("Thinking…", true); setSendStop(true);
  freeCtl = new AbortController();
  const bubble = addMsg("ai", "…");
  let said = "";
  try {
    for (let round = 0; round < 6; round++) {
      const res = await P().ai.chat([{ role: "system", content: freePersona() }, ...freeHistory], {
        model: settings.deep ? FREE_MODELS.smart : FREE_MODELS.fast, max_tokens: 1024,
        tools: FREE_TOOLS, normalize: true, signal: freeCtl.signal,
      });
      const m = res && res.message;
      if (!m) throw new Error("empty response");
      freeHistory.push(m);
      const t = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.filter(b => b && b.type === "text").map(b => b.text).join("") : "";
      if (t.trim()) {
        said += (said ? " " : "") + t.trim(); bubble.textContent = said; caption(said);
        for (const p of (t.match(/[^.!?\n]+[.!?]*["')\]]*\s*/g) || [t])) if (p.trim().length > 1) speak(p);
      }
      const calls = m.tool_calls || [];
      if (!calls.length) break;
      for (const call of calls) {
        const tool = localTools[call.function && call.function.name];
        let input = {}; try { input = JSON.parse(call.function.arguments || "{}"); } catch {}
        let out;
        try { out = tool ? await tool.run(input) : { error: "Unknown tool" }; } catch (err) { out = { error: String(err && err.message || err) }; }
        freeHistory.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
      }
    }
    if (!said.trim()) { said = "Done."; bubble.textContent = said; caption(said); speak(said); }
    store.set("freeHistory", freeHistory);
    busy = false; setSendStop(false);
    if (!speakQueue) afterSpeech();
  } catch (e) {
    busy = false; setSendStop(false);
    freeHistory = freeHistory.slice(0, startLen); store.set("freeHistory", freeHistory);
    if (freeCtl.signal.aborted) { bubble.textContent = (said || "") + " (stopped)"; setMode("idle"); caption("Stopped."
, true); }
    else { bubble.remove(); const m = freeErrorCopy(e); addMsg("err", m); caption(m, true); setMode("error"); speak(m); console.error(e); }
  }
}

$("dock").addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) { abortTurn(); stopSpeaking(); return; }
  const t = $("msg").value.trim(); if (!t) return;
  $("msg").value = ""; ask(t);
});

// ---------- settings ----------
function openSheet(open) { $("sheet").hidden = !open; $("scrim").hidden = !open; if (open) syncSettingsUI(); }
function syncSettingsUI() {
  $("pause").value = settings.pause; $("pauseVal").textContent = Number(settings.pause).toFixed(1) + " s";
  $("avatarStyle").value = settings.avatar;
  $("brain").value = settings.brain; $("keyBox").hidden = settings.brain === "free"; $("freeBox").hidden = settings.brain !== "free"; $("webRow").hidden = settings.brain === "free";
  if (settings.brain === "free") syncAccount();
  $("apiKey").value = settings.apiKey; $("userName").value = settings.name; $("voice").value = settings.voice;
  $("rate").value = settings.rate; $("pitch").value = settings.pitch;
  $("rateVal").textContent = Number(settings.rate).toFixed(2) + "×"; $("pitchVal").textContent = Number(settings.pitch).toFixed(2);
  $("speakOn").checked = settings.speak; $("deep").checked = settings.deep; $("followUp").checked = settings.followUp; $("webOn").checked = settings.web; $("myApps").value = settings.myApps || "";
}
$("openSettings").onclick = () => openSheet(true);
$("closeSettings").onclick = $("scrim").onclick = () => openSheet(false);
$("brain").onchange = async (e) => { settings.brain = e.target.value; saveSettings(); syncSettingsUI(); if (settings.brain === "free" && await loadPuter()) syncAccount(); };
$("apiKey").oninput = $("apiKey").onchange = (e) => { settings.apiKey = e.target.value.replace(/\s+/g, ""); saveSettings(); };
$("userName").oninput = (e) => { settings.name = e.target.value.slice(0, 40); saveSettings(); };
$("voice").onchange = (e) => { settings.voice = e.target.value; saveSettings(); };
$("avatarStyle").onchange = (e) => { settings.avatar = e.target.value; S.style = settings.avatar; saveSettings(); };
function syncPhotoUI() { const has = !!store.get("photo", null); $("photoMark").hidden = !has; $("photoClear").hidden = !has; $("photoPick").textContent = has ? "Change photo" : "Choose photo"; }
$("photoPick").onclick = () => $("photoFile").click();
$("photoFile").onchange = (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
  const img = new Image(); const url = URL.createObjectURL(f);
  img.onload = () => {
    const sc = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    const src = c.toDataURL("image/jpeg", 0.85);
    try { localStorage.setItem("butet.photo", JSON.stringify({ src, mx: 0.5, my: 0.72 })); } catch { caption("That photo is too big to keep. Try a smaller one.", true); return; }
    loadPhoto(); syncPhotoUI(); markMouth();
  };
  img.src = url;
};
$("photoClear").onclick = () => { try { localStorage.removeItem("butet.photo"); } catch {} loadPhoto(); syncPhotoUI(); };
$("photoMark").onclick = () => markMouth();
// Ask the user to tap the mouth once, so the lip-sync moves the right spot.
function markMouth() {
  const p = store.get("photo", null); if (!p) return;
  const ov = document.createElement("div"); ov.id = "markView";
  ov.innerHTML = '<p>Tap the middle of his mouth</p><img alt="Your photo">';
  const im = ov.querySelector("img"); im.src = p.src;
  im.onclick = (e) => {
    const r = im.getBoundingClientRect();
    p.mx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); p.my = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    try { localStorage.setItem("butet.photo", JSON.stringify(p)); } catch {}
    loadPhoto(); ov.remove();
  };
  document.body.appendChild(ov);
}
syncPhotoUI();
$("idVoice").onchange = (e) => { settings.idVoice = e.target.value; saveSettings(); };
function syncLang() { $("langBtn").textContent = settings.listenLang.startsWith("en") ? "EN" : "ID"; $("langBtn").setAttribute("aria-label", "Listening language: " + (settings.listenLang.startsWith("en") ? "English" : "Indonesian or Batak Toba")); }
$("langBtn").onclick = () => {
  settings.listenLang = settings.listenLang.startsWith("en") ? "id-ID" : "en-US"; saveSettings(); syncLang();
  caption(settings.listenLang.startsWith("en") ? "Listening in English." : "Mendengarkan dalam Bahasa Indonesia / Batak Toba.", true);
  if (listenKind) { const k = listenKind; stopListening(); startRecognizer(k); }
};
syncLang();
$("rate").oninput = (e) => { settings.rate = Number(e.target.value); saveSettings(); syncSettingsUI(); };
$("pitch").oninput = (e) => { settings.pitch = Number(e.target.value); saveSettings(); syncSettingsUI(); };
$("speakOn").onchange = (e) => { settings.speak = e.target.checked; saveSettings(); if (!settings.speak) stopSpeaking(); };
$("pause").oninput = (e) => { settings.pause = Number(e.target.value); saveSettings(); $("pauseVal").textContent = settings.pause.toFixed(1) + " s"; };
$("followUp").onchange = (e) => { settings.followUp = e.target.checked; saveSettings(); };
$("webOn").onchange = (e) => { settings.web = e.target.checked; saveSettings(); };
$("myApps").oninput = (e) => { settings.myApps = e.target.value; saveSettings(); };
$("deep").onchange = (e) => { settings.deep = e.target.checked; saveSettings(); };
$("testVoice").onclick = () => { unlockAudio(); stopSpeaking(); speak("At your service, " + callName() + ". All systems are online."); speak("Horas! Jarvis siap membantu kamu hari ini."); };
$("clearChat").onclick = () => { history = []; store.set("history", history); freeHistory = []; store.set("freeHistory", freeHistory); logEl.innerHTML = ""; greet(); openSheet(false); };

let wakeLock = null;
function requestWakeLock() {
  if (!navigator.wakeLock || wakeLock) return;
  navigator.wakeLock.request("screen").then(l => { wakeLock = l; l.addEventListener("release", () => (wakeLock = null)); }).catch(() => {});
}
function syncWake() {
  $("wakeBtn").setAttribute("aria-pressed", String(!!settings.wake));
  if (settings.wake) requestWakeLock();
  else if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
$("wakeBtn").onclick = () => {
  unlockAudio();
  settings.wake = !settings.wake; saveSettings(); micOK = !!SR; syncWake();
  if (settings.wake) { chime(); stopSpeaking(); if (busy) abortTurn(); inConvo = true; startRecognizer(true); }
  else { inConvo = false; stopListening(); $("mic").classList.remove("live"); setMode("idle"); caption("Mic off. Tap WAKE to talk hands-free again.", true); }
};
syncWake();

// ---------- start ----------
function greet() {
  const h = new Date().getHours();
  if (settings.listenLang.startsWith("en")) {
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    addMsg("ai", part + ", " + callName() + ". Jarvis online. Ask me anything, set a timer, or have me take a note.");
  } else addMsg("ai", "Horas, " + callName() + "! Jarvis siap membantu. Tanya apa saja, pasang timer, atau minta aku mencatat.");
}
function textOf(m) {
  if (typeof m.content === "string") return m.content;
  return (m.content || []).filter(b => b.type === "text").map(b => b.text).join(" ").trim();
}
const shown = history.filter(m => textOf(m)).slice(-12);
if (shown.length) { for (const m of shown) addMsg(m.role === "user" ? "user" : "ai", textOf(m)); addMsg("sys", "Conversation restored"); }
else greet();
if (settings.brain === "free") loadPuter().then(syncAccount);
else if (!settings.apiKey) caption("Welcome. Open Settings (SET) and add your Claude API key to get started.", true);
// Wake mode needs a tap after each fresh load (browsers require it before using the mic and speaker).
if (settings.wake && settings.apiKey) caption("Tap WAKE to turn the mic on again.", true);
settings.wake = false; syncWake();

// Other apps (e.g. the Natal app) can open Jarvis with a question ready: ?ask=<text>&lang=id|bt|en.
// Browsers need a tap before Jarvis may speak, so the question is sent on the first tap anywhere.
{
  const q = new URLSearchParams(location.search);
  const pending = (q.get("ask") || "").trim().slice(0, 500);
  const l = q.get("lang");
  if (l === "en" || l === "id" || l === "bt") { settings.listenLang = l === "en" ? "en-US" : "id-ID"; syncLang(); }
  if (q.has("ask") || q.has("lang")) window.history.replaceState(null, "", location.pathname + location.hash); // a reload won't ask again
  if (pending) {
    addMsg("sys", (l === "en" ? "Tap anywhere to ask: " : "Ketuk di mana saja untuk bertanya: ") + pending);
    caption(l === "en" ? "Tap anywhere and I'll answer." : "Ketuk layar, Jarvis akan menjawab.", true);
    const go = (e) => {
      if (e.target.closest && e.target.closest("#sheet, #scrim, #openSettings")) return; // let Settings work normally
      document.removeEventListener("click", go, true);
      e.preventDefault(); e.stopPropagation();
      ask(pending);
    };
    document.addEventListener("click", go, true);
  }
}


if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
window.__jarvisOK = true;
