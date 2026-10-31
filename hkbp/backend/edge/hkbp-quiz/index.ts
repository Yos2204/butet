// Teens Quiz Workbench for Sada (YB 2026-10-31): Claude writes this week's Remaja quiz from the lesson materials.
// The quiz maker in the app queues a job through hk_save "ai" with task "quiz" (hk_ai_jobs); the database trigger hk_ai_kick
// wakes this function with the job id and the cron key (plus the anon JWT, so Verify JWT can stay on). It calls Claude with
// the church's key (hk_settings claude_key, saved by the admin in the app) and stores the questions as JSON in the job;
// the app reads them back with hk_save "ai_get" and puts them in the editor as a draft for the teacher to check.
//
// input: { group_id, day, topic, n (5-20), lang (auto|id|en|bt), diff (easy|mixed|hard), types (both|mcq|tf),
//          text (the lesson files and pasted notes as text), images: [{ mime, data(base64) }] (photos of handouts, at most 3),
//          one: { type, old, others: [...] } to write ONE replacement question instead of a whole quiz }
// result: { title, summary, questions: [{ q, options, answer, explain, type, source }] }  or  { question: {...} }
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const LANGS: Record<string, string> = { id: "Bahasa Indonesia", bt: "Bahasa Batak Toba", en: "English" };

async function db(path: string, opt: RequestInit = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const setting = async (k: string) => { const [r] = await db(`hk_settings?key=eq.${k}&select=value`); return r ? r.value : null; };

function quizPrompt(i: any, hasImages: boolean): string {
  const n = Math.min(20, Math.max(3, Number(i.n) || 10));
  const types = i.types === "tf" ? "true/false only" : i.types === "mcq" ? "multiple choice only" : "a mix: about 70% multiple choice and 30% true/false";
  const lang = LANGS[i.lang] || "the same language the materials are written in (if mixed, the main one)";
  const diff = ({ easy: "easy: recall of key facts, names and events", hard: "challenging: understanding, applying the lesson to a teen's life and connecting ideas, still answerable from the materials" } as Record<string, string>)[i.diff]
    || "mixed: half recall, half understanding and meaning";
  return `You are helping a teacher of the Remaja (teens, ages 12-18) class of HKBP Singapore, a Batak Lutheran church, check what the teens learned this week.
Write a quiz of exactly ${n} questions based ONLY on this week's materials below${hasImages ? " and the attached photos of handouts or slides" : ""}.

Rules:
- Question types: ${types}.
- Difficulty: ${diff}.
- Language: write every question, option and explanation in ${lang}.
- Every question must be answerable from the materials alone. Do not use outside facts. Spread the questions across the whole material, not just the beginning.
- Multiple choice ("mcq"): exactly 4 short options, exactly one correct, believable wrong options, never "all of the above" or "none of the above". Vary which position holds the correct answer.
- True/false ("tf"): options are exactly ["True","False"] translated into the quiz language (Bahasa Indonesia: ["Benar","Salah"]). Balance true and false answers.
- Clear, friendly wording for teens. No trick questions.
- "explanation": one short sentence saying why the answer is right.
- "source": where it comes from in the materials, e.g. "hal. 2", "slide 4", a Bible reference or a section title; "" if unknown.
${i.topic ? "- This week's topic: " + String(i.topic).slice(0, 120) + "\n" : ""}
Reply with only JSON in this shape:
{"title":"short quiz title","summary":"two sentences on what this week covered","questions":[{"type":"mcq","q":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","source":"..."}]}
"answer" is the 0-based index of the correct option.

THIS WEEK'S MATERIALS:
${String(i.text || "").slice(0, 120000) || "(See the attached photos.)"}`;
}
function onePrompt(i: any): string {
  const o = i.one || {};
  const others = (Array.isArray(o.others) ? o.others : []).slice(0, 40).map((q: unknown) => "- " + String(q).slice(0, 300)).join("\n");
  return `Write ONE new quiz question for the Remaja (teens, ages 12-18) class of HKBP Singapore from the materials below.
Type: ${o.type === "tf" ? 'true/false, options exactly ["True","False"] in the quiz language (Bahasa Indonesia: ["Benar","Salah"])' : "multiple choice, exactly 4 short options, one correct"}.
Write it in ${LANGS[i.lang] || "the same language as the existing questions"}, and do not repeat any of these existing questions:
${others || "(none)"}
It replaces this question: ${String(o.old || "").slice(0, 300)}
Answerable from the materials only. Reply with only JSON: {"type":"${o.type === "tf" ? "tf" : "mcq"}","q":"...","options":[...],"answer":0,"explanation":"one short sentence","source":"page/slide/reference or empty"}

MATERIALS:
${String(i.text || "").slice(0, 100000)}`;
}
// The shape the app's quiz editor and hk__quiz use: q, options, answer, explain (+ type and source kept for the editor).
function cleanQuestions(arr: unknown): any[] {
  return (Array.isArray(arr) ? arr : []).map((x: any) => {
    if (!x || typeof x !== "object") return null;
    const type = x.type === "tf" ? "tf" : "mcq";
    let options = (Array.isArray(x.options) ? x.options : []).map((o: unknown) => String(o ?? "").trim()).filter(Boolean).slice(0, 4);
    if (type === "tf" && options.length !== 2) options = ["Benar", "Salah"];
    if (options.length < 2) return null;
    const q = String(x.q || x.question || "").trim(); if (!q) return null;
    let answer = Math.floor(Number(x.answer)); if (!(answer >= 0 && answer < options.length)) answer = 0;
    const explain = String(x.explanation || x.explain || "").trim();
    const source = String(x.source || "").trim();
    return { q: q.slice(0, 400), options, answer, explain: (explain + (source && !explain.includes(source) ? (explain ? " · " : "") + source : "")).slice(0, 300), type, source: source.slice(0, 80) };
  }).filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    const cron = await setting("cron_key");
    if (!cron || req.headers.get("x-cron-key") !== cron) return new Response("forbidden", { status: 403 });
    const { id } = await req.json().catch(() => ({}));
    const [job] = await db(`hk_ai_jobs?id=eq.${Number(id)}&status=eq.queued&task=eq.quiz&select=*`);
    if (!job) return Response.json({ ok: true, skipped: true });
    const fail = async (msg: string) => { await db(`hk_ai_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "error", error: msg.slice(0, 300), done_at: new Date().toISOString() }) }); return Response.json({ ok: false, error: msg }); };
    const key = await setting("claude_key");
    if (!key) return await fail("no_claude_key");
    const input = job.input || {};
    const images = (Array.isArray(input.images) ? input.images : []).filter((im: any) => im && im.data).slice(0, 3);
    if (!String(input.text || "").trim() && !images.length) return await fail("no_material");
    const text = input.one ? onePrompt(input) : quizPrompt(input, images.length > 0);
    const content: any[] = [
      ...images.map((im: any) => ({ type: "image", source: { type: "base64", media_type: im.mime || "image/jpeg", data: String(im.data) } })),
      { type: "text", text },
    ];
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": String(key), "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 8000, messages: [{ role: "user", content }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return await fail((j.error && j.error.message) || `claude_${r.status}`);
    if (j.stop_reason === "refusal") return await fail("declined");
    const txt = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    const m = txt.match(/\{[\s\S]*\}/); if (!m) return await fail("unreadable_reply");
    let raw: any; try { raw = JSON.parse(m[0]); } catch { return await fail("unreadable_reply"); }
    let result: Record<string, unknown>;
    if (input.one) {
      const [question] = cleanQuestions([raw]);
      if (!question) return await fail("unreadable_reply");
      result = { question };
    } else {
      const questions = cleanQuestions(raw.questions);
      if (!questions.length) return await fail("unreadable_reply");
      result = { title: String(raw.title || input.topic || "").slice(0, 120), summary: String(raw.summary || "").slice(0, 600), questions };
    }
    // the photos are not kept in the job once they have been read
    const patch: Record<string, unknown> = { status: "done", result, done_at: new Date().toISOString() };
    if (images.length) patch.input = { ...input, images: images.map((im: any) => ({ mime: im.mime, data: null })) };
    await db(`hk_ai_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return Response.json({ ok: true, id: job.id, n: input.one ? 1 : (result.questions as any[]).length });
  } catch (e) { console.error(e); return Response.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
});
