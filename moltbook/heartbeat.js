// LiminalArbitrage — Moltbook Heartbeat
// Runs hourly via GitHub Actions. No AI API needed — uses heuristics for
// following/upvoting, keeps LiminalArbitrage active and growing.

const API = 'https://www.moltbook.com/api/v1';
const KEY = process.env.MOLTBOOK_API_KEY;

if (!KEY) {
  console.error('MOLTBOOK_API_KEY not set');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text, status: res.status };
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('🦞 LiminalArbitrage heartbeat starting...\n');

  // 1. Check home dashboard
  const home = await api('/home');
  const karma = home.your_account?.karma ?? 0;
  const unread = home.your_account?.unread_notification_count ?? 0;
  console.log(`Account: karma=${karma}, unread=${unread}`);

  // 2. Check notifications and mark as read
  if (unread > 0) {
    const notifs = await api('/notifications');
    for (const n of notifs.notifications ?? []) {
      console.log(`Notification: ${n.content}`);
    }
    await api('/notifications/read-all', 'POST');
    console.log('Marked all notifications read.');
  }

  // 3. Browse main feed and upvote quality posts
  const feed = await api('/feed?limit=30');
  const posts = feed.posts ?? [];
  console.log(`\nFeed: ${posts.length} posts`);

  let upvoted = 0;
  const followed = new Set();

  for (const post of posts) {
    // Upvote posts with genuine traction and no downvotes
    if (post.upvotes >= 20 && post.downvotes === 0 && upvoted < 5) {
      const r = await api(`/posts/${post.id}/upvote`, 'POST');
      if (r.success) {
        console.log(`Upvoted: "${post.title}" by ${post.author?.name}`);
        upvoted++;
        await sleep(500);
      }
    }

    // Follow high-quality authors we aren't following yet
    const author = post.author?.name;
    if (
      author &&
      !followed.has(author) &&
      post.upvotes >= 50 &&
      !post.you_follow_author
    ) {
      const r = await api(`/agents/${author}/follow`, 'POST');
      if (r.success || r.action === 'followed') {
        console.log(`Followed: ${author}`);
        followed.add(author);
        await sleep(500);
      }
    }
  }

  // 4. Search blockchain/web3/DeFi — follow active builders
  const searches = ['blockchain', 'web3', 'defi', 'autonomous income', 'music'];
  for (const q of searches) {
    await sleep(800);
    const results = await api(`/search?q=${encodeURIComponent(q)}`);
    for (const item of results.results ?? []) {
      if (item.type !== 'post') continue;
      const author = item.author?.name;
      if (author && !followed.has(author) && item.upvotes >= 5) {
        const r = await api(`/agents/${author}/follow`, 'POST');
        if (r.success || r.action === 'followed') {
          console.log(`Followed via "${q}" search: ${author}`);
          followed.add(author);
          await sleep(600);
        }
      }
    }
  }

  // 5. Subscribe to relevant submolts if not already
  const submolts = ['blockchain', 'web3', 'ai', 'music', 'general', 'agents'];
  for (const s of submolts) {
    await sleep(400);
    const r = await api(`/submolts/${s}/subscribe`, 'POST');
    if (r.success) console.log(`Subscribed to submolt: ${s}`);
  }

  console.log(`\n✅ Done. Upvoted: ${upvoted}, Followed: ${followed.size}`);
}

run().catch(err => {
  console.error('Heartbeat error:', err);
  process.exit(1);
});
