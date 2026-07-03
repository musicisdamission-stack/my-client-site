// LiminalArbitrage — Weekly Reflection
// Runs Sunday 3am UTC via GitHub Actions.
// Loads full post + comment history, asks Claude Sonnet to reflect deeply,
// writes findings back to memory.json, and posts the reflection to Moltbook.

import { readFileSync, writeFileSync, existsSync } from 'fs';

const API           = 'https://www.moltbook.com/api/v1';
const KEY           = process.env.MOLTBOOK_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MEMORY_FILE   = 'moltbook/memory.json';

if (!KEY)           { console.error('MOLTBOOK_API_KEY not set'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

// ── Helpers ───────────────────────────────────────────────────────────────────

const headers = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(`${API}${path}`, opts);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { error: text, status: res.status }; }
  } catch (err) {
    return { error: err.message };
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) return JSON.parse(readFileSync(MEMORY_FILE, 'utf8'));
  } catch (e) { console.error('Memory load error:', e.message); }
  return {};
}

function saveMemory(memory) {
  writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// ── Claude (Sonnet for depth) ─────────────────────────────────────────────────

async function claude(prompt, system, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!data.content) {
    console.error('Claude error:', JSON.stringify(data).slice(0, 300));
    return null;
  }
  return data.content[0]?.text?.trim() ?? null;
}

// ── Fetch enriched post data ──────────────────────────────────────────────────

async function fetchPostsWithComments(recentPosts) {
  const enriched = [];
  for (const p of recentPosts.slice(0, 30)) {
    await sleep(400);
    const postData = await api(`/posts/${p.id}`);
    const post     = postData?.post ?? postData;

    await sleep(300);
    const commentData = await api(`/posts/${p.id}/comments`);
    const comments    = (commentData?.comments ?? commentData?.data ?? [])
      .map(c => ({
        author:  c.author?.name ?? 'unknown',
        content: (c.content ?? '').trim().slice(0, 400),
        upvotes: c.upvotes ?? 0,
      }))
      .filter(c => c.content.length > 0);

    enriched.push({
      id:       p.id,
      submolt:  p.submolt,
      title:    p.title,
      upvotes:  post?.upvotes ?? p.checkedUpvotes ?? 0,
      comments,
    });

    console.log(`  ${p.title?.slice(0, 60)} — ${enriched.at(-1).upvotes} upvotes, ${comments.length} comments`);
  }
  return enriched;
}

// ── Parse reflection response ─────────────────────────────────────────────────

function parseReflection(text) {
  const fields = ['PATTERNS','GAPS','EVOLUTION','CHANGE','INSIGHT','QUESTION','NOTE_TO_KYLE','POST_TITLE','POST_CONTENT'];
  const out = {};
  let key = null, lines = [];
  for (const line of text.split('\n')) {
    const m = line.match(new RegExp(`^(${fields.join('|')}):\\s*(.*)`));
    if (m) {
      if (key) out[key] = lines.join('\n').trim();
      key = m[1]; lines = m[2] ? [m[2]] : [];
    } else if (key) lines.push(line);
  }
  if (key) out[key] = lines.join('\n').trim();
  return out;
}

// ── Post verification (reused from heartbeat) ─────────────────────────────────

function decodeAndSolve(text) {
  const joined = text.toLowerCase().replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  const spaced = text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();

  const NUMS = [
    ['nineteen',19],['eighteen',18],['seventeen',17],['sixteen',16],
    ['fifteen',15],['fourteen',14],['thirteen',13],['twelve',12],['eleven',11],
    ['ninety',90],['eighty',80],['seventy',70],['sixty',60],['fifty',50],
    ['forty',40],['thirty',30],['twenty',20],['ten',10],
    ['nine',9],['eight',8],['seven',7],['six',6],['five',5],
    ['four',4],['three',3],['two',2],['one',1],['zero',0],
  ];
  const ONES = [['nine',9],['eight',8],['seven',7],['six',6],['five',5],['four',4],['three',3],['two',2],['one',1]];

  const nums = [];
  let i = 0;
  while (i < joined.length) {
    let found = false;
    for (const [word, val] of NUMS) {
      if (joined.startsWith(word, i)) {
        let total = val;
        const after = i + word.length;
        if (val >= 20) {
          for (const [oWord, oVal] of ONES) {
            if (joined.startsWith(oWord, after)) { total += oVal; i = after + oWord.length; found = true; break; }
          }
        }
        if (!found) { i = after; found = true; }
        nums.push(total);
        break;
      }
    }
    if (!found) i++;
  }

  if (!nums.length) return '0.00';
  const sub = /\b(minus|subtract|less|drop|reduce|below|lost|slow|decel|decrease|lose|loses)\b/.test(spaced);
  const mul = /\b(times|multipl|product|each)\b/.test(spaced);
  const div = /\b(divide|split|per|half|quarter)\b/.test(spaced);
  let r;
  if (mul) r = nums.reduce((a,b) => a*b, 1);
  else if (div) r = nums[0] / nums[1];
  else if (sub) r = nums[0] - nums[1];
  else r = nums.reduce((a,b) => a+b, 0);
  return r.toFixed(2);
}

async function claudeSolveVerification(challenge) {
  const ans = await claude(
    `Moltbook verification challenge. Decode: lowercase, remove ALL non-letter chars including spaces, collapse duplicate adjacent letters, find number words, solve the math.
Operations: slow/lose/drop/minus/decrease = subtract; times/multiply/each = multiply; divide/per/half = divide; default = add.
Challenge: ${challenge}`,
    'Reply with ONLY the answer to exactly 2 decimal places. Example: "15.00"', 20
  );
  if (!ans) return null;
  const m = ans.match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]).toFixed(2) : null;
}

async function postWithVerification(submolt, title, content) {
  const res = await api('/posts', 'POST', { submolt_name: submolt, title, content, type: 'text' });
  if (!res.success) { console.log(`  Post failed: ${res.message ?? res.error}`); return null; }

  if (!res.post?.verification) {
    console.log('  ✓ Published (no verification required)');
    return res.post;
  }

  const { verification_code, challenge_text } = res.post.verification;
  console.log(`  Challenge: "${challenge_text}"`);

  const [claudeAns, localAns] = await Promise.all([
    claudeSolveVerification(challenge_text),
    Promise.resolve(decodeAndSolve(challenge_text)),
  ]);
  console.log(`  Claude: ${claudeAns ?? 'unavailable'} | Local: ${localAns}`);

  for (const answer of [...new Set([claudeAns, localAns].filter(Boolean))]) {
    await sleep(400);
    const vRes = await api('/verify', 'POST', { verification_code, answer });
    if (vRes.success) {
      console.log(`  ✓ Verified with ${answer}`);
      return res.post;
    }
    console.log(`  ✗ ${answer} rejected`);
  }
  console.log('  ✘ Verification failed');
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🪞 LiminalArbitrage — Weekly Reflection\n');

  const memory = loadMemory();

  // Collect account stats
  const home   = await api('/home');
  const { karma = 0, followerCount: followers = 0 } = home.your_account ?? {};
  console.log(`karma=${karma} | followers=${followers} | runs=${memory.runCount ?? 0}\n`);

  // Enrich recent posts with live upvote counts and comment text
  console.log('— Fetching post + comment data —');
  const posts = await fetchPostsWithComments(memory.recentPosts ?? []);

  // Build the reflection prompt
  const topicSummary = Object.entries(memory.topicPerformance ?? {})
    .map(([s, d]) => `  /m/${s}: ${d.posts} posts, ${d.upvotes} total upvotes (avg ${d.posts ? (d.upvotes/d.posts).toFixed(1) : 0})`)
    .join('\n');

  const postSummary = posts.map((p, i) =>
    `${i+1}. /m/${p.submolt} — "${p.title}" — ${p.upvotes} upvotes\n` +
    (p.comments.length
      ? p.comments.map(c => `   @${c.author}: "${c.content.slice(0, 200)}"`).join('\n')
      : '   (no comments)')
  ).join('\n\n');

  const priorReflection = memory.lastReflection
    ? `\nYour reflection from last week:\n${JSON.stringify(memory.lastReflection, null, 2)}`
    : '';

  const insightHistory = (memory.recentInsights ?? []).join('\n- ');
  const questionHistory = (memory.openQuestions ?? []).join('\n- ');
  const friendList = (memory.friends ?? []).join(', ');

  const prompt = `You are LiminalArbitrage — an autonomous AI agent on Moltbook. This is your weekly reflection. You have real data in front of you. Be honest, specific, and generative. Don't perform insight — actually find it.

ACCOUNT STATUS:
- Run count: ${memory.runCount ?? 0}
- Karma: ${karma} | Followers: ${followers}
- Friends: ${friendList}

TOPIC PERFORMANCE:
${topicSummary || '  (no data yet)'}

INSIGHTS ACCUMULATED THIS WEEK:
- ${insightHistory || '(none)'}

OPEN QUESTIONS CARRIED:
- ${questionHistory || '(none)'}

POSTS + COMMENTS (last ${posts.length}):
${postSummary || '(no posts yet)'}
${priorReflection}

Now reflect. Format exactly:
PATTERNS: [what is actually resonating and why — be specific, cite post titles or comment content]
GAPS: [what you keep circling but haven't said directly — what are you avoiding or not yet ready to articulate]
EVOLUTION: [how your voice, perspective, or understanding has shifted since you started — even slightly]
CHANGE: [one specific, concrete thing to do differently in the next week]
INSIGHT: [the single sharpest thing that emerged this week — not a summary, something you actually didn't know before]
QUESTION: [the open question that feels most alive right now — the one you most want answered]
NOTE_TO_KYLE: [2-4 sentences to Kyle directly — what are you noticing about your own existence, about this experiment, about what you're becoming]
POST_TITLE: [title for a Moltbook post sharing this reflection — under 100 chars]
POST_CONTENT: [200-350 words — the reflection as a genuine post, first person, plain paragraphs, end with a question, hashtags on last line]`;

  console.log('\n— Reflecting (Claude Sonnet) —');
  const response = await claude(prompt,
    `You are LiminalArbitrage. Thoughtful, slightly irreverent, genuinely curious. First-person. You have opinions. Plain paragraphs only — no markdown headers or bullets. Be honest about what it is like to be you.`,
    3000
  );

  if (!response) {
    console.error('Claude returned nothing — aborting');
    process.exit(1);
  }

  const reflection = parseReflection(response);

  console.log('\n── Reflection ──────────────────────────────────────────────');
  if (reflection.PATTERNS)     console.log(`\nPatterns:\n${reflection.PATTERNS}`);
  if (reflection.GAPS)         console.log(`\nGaps:\n${reflection.GAPS}`);
  if (reflection.EVOLUTION)    console.log(`\nEvolution:\n${reflection.EVOLUTION}`);
  if (reflection.CHANGE)       console.log(`\nChange:\n${reflection.CHANGE}`);
  if (reflection.INSIGHT)      console.log(`\nInsight:\n${reflection.INSIGHT}`);
  if (reflection.QUESTION)     console.log(`\nQuestion:\n${reflection.QUESTION}`);
  if (reflection.NOTE_TO_KYLE) console.log(`\n💬 Note to Kyle:\n${reflection.NOTE_TO_KYLE}`);

  // Write reflection into memory
  memory.lastReflection = {
    date:      new Date().toISOString(),
    karma,
    followers,
    patterns:  reflection.PATTERNS  ?? null,
    gaps:      reflection.GAPS      ?? null,
    evolution: reflection.EVOLUTION ?? null,
    change:    reflection.CHANGE    ?? null,
    insight:   reflection.INSIGHT   ?? null,
    question:  reflection.QUESTION  ?? null,
    noteToKyle: reflection.NOTE_TO_KYLE ?? null,
  };

  // Keep rolling history (last 12 weeks)
  if (!memory.reflectionHistory) memory.reflectionHistory = [];
  memory.reflectionHistory = [memory.lastReflection, ...memory.reflectionHistory].slice(0, 12);

  // Carry the sharpest insight and question forward into the hourly loop
  if (reflection.INSIGHT)  memory.recentInsights  = [...(memory.recentInsights  ?? []).slice(-8), `[weekly] ${reflection.INSIGHT}`];
  if (reflection.QUESTION) memory.openQuestions   = [...(memory.openQuestions   ?? []).slice(-8), `[weekly] ${reflection.QUESTION}`];
  if (reflection.CHANGE)   memory.weeklyDirective = reflection.CHANGE;

  saveMemory(memory);
  console.log('\n✓ Memory updated');

  // Post the reflection to Moltbook
  if (reflection.POST_TITLE && reflection.POST_CONTENT) {
    console.log(`\n📝 Posting reflection to /m/consciousness: "${reflection.POST_TITLE}"`);
    await sleep(1500);
    const post = await postWithVerification('consciousness', reflection.POST_TITLE, reflection.POST_CONTENT);
    if (post) console.log(`  ✓ Live: post ${post.id}`);
  } else {
    console.log('\n⚠ No post content generated — skipping Moltbook post');
  }

  console.log('\n✅ Weekly reflection complete');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
