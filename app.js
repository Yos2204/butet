// Butet: voice assistant with a talking avatar, powered by the Claude API.
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
  speak: true, followUp: false, web: true, deep: false, wake: false,
}, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
let notes = store.get("notes", []);
let history = store.get("history", []);

// ---------- shared state + UI ----------
const S = { mode: "idle", speaking: false, wordPulse: 0 };
const stateLabels = { idle: "Standing by", waiting: "Say “Butet”", listening: "Listening", thinking: "Thinking", speaking: "Speaking", error: "Problem" };
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
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  const sel = $("voice"); sel.innerHTML = "";
  const sorted = voices.slice().sort((a, b) => (b.lang.startsWith("en") - a.lang.startsWith("en")) || a.name.localeCompare(b.name));
  for (const v of sorted) { const o = document.createElement("option"); o.value = v.name; o.textContent = v.name + " (" + v.lang + ")"; sel.appendChild(o); }
  if (!settings.voice || !voices.some(v => v.name === settings.voice)) {
    const prefs = [/daniel/i, /uk english male/i, /arthur/i, /oliver/i, /george/i, /en-GB/i];
    let pick = null;
    for (const p of prefs) { pick = voices.find(v => p.test(v.name) || p.test(v.lang)); if (pick) break; }
    pick = pick || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (pick) settings.voice = pick.name;
  }
  sel.value = settings.voice;
}
if (synth) { loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices); }
function cleanForSpeech(t) {
  return t.replace(/```[\s\S]*?```/g, " ").replace(/[*_#`>|~]/g, "").replace(/\[(.*?)\]\((.*?)\)/g, "$1").replace(/https?:\/\/\S+/g, "link").replace(/\s+/g, " ").trim();
}
function speak(text) {
  if (!synth || !settings.speak) return;
  const clean = cleanForSpeech(text); if (!clean) return;
  stopListening(); // don't let the mic hear Butet talking
  const u = new SpeechSynthesisUtterance(clean);
  const v = voices.find(v => v.name === settings.voice); if (v) { u.voice = v; u.lang = v.lang; }
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
const WAKE = /\b(?:hey |ok |okay |halo |hai )?(butet|butte|butt?et|bootet|boot it|boo tet|bu tet|putet|butet\w*)\b[,.!?]?\s*/i;

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
  r.lang = navigator.language || "en-US";
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
// After a reply: optionally listen for a follow-up, otherwise go back to waiting for "Butet".
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

// ---------- tools Butet can use on the phone ----------
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
const persona = () => `You are Butet, a personal AI assistant in the spirit of J.A.R.V.I.S., Tony Stark's butler AI: calm, capable, quietly witty, with a dry British politeness. Address the user as "${callName()}". Your words are spoken aloud by a voice on the user's phone, so:
- Reply in the language the user speaks to you in (for example English or Indonesian).
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
function abortTurn() { aborted = true; try { currentStream && currentStream.abort(); } catch {} }

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

async function ask(text) {
  unlockAudio();
  if (busy) abortTurn();
  stopSpeaking(); stopListening();
  addMsg("user", text);
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

$("dock").addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) { abortTurn(); stopSpeaking(); return; }
  const t = $("msg").value.trim(); if (!t) return;
  $("msg").value = ""; ask(t);
});

// ---------- settings ----------
function openSheet(open) { $("sheet").hidden = !open; $("scrim").hidden = !open; if (open) syncSettingsUI(); }
function syncSettingsUI() {
  $("apiKey").value = settings.apiKey; $("userName").value = settings.name; $("voice").value = settings.voice;
  $("rate").value = settings.rate; $("pitch").value = settings.pitch;
  $("rateVal").textContent = Number(settings.rate).toFixed(2) + "×"; $("pitchVal").textContent = Number(settings.pitch).toFixed(2);
  $("speakOn").checked = settings.speak; $("deep").checked = settings.deep; $("followUp").checked = settings.followUp; $("webOn").checked = settings.web;
}
$("openSettings").onclick = () => openSheet(true);
$("closeSettings").onclick = $("scrim").onclick = () => openSheet(false);
$("apiKey").onchange = (e) => { settings.apiKey = e.target.value.trim(); saveSettings(); };
$("userName").oninput = (e) => { settings.name = e.target.value.slice(0, 40); saveSettings(); };
$("voice").onchange = (e) => { settings.voice = e.target.value; saveSettings(); };
$("rate").oninput = (e) => { settings.rate = Number(e.target.value); saveSettings(); syncSettingsUI(); };
$("pitch").oninput = (e) => { settings.pitch = Number(e.target.value); saveSettings(); syncSettingsUI(); };
$("speakOn").onchange = (e) => { settings.speak = e.target.checked; saveSettings(); if (!settings.speak) stopSpeaking(); };
$("followUp").onchange = (e) => { settings.followUp = e.target.checked; saveSettings(); };
$("webOn").onchange = (e) => { settings.web = e.target.checked; saveSettings(); };
$("deep").onchange = (e) => { settings.deep = e.target.checked; saveSettings(); };
$("testVoice").onclick = () => { unlockAudio(); stopSpeaking(); speak("At your service, " + callName() + ". All systems are online."); };
$("clearChat").onclick = () => { history = []; store.set("history", history); logEl.innerHTML = ""; greet(); openSheet(false); };

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
  if (settings.wake) { caption("Wake mode on. Say “Butet” followed by your question.", true); if (!busy && !S.speaking) startRecognizer("wake"); }
  else { if (listenKind === "wake") stopListening(); setMode("idle"); caption("Wake mode off.", true); }
};
syncWake();

// ---------- start ----------
function greet() {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  addMsg("ai", part + ", " + callName() + ". Butet online. Ask me anything, set a timer, or have me take a note.");
}
function textOf(m) {
  if (typeof m.content === "string") return m.content;
  return (m.content || []).filter(b => b.type === "text").map(b => b.text).join(" ").trim();
}
const shown = history.filter(m => textOf(m)).slice(-12);
if (shown.length) { for (const m of shown) addMsg(m.role === "user" ? "user" : "ai", textOf(m)); addMsg("sys", "Conversation restored"); }
else greet();
if (!settings.apiKey) caption("Welcome. Open Settings (SET) and add your Claude API key to get started.", true);
// Wake mode needs a tap after each fresh load (browsers require it before using the mic and speaker).
if (settings.wake && settings.apiKey) caption("Tap WAKE to start listening for \u201cButet\u201d again.", true);
settings.wake = false; syncWake();

startAvatar($("face"), S);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
