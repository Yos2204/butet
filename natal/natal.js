// Natal Naposo app: Advent calendar, schedule, programme with a Jarvis MC screen, Kado Silang draw, quiz, Batak words.
// All content lives in data.js. Nothing leaves the phone except links the user chooses to share.
(() => {
"use strict";
const D = window.NATAL;
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem("natal." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("natal." + k, JSON.stringify(v)); } catch {} },
};
const params = new URLSearchParams(location.search);

// ---------- Language ----------
const UI = {
  id: {
    church: "Naposobulung HKBP Singapura", heroTitle: "Selamat Natal!", tab_home: "Beranda", tab_advent: "Adven", tab_schedule: "Jadwal", tab_program: "Acara", tab_kado: "Kado", tab_quiz: "Kuis", tab_batak: "Hata Batak",
    toMain: "Menuju Natal Naposo", toXmas: "Menuju Hari Natal", xmasNow: "Selamat Hari Natal!", days: "hari", hours: "jam", mins: "menit", secs: "detik",
    todayDoor: "Pintu Adven hari ini", openDoor: "Buka pintu", adventSoon: "Kalender Adven dibuka 1 Desember.", adventDays: (n) => `${n} hari lagi`, adventOver: "Adven sudah selesai. Sampai jumpa tahun depan!",
    tileKado: "Undian kado rahasia", tileQuiz: "Main sendiri atau bersama", tileBatak: "Belajar kata Natal Batak",
    greetTitle: "Kirim ucapan Natal", greetLead: "Kirim ucapan tiga bahasa ke keluarga dan teman lewat WhatsApp.", greetBtn: "Kirim ucapan", askJarvis: "Tanya Jarvis",
    greetText: "Horas! Selamat Natal 2026 dan Tahun Baru 2027.\nSelamat Natal jala Selamat Taon Baru!\nMerry Christmas and a Happy New Year!\n\nTuhan Yesus memberkati. – Naposobulung",
    install: "Tip: pasang aplikasi ini di layar HP lewat menu browser, \"Add to Home Screen\".",
    adventTitle: "Kalender Adven", adventLead: "Satu pintu setiap hari, 1 sampai 25 Desember.", streak: (n) => `Beruntun ${n} hari`, openAll: "Guru: buka semua pintu (untuk persiapan)",
    locked: "Pintu ini dibuka tanggal", challenge: "Tantangan hari ini", readVerse: "Baca ayat", markDone: "Sudah saya lakukan", doneMark: "Selesai ✓",
    schedLead: "Jam dan tempat bisa berubah, cek pengumuman gereja. Ketuk kalender untuk menambah ke HP.", addCal: "Tambah ke kalender",
    progTitle: "Acara Natal Naposo", progLead: "Sabtu 19 Desember 2026, 18:00 sampai 20:30. Layar MC menampilkan acara besar-besar dan Jarvis membacakan pengantarnya.", mcOpen: "Buka layar MC dengan Jarvis", mcSpeak: "Jarvis, bicara", mcStop: "Berhenti", prev: "Sebelum", next: "Berikut", by: "Oleh",
    kadoLead: "Panitia menulis semua nama, lalu mengundi. Tiap orang mendapat link rahasia sendiri lewat WhatsApp, jadi tidak ada yang tahu daftar lengkapnya, termasuk panitia.",
    kadoNames: "Nama peserta (satu per baris)", kadoBudget: "Batas harga", kadoWhen: "Kado ditukar", kadoDraw: "Undi sekarang", kadoNeed: "Butuh minimal 3 nama.", kadoDup: "Ada nama yang sama dua kali.",
    kadoDone: (n) => `Undian selesai untuk ${n} orang. Kirim link ke masing-masing. Jangan buka link orang lain.`, kadoSend: "Kirim", kadoCopy: "Salin", kadoSent: "terkirim", kadoRedo: "Undi ulang", kadoRedoSure: "Ketuk lagi untuk undi ulang. Semua link lama jadi tidak berlaku.", kadoClear: "Hapus undian",
    kadoMsg: (g, l) => `Horas ${g}! Ini link Kado Silang-mu. Rahasia, jangan dibagikan:\n${l}`,
    kadoHi: (g) => `Horas, ${g}!`, kadoTap: "Ketuk kado untuk melihat untuk siapa kamu membeli kado.", kadoFor: "Kamu memberi kado untuk", kadoRule: (b, w) => `Batas harga ${b}. Kado ditukar ${w}. Rahasiakan, ya!`, kadoBad: "Link ini tidak bisa dibaca. Minta link baru ke panitia.", kadoBack: "Ke beranda",
    gugahTitle: "Kuis untuk satu ruangan", gugahLead: "Buka sesi Kuis Natal di Gugah. Semua orang ikut dari HP dengan kode QR, dengan papan skor di layar.", gugahBtn: "Buka di Gugah", jarvisQuiz: "Jarvis jadi pembawa kuis",
    soloTitle: "Main sendiri", start: "Mulai", again: "Main lagi", q: "Soal", of: "dari", right: "Benar!", wrong: "Belum tepat.", score: "Skormu", shareScore: "Bagikan skor",
    scoreText: (s, n) => `Skor Kuis Natal saya: ${s}/${n}. Coba kalahkan! `,
    batakLead: "Kata-kata Natal dalam Bahasa Batak Toba. Main tebak arti, lalu pakai di ucapanmu.", batakNote: "Kata-kata Batak di aplikasi ini perlu dicek oleh penatua. Ada saran? Sampaikan ke panitia.",
    gameTitle: "Tebak artinya", gameQ: "Apa arti kata ini?", gameScore: (s, n) => `${s} benar dari ${n}`, listTitle: "Daftar kata",
    jarvisHome: "Jarvis, ceritakan kisah Natal untuk pemuda dalam satu menit, dengan bahasa yang santai.", jarvisQuizAsk: "Jarvis, jadilah pembawa kuis Natal. Tanyakan lima soal tentang kisah Natal satu per satu, dan beri skor.",
    copied: "Disalin", tapAgain: "Ketuk lagi", tz: "Waktu Singapura",
  },
  bt: {
    church: "Naposobulung HKBP Singapura", heroTitle: "Selamat Natal!", tab_home: "Jabu", tab_advent: "Advent", tab_schedule: "Jadwal", tab_program: "Ulaon", tab_kado: "Kado", tab_quiz: "Kuis", tab_batak: "Hata Batak",
    toMain: "Tu Natal Naposo", toXmas: "Tu Ari Natal", xmasNow: "Selamat Ari Natal!", days: "ari", hours: "jam", mins: "menit", secs: "detik",
    todayDoor: "Pintu Advent sadarion", openDoor: "Ungkap pintu", adventSoon: "Kalender Advent diungkap 1 Desember.", adventDays: (n) => `${n} ari nai`, adventOver: "Nunga salpu Advent. Sahat tu taon na ro!",
    tileKado: "Undian silehon-lehon rahasia", tileQuiz: "Sasada manang rap", tileBatak: "Marsiajar hata Natal Batak",
    greetTitle: "Tongos hata Selamat Natal", greetLead: "Tongos hata Selamat Natal tolu hata tu keluarga dohot dongan marhite WhatsApp.", greetBtn: "Tongos", askJarvis: "Sungkun Jarvis",
    greetText: "Horas! Selamat Natal 2026 dohot Selamat Taon Baru 2027.\nSelamat Natal dan Tahun Baru!\nMerry Christmas and a Happy New Year!\n\nTuhan Jesus ma pasupasuhon. – Naposobulung",
    install: "Tip: pasang ma aplikasi on di layar HP marhite menu browser, \"Add to Home Screen\".",
    adventTitle: "Kalender Advent", adventLead: "Sada pintu ganup ari, 1 sahat tu 25 Desember.", streak: (n) => `${n} ari marsitutu`, openAll: "Guru: ungkap sude pintu (lao parade)",
    locked: "Pintu on diungkap di tanggal", challenge: "Tantangan sadarion", readVerse: "Jaha ayat", markDone: "Nunga hubahen", doneMark: "Sidung ✓",
    schedLead: "Boi do muba jam dohot inganan, ida ma tingting ni gareja. Ketuk kalender lao manambai tu HP.", addCal: "Tambai tu kalender",
    progTitle: "Ulaon Natal Naposo", progLead: "Sabtu 19 Desember 2026, 18:00 sahat tu 20:30. Layar MC patuduhon ulaon, jala Jarvis manjaha hata pangantar.", mcOpen: "Ungkap layar MC dohot Jarvis", mcSpeak: "Jarvis, mangkatai", mcStop: "Sip", prev: "Na parjolo", next: "Na mangihut", by: "Sian",
    kadoLead: "Panitia manurat sude goar, dungi mangundi. Ganup jolma mandapot link rahasia marhite WhatsApp, gabe ndang adong na mamboto sude daftar, nang panitia.",
    kadoNames: "Goar ni peserta (sada di ganup baris)", kadoBudget: "Batas arga", kadoWhen: "Silehon-lehon dipasahat", kadoDraw: "Undi nuaeng", kadoNeed: "Ingkon adong tolu goar.", kadoDup: "Adong goar na dua hali.",
    kadoDone: (n) => `Sidung undian di ${n} jolma. Tongos ma link tu ganup jolma. Unang ungkap link ni halak.`, kadoSend: "Tongos", kadoCopy: "Salin", kadoSent: "nunga ditongos", kadoRedo: "Undi muse", kadoRedoSure: "Ketuk muse lao mangundi muse. Sude link na robi ndang marlaku be.", kadoClear: "Hapus undian",
    kadoMsg: (g, l) => `Horas ${g}! On ma link Kado Silang-mu. Rahasia, unang dibagi:\n${l}`,
    kadoHi: (g) => `Horas, ${g}!`, kadoTap: "Ketuk ma silehon-lehon lao mangida tu ise do ho mangalehon.", kadoFor: "Ho mangalehon silehon-lehon tu", kadoRule: (b, w) => `Batas arga ${b}. Dipasahat ${w}. Rahasiahon ma!`, kadoBad: "Ndang boi dijaha link on. Pangido ma link na imbaru tu panitia.", kadoBack: "Tu jabu",
    gugahTitle: "Kuis di sada ruangan", gugahLead: "Ungkap sesi Kuis Natal di Gugah. Sude jolma rap marhite HP dohot kode QR, papan skor di layar.", gugahBtn: "Ungkap di Gugah", jarvisQuiz: "Jarvis gabe pamboan kuis",
    soloTitle: "Sasada", start: "Mamungka", again: "Muse", q: "Sungkun-sungkun", of: "sian", right: "Tingkos!", wrong: "Ndang dope tingkos.", score: "Skormu", shareScore: "Bagi skor",
    scoreText: (s, n) => `Skor Kuis Natal hu: ${s}/${n}. Monangi ma! `,
    batakLead: "Hata Natal di hata Batak Toba. Tebak ma lapatanna, dungi pake ma di hata Selamat Natal-mu.", batakNote: "Hata Batak di aplikasi on ingkon dipareso sintua. Adong saran? Paboa ma tu panitia.",
    gameTitle: "Tebak lapatanna", gameQ: "Aha do lapatan ni hata on?", gameScore: (s, n) => `${s} tingkos sian ${n}`, listTitle: "Daftar hata",
    jarvisHome: "Jarvis, paboa ma barita Natal tu naposo di bagasan sada menit, marhite hata Batak Toba na sederhana.", jarvisQuizAsk: "Jarvis, gabe ma ho pamboan kuis Natal. Sungkun ma lima sungkun-sungkun taringot tu Natal sada-sada, jala lehon skor.",
    copied: "Nunga disalin", tapAgain: "Ketuk muse", tz: "Tingki Singapura",
  },
  en: {
    church: "HKBP Singapore Youth", heroTitle: "Merry Christmas!", tab_home: "Home", tab_advent: "Advent", tab_schedule: "Schedule", tab_program: "Evening", tab_kado: "Gifts", tab_quiz: "Quiz", tab_batak: "Batak",
    toMain: "Countdown to Natal Naposo", toXmas: "Countdown to Christmas", xmasNow: "Merry Christmas!", days: "days", hours: "hours", mins: "min", secs: "sec",
    todayDoor: "Today's Advent door", openDoor: "Open the door", adventSoon: "The Advent calendar opens on 1 December.", adventDays: (n) => `${n} days to go`, adventOver: "Advent is over. See you next year!",
    tileKado: "Secret gift draw", tileQuiz: "Play alone or as a room", tileBatak: "Learn Batak Christmas words",
    greetTitle: "Send a Christmas greeting", greetLead: "Send a three-language greeting to family and friends on WhatsApp.", greetBtn: "Send greeting", askJarvis: "Ask Jarvis",
    greetText: "Merry Christmas and a Happy New Year!\nSelamat Natal 2026 dan Tahun Baru 2027.\nHoras! Selamat Natal jala Selamat Taon Baru!\n\nGod bless you. – Naposobulung",
    install: "Tip: install this app on your phone from the browser menu, \"Add to Home Screen\".",
    adventTitle: "Advent calendar", adventLead: "One door a day, 1 to 25 December.", streak: (n) => `${n}-day streak`, openAll: "Teachers: open every door (for preparation)",
    locked: "This door opens on", challenge: "Today's challenge", readVerse: "Read the verse", markDone: "I did it", doneMark: "Done ✓",
    schedLead: "Times and places may change, so check church announcements. Tap the calendar to add an event to your phone.", addCal: "Add to calendar",
    progTitle: "Natal Naposo evening", progLead: "Saturday 19 December 2026, 18:00 to 20:30. The MC screen shows each item in big letters and Jarvis reads the introduction.", mcOpen: "Open the MC screen with Jarvis", mcSpeak: "Jarvis, speak", mcStop: "Stop", prev: "Back", next: "Next", by: "Led by",
    kadoLead: "The organiser types every name and draws once. Each person gets their own secret link on WhatsApp, so nobody sees the whole list, not even the organiser.",
    kadoNames: "Names (one per line)", kadoBudget: "Price limit", kadoWhen: "Gifts exchanged", kadoDraw: "Draw now", kadoNeed: "Add at least 3 names.", kadoDup: "A name appears twice.",
    kadoDone: (n) => `Draw done for ${n} people. Send each person their link. Don't open anyone else's.`, kadoSend: "Send", kadoCopy: "Copy", kadoSent: "sent", kadoRedo: "Draw again", kadoRedoSure: "Tap again to redraw. All old links stop working.", kadoClear: "Clear the draw",
    kadoMsg: (g, l) => `Horas ${g}! Here is your Kado Silang link. It's secret, don't share it:\n${l}`,
    kadoHi: (g) => `Horas, ${g}!`, kadoTap: "Tap the gift to see who you are buying for.", kadoFor: "You are giving a gift to", kadoRule: (b, w) => `Price limit ${b}. Gifts exchanged ${w}. Keep it secret!`, kadoBad: "This link can't be read. Ask the organiser for a new one.", kadoBack: "Go to home",
    gugahTitle: "Quiz for the whole room", gugahLead: "Open the Christmas Quiz session in Gugah. Everyone joins from their phone with a QR code, with a scoreboard on the screen.", gugahBtn: "Open in Gugah", jarvisQuiz: "Jarvis as quiz master",
    soloTitle: "Play alone", start: "Start", again: "Play again", q: "Question", of: "of", right: "Correct!", wrong: "Not quite.", score: "Your score", shareScore: "Share score",
    scoreText: (s, n) => `My Christmas Quiz score: ${s}/${n}. Beat that! `,
    batakLead: "Christmas words in Batak Toba. Guess the meaning, then use them in your greetings.", batakNote: "The Batak words in this app should be checked by an elder. Suggestions? Tell the committee.",
    gameTitle: "Guess the meaning", gameQ: "What does this word mean?", gameScore: (s, n) => `${s} right out of ${n}`, listTitle: "Word list",
    jarvisHome: "Jarvis, tell the Christmas story for young people in one minute, in a relaxed way.", jarvisQuizAsk: "Jarvis, be our Christmas quiz master. Ask me five questions about the Christmas story one at a time, and keep score.",
    copied: "Copied", tapAgain: "Tap again", tz: "Singapore time",
  },
};
let lang = params.get("lang") || store.get("lang", "id");
if (!UI[lang]) lang = "id";
const t = (k, ...a) => { const v = UI[lang][k] ?? UI.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };
const L = (o) => (o && (o[lang] ?? o.id ?? o.en)) || "";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Dates (always Singapore time) ----------
const MONTHS = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  bt: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const WEEKDAYS = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  bt: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
// ?today=2026-12-05 lets a teacher preview a day.
const sgToday = () => params.get("today") || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
const nowMs = () => params.get("today") ? Date.parse(params.get("today") + "T12:00:00+08:00") : Date.now();
const parts = (iso) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
const fmtDate = (iso) => { const p = parts(iso); return `${WEEKDAYS[lang][p.wd]} ${p.d} ${MONTHS[lang][p.m - 1]} ${p.y}`; };

// ---------- Tabs ----------
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  advent: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M12 13v4M10 15h4"/>',
  schedule: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  program: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  kado: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.5"/>',
  batak: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
};
const TABS = ["home", "advent", "schedule", "program", "kado", "quiz", "batak"];
const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
function renderTabs() {
  $("tabs").innerHTML = TABS.map((k) => `<button data-tab="${k}">${svg(ICONS[k])}<span>${esc(t("tab_" + k))}</span></button>`).join("");
  $("tabs").querySelectorAll("button").forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  markTab();
}
let current = "home";
function go(tab, push = true) {
  if (!TABS.includes(tab)) tab = "home";
  current = tab;
  TABS.forEach((k) => ($(k).hidden = k !== tab));
  markTab();
  if (push && location.hash !== "#" + tab) history.replaceState(null, "", location.pathname + location.search.replace(/([?&])kado=[^&]*/, "$1").replace(/[?&]$/, "") + "#" + tab);
  window.scrollTo(0, 0);
}
function markTab() { $("tabs").querySelectorAll("button").forEach((b) => { if (b.dataset.tab === current) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }); }
document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));

function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove("show"), 2200); }
async function share(text, url) {
  const full = url ? `${text}${text.endsWith("\n") || text.endsWith(" ") ? "" : "\n"}${url}` : text;
  if (navigator.share) { try { await navigator.share(url ? { text, url } : { text }); return true; } catch (e) { if (e && e.name === "AbortError") return false; } }
  window.open("https://wa.me/?text=" + encodeURIComponent(full), "_blank", "noopener");
  return true;
}
async function copy(text) { try { await navigator.clipboard.writeText(text); toast(t("copied")); } catch { prompt("", text); } }
const jarvisUrl = (ask) => new URL("../?ask=" + encodeURIComponent(ask) + "&lang=" + lang, location.href).href;

// ---------- Home ----------
function nextTarget() {
  const now = nowMs();
  const main = Date.parse(D.mainEvent), xmas = Date.parse(D.christmas);
  if (now < main) return { at: main, title: t("toMain"), iso: D.mainEvent.slice(0, 10) };
  if (now < xmas) return { at: xmas, title: t("toXmas"), iso: D.christmas.slice(0, 10) };
  return null;
}
function tick() {
  const tg = nextTarget();
  if (!tg) { $("countTitle").textContent = t("xmasNow"); $("countDate").textContent = ""; $("count").innerHTML = ""; return; }
  $("countTitle").textContent = tg.title; $("countDate").textContent = fmtDate(tg.iso);
  let s = Math.max(0, Math.floor((tg.at - Date.now()) / 1000));
  if (params.get("today")) s = Math.max(0, Math.floor((tg.at - nowMs()) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, sec = s % 60;
  $("count").innerHTML = [[d, t("days")], [h, t("hours")], [m, t("mins")], [sec, t("secs")]].map(([n, l]) => `<div><b>${n}</b><span>${esc(l)}</span></div>`).join("");
}
function adventDay() { // 1..25 during Advent, 0 before, 26 after
  const iso = sgToday(); const p = parts(iso);
  if (p.y < D.year || (p.y === D.year && p.m < 12)) return 0;
  if (p.y > D.year || p.d > 25) return 26;
  return p.d;
}
function renderHome() {
  $("themeLine").textContent = `“${L(D.theme)}” · ${L(D.theme.ref)}`;
  const n = adventDay();
  const card = $("todayCard");
  if (n >= 1 && n <= 25) {
    const a = D.advent[n - 1];
    card.innerHTML = `<div class="small muted">${esc(t("todayDoor"))} · ${n}</div><div class="thought">${esc(L(a.thought))}</div><div class="verse-ref">${esc(L(a.ref))}</div><p><button class="btn primary" id="homeDoor">${esc(t("openDoor"))}</button></p>`;
    $("homeDoor").onclick = () => { go("advent"); openDoor(n); };
  } else if (n === 0) {
    const days = Math.ceil((Date.parse(D.year + "-12-01T00:00:00+08:00") - nowMs()) / 864e5);
    card.innerHTML = `<h3>${esc(t("adventTitle"))}</h3><p class="muted">${esc(t("adventSoon"))} <b class="streak">${esc(t("adventDays", days))}</b></p>`;
  } else card.innerHTML = `<h3>${esc(t("adventTitle"))}</h3><p class="muted">${esc(t("adventOver"))}</p>`;
  const today = sgToday();
  const nx = D.events.find((e) => e.date >= today);
  $("nextEv").textContent = nx ? `${fmtDate(nx.date)}: ${L(nx.title)}` : "";
  $("askJarvisHome").href = jarvisUrl(t("jarvisHome"));
  tick();
}
$("shareGreet").onclick = () => share(t("greetText"), new URL("./", location.href).href);

// ---------- Advent ----------
let done = store.get("advent", {});
function streakCount() {
  let n = Math.min(adventDay(), 25), s = 0;
  if (n < 1) return 0;
  if (!done[n]) n--; // today not done yet doesn't break the streak
  while (n >= 1 && done[n]) { s++; n--; }
  return s;
}
function renderAdvent() {
  const today = adventDay(), all = $("openAll").checked;
  $("doors").innerHTML = D.advent.map((_, i) => {
    const n = i + 1, open = all || n <= today;
    const cls = ["door", n === 25 ? "d25" : "", n === today ? "today" : "", done[n] ? "done" : "", open ? "" : "locked"].join(" ");
    return `<button class="${cls}" data-n="${n}" aria-label="${n}">${n}</button>`;
  }).join("");
  $("doors").querySelectorAll(".door").forEach((b) => (b.onclick = () => openDoor(+b.dataset.n)));
  const s = streakCount();
  $("streak").textContent = s ? t("streak", s) : "";
}
function openDoor(n) {
  const card = $("doorCard"); card.hidden = false;
  const open = $("openAll").checked || n <= adventDay();
  if (!open) {
    card.innerHTML = `<p class="muted">${esc(t("locked"))} <b>${fmtDate(`${D.year}-12-${String(n).padStart(2, "0")}`)}</b>.</p>`;
  } else {
    const a = D.advent[n - 1];
    const ver = lang === "en" ? "111/" : "306/"; // NIV or Terjemahan Baru on bible.com
    const vers = { "111/": "NIV", "306/": "TB" }[ver];
    const link = `https://www.bible.com/bible/${ver}${a.b}.${a.c}.${a.v}.${vers}`;
    card.innerHTML = `<div class="small muted">${n} ${MONTHS[lang][11]} ${D.year}</div>
      <div class="thought">${esc(L(a.thought))}</div>
      <p><span class="verse-ref">${esc(L(a.ref))}</span> · <a href="${link}" target="_blank" rel="noopener">${esc(t("readVerse"))}</a></p>
      <div class="todo"><b>${esc(t("challenge"))}</b>${esc(L(a.todo))}</div>
      <p><button class="btn ${done[n] ? "" : "primary"} block" id="doneBtn">${esc(done[n] ? t("doneMark") : t("markDone"))}</button></p>`;
    $("doneBtn").onclick = () => { if (done[n]) delete done[n]; else done[n] = 1; store.set("advent", done); renderAdvent(); openDoor(n); };
  }
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("openAll").onchange = () => { store.set("openAll", $("openAll").checked); renderAdvent(); };
$("openAll").checked = !!store.get("openAll", false);

// ---------- Schedule ----------
function icsFor(e) {
  const start = new Date(`${e.date}T${e.time}:00+08:00`), end = new Date(start.getTime() + (e.dur || 60) * 60000);
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const clean = (s) => s.replace(/([,;\\])/g, "\\$1");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Natal Naposo//EN", "BEGIN:VEVENT", `UID:${e.date}-${e.time.replace(":", "")}@natal-naposo`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(start)}`, `DTEND:${z(end)}`, `SUMMARY:${clean(L(e.title))}`, `LOCATION:${clean(L(e.place))}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
function renderSchedule() {
  const today = sgToday();
  $("events").innerHTML = D.events.map((e, i) => {
    const p = parts(e.date);
    return `<div class="ev ${e.main ? "main" : ""} ${e.date < today ? "past" : ""}">
      <div class="d"><b>${p.d}</b><span>${MONTHS[lang][p.m - 1]}</span></div>
      <div><div class="t">${esc(L(e.title))}</div><div class="p">${WEEKDAYS[lang][p.wd]} ${e.time} · ${esc(L(e.place))}</div></div>
      <button class="icon-btn" data-i="${i}" aria-label="${esc(t("addCal"))}" title="${esc(t("addCal"))}">${svg(ICONS.advent)}</button></div>`;
  }).join("");
  $("events").querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => {
    const e = D.events[+b.dataset.i];
    const blob = new Blob([icsFor(e)], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `natal-${e.date}.ics`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }));
}

// ---------- Programme + Jarvis MC screen ----------
function renderProgram() {
  $("rundown").innerHTML = D.rundown.map((r) => `<div class="run"><time>${r.time}</time><div><div>${esc(L(r.item))}</div><div class="lead-by">${esc(t("by"))}: ${esc(r.lead)}</div></div></div>`).join("");
}
let mcI = 0;
const synth = window.speechSynthesis;
function pickVoice(l) {
  const vs = synth ? synth.getVoices() : [];
  if (l === "en") {
    const gb = vs.filter((v) => /^en[-_]GB/i.test(v.lang));
    return gb.find((v) => /daniel|arthur|male|george|oliver|ryan/i.test(v.name)) || gb[0] || vs.find((v) => /^en/i.test(v.lang));
  }
  return vs.find((v) => /^id[-_]/i.test(v.lang) || /indonesia/i.test(v.name));
}
function sayLine(text) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(lang); // Batak Toba is read with the Indonesian voice
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === "en" ? "en-GB" : "id-ID";
  u.rate = lang === "en" ? 0.98 : 1; u.pitch = lang === "en" ? 0.9 : 1;
  const b = $("mcSpeak");
  u.onstart = () => { b.classList.add("speaking"); b.firstElementChild.textContent = t("mcStop"); };
  u.onend = u.onerror = () => { b.classList.remove("speaking"); b.firstElementChild.textContent = t("mcSpeak"); };
  synth.speak(u);
}
function renderMc() {
  const r = D.rundown[mcI];
  $("mcWhen").textContent = `${r.time} · ${mcI + 1}/${D.rundown.length}`;
  $("mcWhat").textContent = L(r.item);
  $("mcSay").textContent = `“${L(r.host)}”`;
  $("mcPrev").disabled = mcI === 0; $("mcNext").disabled = mcI === D.rundown.length - 1;
}
$("openMc").onclick = () => { $("mc").classList.add("open"); renderMc(); try { document.documentElement.requestFullscreen?.(); } catch {} };
$("mcClose").onclick = () => { $("mc").classList.remove("open"); synth?.cancel(); try { document.fullscreenElement && document.exitFullscreen(); } catch {} };
$("mcPrev").onclick = () => { if (mcI > 0) { mcI--; synth?.cancel(); renderMc(); } };
$("mcNext").onclick = () => { if (mcI < D.rundown.length - 1) { mcI++; synth?.cancel(); renderMc(); } };
$("mcSpeak").onclick = () => { if (synth?.speaking) synth.cancel(); else sayLine(L(D.rundown[mcI].host)); };
document.addEventListener("keydown", (e) => {
  if (!$("mc").classList.contains("open")) return;
  if (e.key === "ArrowRight") $("mcNext").click(); else if (e.key === "ArrowLeft") $("mcPrev").click(); else if (e.key === " ") { e.preventDefault(); $("mcSpeak").click(); } else if (e.key === "Escape") $("mcClose").click();
});

// ---------- Kado Silang ----------
// A link carries {g: giver, r: recipient, b: budget, w: when}, lightly scrambled so the name isn't readable at a glance.
const KEY = "natal-naposo-2026";
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const xor = (bytes) => bytes.map((x, i) => x ^ KEY.charCodeAt(i % KEY.length));
const encKado = (o) => b64u(xor(new TextEncoder().encode(JSON.stringify(o))));
const decKado = (s) => JSON.parse(new TextDecoder().decode(xor(unb64u(s))));
function drawPairs(names) {
  const a = names.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.map((g, i) => ({ g, r: a[(i + 1) % a.length] })); // one big circle: nobody draws themselves
}
let kado = store.get("kado", null);
const kadoLink = (p) => new URL(`?kado=${encKado({ g: p.g, r: p.r, b: kado.b, w: kado.w })}#kado`, location.href.split("?")[0].split("#")[0]).href;
function renderKado() {
  $("kadoWhen").placeholder = fmtDate(D.mainEvent.slice(0, 10));
  if (!$("kadoWhen").value) $("kadoWhen").value = fmtDate(D.mainEvent.slice(0, 10));
  const list = $("kadoList");
  if (!kado) { list.hidden = true; $("kadoForm").hidden = false; return; }
  $("kadoForm").hidden = true; list.hidden = false;
  list.innerHTML = `<p>${esc(t("kadoDone", kado.pairs.length))}</p>` + kado.pairs.map((p, i) => `<div class="giver"><span class="n">${esc(p.g)}</span>${kado.sent[i] ? `<span class="sent">✓ ${esc(t("kadoSent"))}</span>` : ""}<button class="btn primary" data-send="${i}">${esc(t("kadoSend"))}</button><button class="btn" data-copy="${i}">${esc(t("kadoCopy"))}</button></div>`).join("") +
    `<p class="row" style="margin-top:14px"><button class="btn" id="kadoRedo">${esc(t("kadoRedo"))}</button></p>`;
  list.querySelectorAll("[data-send]").forEach((b) => (b.onclick = async () => {
    const i = +b.dataset.send, p = kado.pairs[i];
    if (await share(t("kadoMsg", p.g, ""), kadoLink(p))) { kado.sent[i] = 1; store.set("kado", kado); renderKado(); }
  }));
  list.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => { const p = kado.pairs[+b.dataset.copy]; copy(t("kadoMsg", p.g, kadoLink(p))); }));
  let armed = false;
  $("kadoRedo").onclick = () => {
    if (!armed) { armed = true; $("kadoRedo").textContent = t("kadoRedoSure"); $("kadoRedo").classList.add("red"); return; }
    $("kadoNames").value = kado.pairs.map((p) => p.g).join("\n"); kado = null; store.set("kado", null); renderKado();
  };
}
$("kadoDraw").onclick = () => {
  const names = $("kadoNames").value.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  if (names.length < 3) return toast(t("kadoNeed"));
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return toast(t("kadoDup"));
  kado = { pairs: drawPairs(names), b: $("kadoBudget").value.trim(), w: $("kadoWhen").value.trim(), sent: {} };
  store.set("kado", kado); renderKado();
};
function renderKadoReveal(code) {
  $("kadoSetup").hidden = true; const box = $("kadoReveal"); box.hidden = false;
  let info; try { info = decKado(code); } catch { info = null; }
  if (!info || !info.g || !info.r) { box.innerHTML = `<div class="card"><p>${esc(t("kadoBad"))}</p></div>`; return; }
  box.innerHTML = `<div class="card gold" style="text-align:center"><h3>${esc(t("kadoHi", info.g))}</h3><p class="muted">${esc(t("kadoTap"))}</p>
    <button class="gift shake" id="giftBtn" aria-label="Open">${giftSvg(false)}</button><div id="giftOut"></div></div>`;
  $("giftBtn").onclick = () => {
    $("giftBtn").classList.remove("shake"); $("giftBtn").innerHTML = giftSvg(true); $("giftBtn").disabled = true;
    $("giftOut").innerHTML = `<p class="muted" style="margin:0">${esc(t("kadoFor"))}</p><div class="reveal-name">${esc(info.r)}</div><p>${esc(t("kadoRule", info.b || "-", info.w || "-"))}</p>`;
  };
}
const giftSvg = (open) => `<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="18" y="52" width="84" height="56" rx="6" fill="#c8322b"/><rect x="54" y="52" width="12" height="56" fill="#f4c25b"/>
  <g transform="${open ? "translate(-10 -26) rotate(-18 60 46)" : ""}"><rect x="12" y="36" width="96" height="18" rx="5" fill="#e0453d"/><rect x="54" y="36" width="12" height="18" fill="#f4c25b"/>
  <path d="M60 36c-8-16-26-16-22-4 3 7 22 4 22 4zm0 0c8-16 26-16 22-4-3 7-22 4-22 4z" fill="#f4c25b"/></g>${open ? '<g fill="#f4c25b"><circle cx="30" cy="20" r="3"/><circle cx="92" cy="14" r="2.5"/><circle cx="100" cy="40" r="2"/><circle cx="18" cy="44" r="2"/></g>' : ""}</svg>`;

// ---------- Quiz (solo) ----------
let qz = null;
function renderQuiz() {
  $("gugahLink").href = new URL("../youth/?kit=../natal/christmas-quiz.json", location.href).href;
  $("askJarvisQuiz").href = jarvisUrl(t("jarvisQuizAsk"));
  const box = $("quizBox");
  if (!qz) { box.innerHTML = `<h3>${esc(t("soloTitle"))}</h3><p class="muted">${D.quiz.length} ${esc(t("q").toLowerCase())}</p><button class="btn primary block" id="qStart">${esc(t("start"))}</button>`; $("qStart").onclick = () => { qz = { i: 0, s: 0, picked: null, order: shuffle(D.quiz.map((_, i) => i)) }; renderQuiz(); }; return; }
  if (qz.i >= qz.order.length) {
    const n = qz.order.length;
    box.innerHTML = `<p class="muted" style="text-align:center;margin:0">${esc(t("score"))}</p><div class="big-score">${qz.s}/${n}</div><div class="row" style="justify-content:center"><button class="btn primary" id="qAgain">${esc(t("again"))}</button><button class="btn" id="qShare">${esc(t("shareScore"))}</button></div>`;
    $("qAgain").onclick = () => { qz = null; renderQuiz(); $("qStart")?.click(); };
    $("qShare").onclick = () => share(t("scoreText", qz.s, n), new URL("./#quiz", location.href).href);
    return;
  }
  const item = D.quiz[qz.order[qz.i]];
  box.innerHTML = `<div class="progress"><i style="width:${(qz.i / qz.order.length) * 100}%"></i></div>
    <div class="small muted">${esc(t("q"))} ${qz.i + 1} ${esc(t("of"))} ${qz.order.length}</div><h3 style="margin-top:4px">${esc(L(item.q))}</h3>
    <div class="opts">${item.o.map((o, i) => `<button class="opt" data-o="${i}">${esc(L(o))}</button>`).join("")}</div><div id="qFb" style="margin-top:12px"></div>`;
  box.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
    if (qz.picked != null) return;
    const i = +b.dataset.o; qz.picked = i;
    const ok = i === item.a; if (ok) qz.s++;
    box.querySelectorAll(".opt").forEach((x) => { const k = +x.dataset.o; if (k === item.a) x.classList.add("right"); else if (k === i) x.classList.add("wrong"); });
    $("qFb").innerHTML = `<div class="row" style="justify-content:space-between"><b style="color:${ok ? "var(--good)" : "var(--bad)"}">${esc(ok ? t("right") : t("wrong"))}</b><button class="btn primary" id="qNext">${esc(t("next"))} ›</button></div>`;
    $("qNext").onclick = () => { qz.i++; qz.picked = null; renderQuiz(); };
  }));
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- Batak words ----------
let wg = { s: 0, n: 0, cur: null, picked: null };
const meaning = (w) => (lang === "en" ? w.m.en : w.m.id);
function newWord() {
  const idx = shuffle(D.words.map((_, i) => i)).slice(0, 4);
  wg.cur = { word: idx[0], opts: shuffle(idx.slice()) }; wg.picked = null;
}
function renderBatak() {
  if (!wg.cur) newWord();
  const w = D.words[wg.cur.word];
  $("wordGame").innerHTML = `<div class="row" style="justify-content:space-between"><h3>${esc(t("gameTitle"))}</h3><span class="small muted">${esc(t("gameScore", wg.s, wg.n))}</span></div>
    <p class="muted small" style="margin:8px 0 2px">${esc(t("gameQ"))}</p><div class="reveal-name" style="font-size:34px">${esc(w.bt)}</div>
    <div class="opts">${wg.cur.opts.map((i) => `<button class="opt" data-w="${i}">${esc(meaning(D.words[i]))}</button>`).join("")}</div><div id="wFb" style="margin-top:12px"></div>`;
  $("wordGame").querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
    if (wg.picked != null) return;
    const i = +b.dataset.w; wg.picked = i; wg.n++; const ok = i === wg.cur.word; if (ok) wg.s++;
    $("wordGame").querySelectorAll(".opt").forEach((x) => { const k = +x.dataset.w; if (k === wg.cur.word) x.classList.add("right"); else if (k === i) x.classList.add("wrong"); });
    $("wFb").innerHTML = `<div class="row" style="justify-content:space-between"><b style="color:${ok ? "var(--good)" : "var(--bad)"}">${esc(ok ? t("right") : t("wrong"))}</b><button class="btn primary" id="wNext">${esc(t("next"))} ›</button></div>`;
    $("wNext").onclick = () => { newWord(); renderBatak(); };
  }));
  $("wordList").innerHTML = `<h3 style="margin-bottom:6px">${esc(t("listTitle"))}</h3>` + D.words.map((x) => `<div class="word"><b>${esc(x.bt)}</b><span>${esc(meaning(x))}</span></div>`).join("");
}

// ---------- Render all ----------
function applyLang() {
  document.documentElement.lang = lang === "bt" ? "bbc" : lang;
  document.querySelectorAll(".langs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
  renderTabs(); renderHome(); renderAdvent(); renderSchedule(); renderProgram(); renderKado(); renderQuiz(); renderBatak();
  if ($("mc").classList.contains("open")) renderMc();
  if (!$("doorCard").hidden) $("doorCard").hidden = true;
  if (params.get("kado")) renderKadoReveal(params.get("kado"));
}
document.querySelectorAll(".langs button").forEach((b) => (b.onclick = () => { lang = b.dataset.lang; store.set("lang", lang); applyLang(); }));
if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) $("installHint").hidden = true;

applyLang();
if (params.get("kado")) go("kado", false); else go((location.hash || "#home").slice(1), false);
window.addEventListener("hashchange", () => go(location.hash.slice(1), false));
setInterval(tick, 1000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
