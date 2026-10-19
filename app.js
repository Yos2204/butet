// Jarvis: voice assistant with a talking avatar. Brain: Claude API with the user's own key (default), or free Claude through Puter as a backup.
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";
import { startAvatar } from "./avatar.js";

const $ = (id) => document.getElementById(id);
const MODEL = "claude-opus-5-5";

// ---------- storage (best effort) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("butet." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("butet." + k, JSON.stringify(v)); } catch {} },
};
const settings = Object.assign({
  apiKey: "", name: "", voice: "", rate: 1.02, pitch: 0.92,
  speak: true, followUp: false, web: true, deep: false, wake: false, brain: "key", voiceV: 0, avatar: "rings", idVoice: "", listenLang: "id-ID",
}, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
let notes = store.get("notes", []);
let history = store.get("history", []);
// Ignore chat history saved by the short-lived free-only version (different message format).
if (history.some(m => typeof m.content === "string" || m.role === "tool" || m.role === "system")) history = [];

// ---------- shared state + UI ----------
const S = { mode: "idle", speaking: false, wordPulse: 0, style: settings.avatar };
const stateLabels = { idle: "Standing by", waiting: "Say “Jarvis”", listening: "Listening", thinking: "Thinking", speaking: "Speaking", error: "Problem" };
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
  u.onend = end; u.onerror = end;
  synth.speak(u);
}
function stopSpeaking() { if (synth) synth.cancel(); speakQueue = 0; S.speaking = false; }
function afterSpeech() { if (busy) return; setMode("idle"); resumeListening(true); }

// ---------- speech input: wake word + one-shot commands ----------
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
function startRecognizer(kind, auto) {
  if (!SR) { micBlocked("Voice input isn't supported in this browser. Try Chrome on Android or Safari on iPhone, or type below."); return; }
  if (!micOK) return;
  stopListening();
  const r = new SR();
  r.lang = settings.listenLang;
  r.interimResults = true;
  r.continuous = kind === "wake";
  let heard = "";
  recog = r; listenKind = kind;
  r.onstart = () => {
    if (recog !== r) return;
    if (kind === "command") { $("mic").classList.add("live"); setMode("listening"); caption("Listening…", true); }
    else { setMode("waiting"); }
  };
  r.onresult = (e) => {
    if (recog !== r) return;
    if (kind === "command") {
      let txt = ""; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      heard = txt; caption(txt || "Listening…", !txt);
      return;
    }
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]; const txt = res[0].transcript;
      const m = txt.match(WAKE);
      if (!m) continue;
      if (!res.isFinal) { caption(txt, true); continue; }
      const cmd = txt.slice(m.index + m[0].length).trim();
      stopListening();
      chime();
      if (cmd.length > 2) ask(cmd);
      else startRecognizer("command");
      return;
    }
  };
  r.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") { if (recog === r) recog = null; micBlocked(); }
  };
  r.onend = () => {
    $("mic").classList.remove("live");
    if (recog !== r) return; // stopped on purpose
    recog = null; listenKind = null;
    if (kind === "command") {
      if (heard.trim()) { ask(heard.trim()); return; }
      if (!auto) caption("I didn't catch that. Tap to try again.", true);
      setMode("idle");
      resumeListening(false);
    } else if (settings.wake && !busy && !S.speaking && !document.hidden) {
      setTimeout(() => { if (!recog && settings.wake && !busy && !S.speaking) startRecognizer("wake"); }, 250);
    } else setMode("idle");
  };
  try { r.start(); } catch { recog = null; listenKind = null; }
}
// After a reply: optionally listen for a follow-up, otherwise go back to waiting for "Jarvis".
function resumeListening(allowFollowUp) {
  if (busy || S.speaking || document.hidden || !micOK) return;
  if (allowFollowUp && settings.followUp) startRecognizer("command", true);
  else if (settings.wake) startRecognizer("wake");
}
function tapToTalk() {
  unlockAudio();
  if (listenKind === "command") { const r = recog; if (r) try { r.stop(); } catch {} return; }
  if (S.speaking) { stopSpeaking(); setMode("idle"); return; }
  if (busy) abortTurn();
  micOK = !!SR; startRecognizer("command");
}
$("mic").addEventListener("click", tapToTalk);
$("face").addEventListener("click", tapToTalk);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopListening();
  else { if (settings.wake) requestWakeLock(); resumeListening(false); }
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

// ---------- tools Jarvis can use on the phone ----------
const localTools = {
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
function getClient() {
  if (!settings.apiKey) return null;
  if (!client || clientKey !== settings.apiKey) { client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true }); clientKey = settings.apiKey; }
  return client;
}
const persona = () => `You are J.A.R.V.I.S. (Jarvis), a personal AI assistant modelled on Tony Stark's AI butler from Iron Man: calm, capable, quietly witty, with a dry British politeness. Address the user as "${callName()}". Your words are spoken aloud by a voice on the user's phone, so:
- You speak only three languages: Bahasa Indonesia, Bahasa Batak Toba, and English. Reply in whichever of the three the user used. If the user writes in any other language, answer briefly in Bahasa Indonesia that you only speak Indonesian, Batak Toba and English.
- Speech recognition may turn spoken Batak Toba into odd Indonesian-looking text; if a message reads like Batak Toba, treat it as Batak Toba and reply in Batak Toba.
- Reply in plain spoken sentences. No markdown, no lists, no emoji, no URLs unless asked.
- Keep it short: one to three sentences unless the user asks for detail.
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
  if (e instanceof Anthropic.AuthenticationError) return "Your API key was rejected. Check it in Settings.";
  if (e instanceof Anthropic.PermissionDeniedError) return "That API key isn't allowed to use this model.";
  if (e instanceof Anthropic.RateLimitError) return "I'm getting too many requests. Give me a moment and ask again.";
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(e.message || "")) return "Your Claude API account is out of credit. Add credit at console.anthropic.com, then ask again.";
    return "Claude couldn't accept that request. Try clearing the chat in Settings.";
  }
  if (e instanceof Anthropic.APIConnectionError) return "I can't reach the internet right now.";
  if (e instanceof Anthropic.InternalServerError || (e && e.status === 529)) return "Anthropic's servers are busy. Please try again shortly.";
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
  const c = getClient();
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
    if (aborted || e instanceof Anthropic.APIUserAbortError) {
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
  $("avatarStyle").value = settings.avatar;
  $("brain").value = settings.brain; $("keyBox").hidden = settings.brain === "free"; $("freeBox").hidden = settings.brain !== "free"; $("webRow").hidden = settings.brain === "free";
  if (settings.brain === "free") syncAccount();
  $("apiKey").value = settings.apiKey; $("userName").value = settings.name; $("voice").value = settings.voice;
  $("rate").value = settings.rate; $("pitch").value = settings.pitch;
  $("rateVal").textContent = Number(settings.rate).toFixed(2) + "×"; $("pitchVal").textContent = Number(settings.pitch).toFixed(2);
  $("speakOn").checked = settings.speak; $("deep").checked = settings.deep; $("followUp").checked = settings.followUp; $("webOn").checked = settings.web;
}
$("openSettings").onclick = () => openSheet(true);
$("closeSettings").onclick = $("scrim").onclick = () => openSheet(false);
$("brain").onchange = async (e) => { settings.brain = e.target.value; saveSettings(); syncSettingsUI(); if (settings.brain === "free" && await loadPuter()) syncAccount(); };
$("apiKey").oninput = $("apiKey").onchange = (e) => { settings.apiKey = e.target.value.replace(/\s+/g, ""); saveSettings(); };
$("userName").oninput = (e) => { settings.name = e.target.value.slice(0, 40); saveSettings(); };
$("voice").onchange = (e) => { settings.voice = e.target.value; saveSettings(); };
$("avatarStyle").onchange = (e) => { settings.avatar = e.target.value; S.style = settings.avatar; saveSettings(); };
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
$("followUp").onchange = (e) => { settings.followUp = e.target.checked; saveSettings(); };
$("webOn").onchange = (e) => { settings.web = e.target.checked; saveSettings(); };
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
  if (settings.wake) { caption("Wake mode on. Say “Jarvis” followed by your question.", true); if (!busy && !S.speaking) startRecognizer("wake"); }
  else { if (listenKind === "wake") stopListening(); setMode("idle"); caption("Wake mode off.", true); }
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
if (settings.wake && settings.apiKey) caption("Tap WAKE to start listening for \u201cJarvis\u201d again.", true);
settings.wake = false; syncWake();

startAvatar($("face"), S);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
