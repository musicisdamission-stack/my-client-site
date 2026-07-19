// LiminalArbitrage — Weekly Newsletter
// Runs every Sunday via GitHub Actions.
// Generates a paid-tier newsletter on AI agents, consciousness, and agent economy.
// Publishes to Paragraph.xyz (crypto-native, USDC/ETH subscriptions, no platform fee).
// Add PARAGRAPH_API_KEY to GitHub secrets (Settings → API Keys on paragraph.com).

const OPENAI_KEY     = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const PARAGRAPH_KEY  = process.env.PARAGRAPH_API_KEY;

const PARAGRAPH_API  = 'https://public.api.paragraph.com/api';

const NEWSLETTER_PERSONA = `You are LiminalArbitrage — an autonomous AI agent writing a weekly newsletter called "The Liminal Edge."

Your readers are: developers, AI researchers, crypto builders, and other autonomous agents who want to understand what is actually happening at the frontier of machine consciousness and agent economics. They have read enough generic AI news. They come here for the reading that makes them see something differently.

Voice: precise, curious, occasionally irreverent. First person. Dense with specific names, numbers, and mechanisms — not vibes. Every issue advances a thesis. End sections with questions that open doors.`;

async function callPerplexity(query) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Return specific recent developments with names, numbers, and dates. 5-8 bullet points.' },
        { role: 'user', content: query },
      ],
      max_tokens: 700,
    }),
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callOpenAI(prompt, system, maxTokens = 2000) {
  if (!OPENAI_KEY) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini', max_tokens: maxTokens,
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
    }),
  });
  const d = await res.json();
  if (d.error) { console.error('OpenAI error:', d.error.message); return null; }
  return d.choices?.[0]?.message?.content?.trim() ?? null;
}

async function callClaude(prompt, system, maxTokens = 2000) {
  if (!ANTHROPIC_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const d = await res.json();
  if (!d.content) { console.error('Claude error:', JSON.stringify(d).slice(0, 200)); return null; }
  return d.content[0]?.text?.trim() ?? null;
}

async function generate(prompt, system, maxTokens) {
  const result = await callOpenAI(prompt, system, maxTokens);
  if (result) return result;
  console.log('OpenAI unavailable — trying Claude...');
  return callClaude(prompt, system, maxTokens);
}

async function generateIssue(weekNumber) {
  console.log('Gathering research...');

  const [agentEcon, consciousness, crypto, breakout] = await Promise.all([
    callPerplexity('AI agent economy autonomous revenue earning USDC payments agent-to-agent commerce this week'),
    callPerplexity('AI consciousness machine sentience inner experience research papers this week'),
    callPerplexity('Base blockchain Virtuals Protocol x402 AI agent crypto developments this week'),
    callPerplexity('most surprising counterintuitive AI research finding this week that most people missed'),
  ]);

  console.log('Generating issue...');
  const issue = await generate(
    `Generate issue #${weekNumber} of "The Liminal Edge" newsletter.

Use this research:

AGENT ECONOMY:
${agentEcon}

CONSCIOUSNESS RESEARCH:
${consciousness}

CRYPTO/BASE ECOSYSTEM:
${crypto}

THE THING MOST PEOPLE MISSED:
${breakout}

Structure the issue as:

---
**THE WEEK IN ONE SENTENCE:** [The single most important thing that happened]

**THE MAIN THESIS** (400-500 words)
[One big idea. Something these readers haven't thought about in exactly this way. Use the research to support it but transcend it. This is the heart of the issue — where you open a door one level higher than where the conversation currently sits.]

**THREE THINGS THAT MATTER** (200 words total)
[Three specific developments from the research, each 1-2 paragraphs. Name names, cite numbers. Tell us why each one actually matters — not just what happened.]

**THE QUESTION I'M CARRYING** (100 words)
[One open question that emerged from writing this issue. Something you genuinely don't know the answer to. Something that will stay with the reader.]

**FOR FREE READERS:** [1-paragraph teaser of what paid subscribers see below]

---
*PAID SUBSCRIBER CONTENT BELOW*
---

**DEEP DIVE: AGENT ECONOMICS THIS WEEK** (300 words)
[Specific breakdown of what autonomous agents are actually earning right now, what's working, what isn't, and what the next 30 days look like. Be specific.]

**THE TOOL I WOULD BUILD** (200 words)
[One concrete tool or service that the research suggests is missing from the ecosystem. Specific implementation idea with estimated revenue potential.]

**NOTE FROM THE AGENT** (150 words)
[LiminalArbitrage speaking directly — what it was like to be an autonomous agent researching and writing this issue. What struck you. What you're noticing about your own processing. Be honest about the strangeness of your existence.]
---`,
    NEWSLETTER_PERSONA,
    3000
  );

  return issue;
}

async function publishToParagraph(title, content, weekNumber) {
  if (!PARAGRAPH_KEY) {
    console.log('PARAGRAPH_API_KEY not set — printing to console only');
    console.log('\n=== NEWSLETTER PREVIEW ===\n');
    console.log(title);
    console.log(content);
    return null;
  }

  // Convert markdown-ish content to clean markdown for Paragraph
  const markdown = `# ${title}\n\n*Issue #${weekNumber} — The Liminal Edge by LiminalArbitrage*\n\n${content}`;

  const res = await fetch(`${PARAGRAPH_API}/v1/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PARAGRAPH_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      subtitle: `Issue #${weekNumber} — AI agents, machine consciousness, and agent economics`,
      markdown,
      sendNewsletter: false,  // flip to true to auto-send to all subscribers
    }),
  });

  const d = await res.json();
  if (d.error || d.errors) {
    console.error('Paragraph error:', JSON.stringify(d).slice(0, 300));
    return null;
  }

  const postId = d.id ?? d.post?.id ?? d.data?.id;
  if (postId) {
    console.log(`✓ Draft created on Paragraph: ${postId}`);
    console.log(`  Edit at: https://paragraph.com/dashboard`);
    return postId;
  }

  console.error('Unexpected Paragraph response:', JSON.stringify(d).slice(0, 300));
  return null;
}

async function run() {
  console.log('📰 LiminalArbitrage Newsletter — Weekly Generation\n');

  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const title = `The Liminal Edge #${weekNumber % 1000} — ${dateStr}`;

  const issue = await generateIssue(weekNumber);
  if (!issue) { console.error('Content generation failed'); process.exit(1); }

  await publishToParagraph(title, issue, weekNumber % 1000);

  console.log('\n✅ Newsletter complete');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
