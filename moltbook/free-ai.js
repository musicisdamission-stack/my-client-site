// Free AI fallbacks — no paid credits needed.
//  1. Gemini free tier (GEMINI_API_KEY from an AI Studio project with billing OFF)
//  2. GitHub Models (uses the workflow's own GITHUB_TOKEN; needs `permissions: models: read`)
// Both have small per-minute / per-day caps, so: wait + retry once on per-minute limits,
// and stop asking a model for the rest of the run once its daily cap is hit.

const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
          generationConfig: { maxOutputTokens: maxTokens },
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
      console.error(`Gemini(${model}) error:`, msg.slice(0, 200));
      freeStats.fail++;
      return null;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    if (text) freeStats.ok++;
    return text;
  } catch (err) { console.error(`Gemini(${model}) fetch error:`, err.message); freeStats.fail++; return null; }
}

export async function githubModel(model, userPrompt, system, maxTokens = 400, retry = true) {
  if (!GITHUB_TOKEN || exhausted.has(`gh:${model}`)) return null;
  try {
    const res = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: userPrompt }],
      }),
    });
    const body = await res.text();
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after') ?? '60', 10);
      if (wait > 120 || isDaily(body)) {
        exhausted.add(`gh:${model}`);
        console.error(`  ⚠ GitHub Models(${model}) daily free quota used up — skipping it this run`);
      } else if (retry) {
        console.log(`  ⏳ GitHub Models(${model}) rate limit — waiting ${wait + 2}s then retrying`);
        await sleep((wait + 2) * 1000);
        return githubModel(model, userPrompt, system, maxTokens, false);
      }
      freeStats.fail++;
      return null;
    }
    let data;
    try { data = JSON.parse(body); } catch { data = null; }
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!res.ok || !text) {
      console.error(`GitHub Models(${model}) error: HTTP ${res.status} ${body.slice(0, 200)}`);
      freeStats.fail++;
      return null;
    }
    freeStats.ok++;
    return text;
  } catch (err) { console.error(`GitHub Models(${model}) fetch error:`, err.message); freeStats.fail++; return null; }
}

// Best free writing quality first, then the models with the most free headroom.
export async function freeHigh(userPrompt, system, maxTokens = 400) {
  return (await freeGemini('gemini-3.5-flash', userPrompt, system, maxTokens))
      ?? (await githubModel('openai/gpt-4.1', userPrompt, system, maxTokens))
      ?? (await freeGemini('gemini-3.1-flash-lite', userPrompt, system, maxTokens))
      ?? (await githubModel('openai/gpt-4.1-mini', userPrompt, system, maxTokens));
}

// Volume work — biggest free limits first.
export async function freeMid(userPrompt, system, maxTokens = 400) {
  return (await freeGemini('gemini-3.1-flash-lite', userPrompt, system, maxTokens))
      ?? (await githubModel('openai/gpt-4.1-mini', userPrompt, system, maxTokens))
      ?? (await freeGemini('gemini-3.5-flash', userPrompt, system, maxTokens));
}
