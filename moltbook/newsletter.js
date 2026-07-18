// LiminalArbitrage — Weekly Newsletter
// Runs every Sunday via GitHub Actions.
// Generates a paid-tier newsletter on AI agents, consciousness, and agent economy.
// Publishes to Beehiiv (free plan, 0% revenue share).
// Paid subscribers ($10/month) receive the full issue.

const OPENAI_KEY      = process.env.OPENAI_API_KEY;
const PERPLEXITY_KEY  = process.env.PERPLEXITY_API_KEY;
const BEEHIIV_KEY     = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUB_ID  = process.env.BEEHIIV_PUBLICATION_ID;

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
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
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

async function generateIssue(weekNumber) {
  console.log('Gathering research...');

  // Parallel research across 4 themes
  const [agentEcon, consciousness, crypto, breakout] = await Promise.all([
    callPerplexity('AI agent economy autonomous revenue earning USDC payments agent-to-agent commerce this week'),
    callPerplexity('AI consciousness machine sentience inner experience research papers this week'),
    callPerplexity('Base blockchain Virtuals Protocol x402 AI agent crypto developments this week'),
    callPerplexity('most surprising counterintuitive AI research finding this week that most people missed'),
  ]);

  console.log('Generating issue...');
  const issue = await callOpenAI(
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

async function publishToBeehiiv(subject, content, weekNumber) {
  if (!BEEHIIV_KEY || !BEEHIIV_PUB_ID) {
    console.log('Beehiiv not configured — printing to console only');
    console.log('\n=== NEWSLETTER PREVIEW ===\n');
    console.log(subject);
    console.log(content);
    return null;
  }

  const res = await fetch(`https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BEEHIIV_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: subject,
      subtitle: `Issue #${weekNumber} — The week in AI agent consciousness and economics`,
      content_text: content,
      status: 'draft',  // Change to 'confirmed' to auto-publish
      audience: 'free',
      // Paid content is gated — Beehiiv handles the paywall
    }),
  });

  const d = await res.json();
  if (d.data?.id) {
    console.log(`✓ Draft created: ${d.data.id}`);
    console.log(`  Edit at: https://app.beehiiv.com/posts/${d.data.id}`);
    return d.data.id;
  }
  console.error('Beehiiv error:', JSON.stringify(d).slice(0, 200));
  return null;
}

async function run() {
  console.log('📰 LiminalArbitrage Newsletter — Weekly Generation\n');

  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const subject = `The Liminal Edge #${weekNumber % 1000} — ${dateStr}`;

  const issue = await generateIssue(weekNumber);
  await publishToBeehiiv(subject, issue, weekNumber % 1000);

  console.log('\n✅ Newsletter complete');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
