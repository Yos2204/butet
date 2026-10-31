// Claude jobs for Sada (YB 2026-10-29). The app queues a job in hk_ai_jobs (through hk_save "ai"); the database wakes this function
// with the job id and the cron key. It calls Claude with the church's key (hk_settings claude_key, saved by the admin in the app),
// stores the answer as JSON in the job, and the app picks it up (hk_save "ai_get"). Nobody's phone holds the key.
//   meaning   : a Batak hymn (Buku Ende) from the church's own Tata Ibadah, line by line, with the meaning in Bahasa Indonesia and English
//   questions : discussion questions for one category's small group, from Sunday's Tata Ibadah
//   roster    : a fair draft of a section's month roster, for the makers to check and save
//   receipt   : the treasurer's photo of an offering receipt: the SGD amounts, matched to the church's offering names
//   rpp       : (YB 2026-10-30) a Parhalado question about a case, answered from the Juklak RPP HKBP (kept in hk_docs, slug juklak-rpp)
// Copy of the live function (v3), saved to the repo on 2026-10-31. Since YB removed the Claude key, jobs end with "no_claude_key".
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };

async function db(path: string, opt: RequestInit = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const setting = async (k: string) => { const [r] = await db(`hk_settings?key=eq.${k}&select=value`); return r ? r.value : null; };
const LANGS: Record<string, string> = { id: "Bahasa Indonesia", bt: "Bahasa Batak Toba", en: "English" };

async function juklak(): Promise<string> {
  const [d] = await db(`hk_docs?slug=eq.juklak-rpp&select=title,sections`);
  if (!d) return "";
  return (d.sections || []).map((s: any) => `${s.level === 1 ? "## " : "### "}${s.title || ""}\n${(s.lines || []).join("\n")}`).join("\n\n");
}

function prompt(task: string, i: any, ctx = ""): string {
  if (task === "rpp") return `You advise the Parhalado (the pastor and the elders) of HKBP Singapore, a congregation of the Huria Kristen Batak Protestan.
They ask whether a situation is a breach of the church's RPP (Ruhut Parmahanion dohot Paminsangon: rules of pastoral care and church discipline).
Answer ONLY from the Juklak RPP HKBP text below. Read the whole text first. Never invent a rule, a point number or a sanction that is not in it.
If the text does not clearly cover the situation, say so honestly and answer "tergantung" (it depends), explaining what would decide it.
Be pastoral and respectful: RPP exists to guide and restore people, not to shame them. Do not use the person's name in your answer.
Write every explanation in ${LANGS[i.lang] || "Bahasa Indonesia"}. Quotes from the Juklak stay in its original Batak, at most 30 words each.
Reply with JSON only:
{"verdict": "ya" (it is a breach) | "tidak" (it is not a breach) | "tergantung" (it depends / not clearly covered),
 "headline": "one clear sentence answering the question",
 "explanation": ["2 to 5 short paragraphs: why, based on the Juklak"],
 "rules": [{"ref": "where in the Juklak (Bindu / point)", "quote": "short original quote", "meaning": "what it means here"}],
 "steps": ["what the Juklak says the Parhalado should do next, in order (pastoral visits, warnings, the stages of discipline, restoration)"],
 "note": "anything uncertain or missing in the facts, or empty"}

The question from the Parhalado:
${String(i.question || "").slice(0, 20000)}

Juklak RPP HKBP:
${ctx.slice(0, 120000)}`;
  if (task === "meaning") return `You help young members of HKBP Singapore (a Batak Lutheran church) understand a hymn from the Buku Ende that their church sings.
Below is the hymn text exactly as printed in the church's own order of service${i.title ? ` ("${i.title}")` : ""}.
For EVERY line, in order, give its meaning in simple Bahasa Indonesia and in simple English (a faithful meaning, not a rhyming translation).
Keep each original line exactly as given. Keep verse breaks: an empty line between verses becomes {"sep": true}. Mark refrain lines with "ref": true when the text marks them (Reff / Ref / Refrein).
Reply with JSON only: {"lines": [{"bt": "original line", "id": "...", "en": "...", "ref": false}, {"sep": true}, ...]}

Hymn text:
${String(i.text || "").slice(0, 6000)}`;
  if (task === "questions") return `You prepare a small-group discussion for the "${i.category}" category of HKBP Singapore (Batak Lutheran church in Singapore; members include families, youth, sailors and migrant workers).
Use this Sunday's order of service (Tata Ibadah) below: its theme, Bible readings and sermon text. Write in ${LANGS[i.lang] || "Bahasa Indonesia"}.
Fit the group: ${i.hint || "adults"}. Lutheran, Christ-centred, warm and simple.
Reply with JSON only: {"title": "short title", "verse": "key Bible reference", "opening": "2-3 sentences to start", "questions": ["5 to 7 questions, from simple to personal"], "action": "one practical step for the week", "prayer": "a short closing prayer"}

Tata Ibadah:
${String(i.text || "").slice(0, 14000)}`;
  if (task === "receipt") return `This is a photo of an offering receipt or counting slip of HKBP Singapore (a church in Singapore), taken by the treasurer.
Read ONLY the amounts in Singapore dollars (SGD, S$, $). Ignore other currencies (IDR, MYR, USD and so on), card numbers and running balances.
The church's offering names are: ${JSON.stringify(i.names || [])}. Match each SGD amount to the closest of these names when the receipt clearly refers to it
(e.g. "Kolekte", "Persembahan Umum", "Ibadah Umum" = "Persembahan Ibadah Umum"; "SM" = "Sekolah Minggu"). Use the receipt's own wording when it is something else.
If there is only one SGD total for the whole offering, give it as the first offering name. Never invent a number; skip anything unreadable.
Reply with JSON only: {"date": "YYYY-MM-DD or null (the date on the receipt)", "items": [{"name": "offering name", "sgd": 123.45}], "total_sgd": 123.45, "note": "one short sentence on anything unclear, or empty"}`;
  return `You draft a fair monthly service roster for the "${i.group}" section of HKBP Singapore.
Sundays: ${JSON.stringify(i.sundays)}
Jobs (columns): ${JSON.stringify(i.jobs)}
People who can serve: ${JSON.stringify(i.people)}
Times each person served in the last 3 months (spread the work fairly, give more to those who served less): ${JSON.stringify(i.load || {})}
Not available (date -> names): ${JSON.stringify(i.busy || {})}
Already filled and to keep as they are (date -> job -> name): ${JSON.stringify(i.keep || {})}
Rules: use only the people listed; never assign someone who is not available that Sunday; one job per person per Sunday unless there are too few people;
avoid the same person on two Sundays in a row when possible; fill every job on every Sunday if you can, otherwise leave it "".
Reply with JSON only: {"rows": [{"day": "YYYY-MM-DD", "assign": {"Job": "Name"}}], "note": "one short sentence about the fairness of the draft"}`;
}

Deno.serve(async (req) => {
  try {
    const cron = await setting("cron_key");
    if (!cron || req.headers.get("x-cron-key") !== cron) return new Response("forbidden", { status: 403 });
    const { id } = await req.json().catch(() => ({}));
    const [job] = await db(`hk_ai_jobs?id=eq.${Number(id)}&status=eq.queued&select=*`);
    if (!job) return Response.json({ ok: true, skipped: true });
    const fail = async (msg: string) => { await db(`hk_ai_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "error", error: msg.slice(0, 300), done_at: new Date().toISOString() }) }); return Response.json({ ok: false, error: msg }); };
    const key = await setting("claude_key");
    if (!key) return await fail("no_claude_key");
    const input = job.input || {};
    let ctx = "";
    if (job.task === "rpp") { ctx = await juklak(); if (!ctx) return await fail("no_juklak"); }
    const text = prompt(job.task, input, ctx);
    const content: any[] = job.task === "receipt" && input.image
      ? [{ type: "image", source: { type: "base64", media_type: input.mime || "image/jpeg", data: String(input.image) } }, { type: "text", text }]
      : [{ type: "text", text }];
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
    let result: unknown; try { result = JSON.parse(m[0]); } catch { return await fail("unreadable_reply"); }
    // the receipt photo is not kept in the job once it has been read (it is saved with the Warta Keuangan by the app)
    const patch: Record<string, unknown> = { status: "done", result, done_at: new Date().toISOString() };
    if (job.task === "receipt") patch.input = { ...input, image: null };
    await db(`hk_ai_jobs?id=eq.${job.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return Response.json({ ok: true, id: job.id });
  } catch (e) { console.error(e); return Response.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
});
