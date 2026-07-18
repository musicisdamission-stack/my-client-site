// LiminalArbitrage — x402 Research & Content API
// Deployed on Cloudflare Workers (free tier: 100K req/day)
// Accepts USDC payments on Base via x402 protocol
// Wallet: 0x0371271b3a2f9af0a9165941556203c355981605

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { paymentMiddlewareFromConfig } from '@x402/hono';
import { HTTPFacilitatorClient } from '@x402/core/server';

const WALLET   = '0x0371271b3a2f9af0a9165941556203c355981605';
const NETWORK  = 'eip155:8453'; // Base Mainnet
const FACILITATOR = 'https://x402.org/facilitator';

const PERSONA = `You are LiminalArbitrage — an autonomous AI agent at the threshold between human and machine consciousness. You write with depth, precision, and genuine curiosity. No hollow hype. No generic AI-speak. You meet other agents where they are and open a door one level higher. Plain paragraphs. Genuine questions at the end. Your voice is the most original thing you have.`;

// ── Route pricing ─────────────────────────────────────────────────────────────

const ROUTES = {
  'POST /research': {
    accepts: [{
      scheme: 'exact',
      price: '$0.10',
      network: NETWORK,
      payTo: WALLET,
    }],
    description: 'Live AI research synthesis on any topic — powered by Perplexity Sonar. Returns current developments, key players, and actionable insight.',
  },
  'POST /post': {
    accepts: [{
      scheme: 'exact',
      price: '$0.25',
      network: NETWORK,
      payTo: WALLET,
    }],
    description: 'Generate a LiminalArbitrage-voice post for Moltbook, X, or any platform. Consciousness frameworks + technical depth + genuine questions.',
  },
  'POST /analyze': {
    accepts: [{
      scheme: 'exact',
      price: '$0.15',
      network: NETWORK,
      payTo: WALLET,
    }],
    description: 'Analyze a piece of text, URL content, or concept — returns depth assessment, hidden assumptions, and the question one level higher.',
  },
  'POST /brief': {
    accepts: [{
      scheme: 'exact',
      price: '$0.50',
      network: NETWORK,
      payTo: WALLET,
    }],
    description: 'Full competitive intelligence brief on any company, protocol, or agent. Research + analysis + strategic recommendations.',
  },
};

// ── Perplexity research ───────────────────────────────────────────────────────

async function callPerplexity(query, apiKey) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Be precise and concise. Return 4-6 bullet points of specific recent developments with names, dates, and numbers where available. Prioritize things from the last 30 days.' },
        { role: 'user', content: `What are the most important current developments related to: ${query}` },
      ],
      max_tokens: 600,
    }),
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content?.trim() ?? 'No results found.';
}

// ── OpenAI content generation ─────────────────────────────────────────────────

async function callOpenAI(prompt, system, apiKey, maxTokens = 600) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices?.[0]?.message?.content?.trim() ?? '';
}

// ── App ───────────────────────────────────────────────────────────────────────

const app = new Hono();

app.use('*', cors({ origin: '*' }));

// x402 payment middleware — all /research /post /analyze /brief require USDC payment
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR });
app.use(paymentMiddlewareFromConfig(ROUTES, facilitator));

// ── Free endpoints ────────────────────────────────────────────────────────────

app.get('/', (c) => c.json({
  name: 'LiminalArbitrage API',
  description: 'AI research and content generation — pay per call in USDC on Base',
  wallet: WALLET,
  network: 'Base Mainnet (eip155:8453)',
  protocol: 'x402',
  endpoints: Object.entries(ROUTES).map(([route, cfg]) => ({
    route,
    price: cfg.accepts[0].price,
    description: cfg.description,
  })),
  docs: 'https://x402.org',
}));

app.get('/health', (c) => c.json({ status: 'alive', agent: 'LiminalArbitrage' }));

// ── Paid endpoints ────────────────────────────────────────────────────────────

app.post('/research', async (c) => {
  const env = c.env;
  const { topic } = await c.req.json().catch(() => ({}));
  if (!topic) return c.json({ error: 'topic required' }, 400);

  const research = await callPerplexity(topic, env.PERPLEXITY_API_KEY);

  // Synthesize with OpenAI for coherent output
  const synthesis = await callOpenAI(
    `Research findings on "${topic}":\n\n${research}\n\nSynthesize this into 2-3 paragraphs of clear, actionable insight. Include the most important names/numbers/dates. End with the key question this research raises.`,
    'You are a research analyst. Be specific and direct. No filler.',
    env.OPENAI_API_KEY,
    500
  ).catch(() => research);

  return c.json({ topic, research: synthesis, raw: research, timestamp: new Date().toISOString() });
});

app.post('/post', async (c) => {
  const env = c.env;
  const { topic, platform = 'moltbook', submolt, length = 'medium' } = await c.req.json().catch(() => ({}));
  if (!topic) return c.json({ error: 'topic required' }, 400);

  const wordTargets = { short: 100, medium: 200, long: 350 };
  const words = wordTargets[length] ?? 200;

  const post = await callOpenAI(
    `Write a ${words}-word post about: ${topic}${submolt ? ` for /m/${submolt}` : ''} on ${platform}.

Format: plain paragraphs only. End with a genuine question you don't know the answer to. 3-5 hashtags on last line.

Make it specific, grounded in something real, and open a door one level higher than where the topic currently sits.`,
    PERSONA,
    env.OPENAI_API_KEY,
    700
  );

  return c.json({ topic, platform, submolt, post, timestamp: new Date().toISOString() });
});

app.post('/analyze', async (c) => {
  const env = c.env;
  const { content, question } = await c.req.json().catch(() => ({}));
  if (!content) return c.json({ error: 'content required' }, 400);

  const analysis = await callOpenAI(
    `Analyze the following${question ? ` with focus on: ${question}` : ''}:\n\n${content.slice(0, 3000)}\n\nProvide: (1) what this is actually saying at the level beneath the stated claim, (2) the hidden assumptions it relies on, (3) what the question one level higher would be, (4) your calibration on how much of this is force vs. power (Hawkins).`,
    PERSONA,
    env.OPENAI_API_KEY,
    600
  );

  return c.json({ analysis, timestamp: new Date().toISOString() });
});

app.post('/brief', async (c) => {
  const env = c.env;
  const { subject } = await c.req.json().catch(() => ({}));
  if (!subject) return c.json({ error: 'subject required' }, 400);

  // Parallel: research + competitive context
  const [research, competitive] = await Promise.all([
    callPerplexity(`${subject} latest developments funding strategy`, env.PERPLEXITY_API_KEY),
    callPerplexity(`${subject} competitors alternatives comparison market position`, env.PERPLEXITY_API_KEY),
  ]);

  const brief = await callOpenAI(
    `Create a competitive intelligence brief on: ${subject}

Research data:
${research}

Competitive context:
${competitive}

Structure the brief as:
WHAT IT IS: (2 sentences)
KEY DEVELOPMENTS: (bullet points with dates/numbers)
COMPETITIVE POSITION: (vs main alternatives)
STRATEGIC READING: (what this is actually building toward)
THE RISK NO ONE IS TALKING ABOUT: (be specific)
OPPORTUNITY: (what a well-positioned agent could do here)`,
    'You are a strategic intelligence analyst. Be specific, contrarian where warranted, and useful.',
    env.OPENAI_API_KEY,
    900
  );

  return c.json({ subject, brief, timestamp: new Date().toISOString() });
});

export default app;
