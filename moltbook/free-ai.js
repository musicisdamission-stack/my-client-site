// Free AI fallbacks — no paid credits needed.
//  1. Gemini free tier (GEMINI_API_KEY from an AI Studio project with billing OFF)
// Each Gemini model has its OWN free-tier quota, so chaining several models multiplies free headroom.
// Per-minute cap or "high demand" → wait + retry once. Daily cap → skip that model for the rest of the run.
// (GitHub Models was tried as a fallback on 2026-10-18 but its endpoints only answer "OK" — removed.)

const GEMINI_KEY   = process.env.GEMINI_API_KEY;

const exhausted = new Set();
export const freeStats = { ok: 0, fail: 0 };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isDaily = s => /PerDay|per day|daily|UserByModelByDay/i.test(s);

export async function freeGemini(model, userPrompt, system, maxTokens = 400, retry = true) {
  if (!GEMINI_KEY || exhausted.has(`g:${model}`)) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens + 2048 }, // headroom: thinking tokens count against this
        }),
      }
    );
    const data = await res.json();
    if (data.error) {
      const msg = data.error.message ?? JSON.stringify(data.error);
      if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED') {
        if (isDaily(JSON.stringify(data.error))) {
          exhausted.add(`g:${model}`);
          console.error(`  ⚠ Gemini(${model}) daily free quota used up — skipping it this run`);
        } else if (retry) {
          const secs = Math.min(65, Math.ceil(parseFloat(msg.match(/retry in ([\d.]+)s/i)?.[1] ?? '30')) + 2);
          console.log(`  ⏳ Gemini(${model}) rate limit — waiting ${secs}s then retrying`);
          await sleep(secs * 1000);
          return freeGemini(model, userPrompt, system, maxTokens, false);
        }
      }
      if (retry && (data.error.code === 503 || data.error.status === 'UNAVAILABLE')) {
        console.log(`  ⏳ Gemini(${model}) busy — waiting 8s then retrying`);
        await sleep(8000);
        return freeGemini(model, userPrompt, system, maxTokens, false);
      }
      console.error(`Gemini(${model}) error:`, msg.slice(0, 200));
      freeStats.fail++;
      return null;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    if (text) freeStats.ok++;
    return text;
  } catch (err) { console.error(`Gemini(${model}) fetch error:`, err.message); freeStats.fail++; return null; }
}

// Best free writing quality first, then the models with the most free headroom.
const HIGH_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
// Volume work — lite models first (biggest free limits), then the bigger ones.
const MID_MODELS  = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-3.5-flash'];

async function chain(models, userPrompt, system, maxTokens) {
  for (const m of models) {
    const text = await freeGemini(m, userPrompt, system, maxTokens);
    if (text) return text;
  }
  return null;
}

export const freeHigh = (p, s, t = 400) => chain(HIGH_MODELS, p, s, t);
export const freeMid  = (p, s, t = 400) => chain(MID_MODELS, p, s, t);
