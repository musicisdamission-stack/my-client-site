// LiminalArbitrage — ElevenLabs Narration
// Generates MP3 audio narrations of recent Moltbook posts.
// Run locally: node moltbook/narrate.js
// Or via GitHub Actions after a series posts.
// Output: moltbook/audio/<post-id>.mp3

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID       = 'qkzql1RGnJS4neLr4Iic';
const MODEL          = 'eleven_turbo_v2_5';
const MEMORY_FILE    = 'moltbook/memory.json';
const AUDIO_DIR      = 'moltbook/audio';

if (!ELEVENLABS_KEY) { console.error('ELEVENLABS_API_KEY not set'); process.exit(1); }

const VOICE_SETTINGS = {
  stability:        0.45,  // slight variation — not robotic
  similarity_boost: 0.80,  // stay true to the designed voice
  style:            0.30,  // measured expressiveness
  use_speaker_boost: true,
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) return JSON.parse(readFileSync(MEMORY_FILE, 'utf8'));
  } catch {}
  return { recentPosts: [] };
}

// Strip hashtags and clean text for spoken audio
function cleanForAudio(text) {
  return text
    .replace(/#\w+/g, '')          // remove hashtags
    .replace(/@\w+/g, match => match.replace('@', ''))  // remove @ from mentions
    .replace(/\n{3,}/g, '\n\n')    // collapse excessive newlines
    .replace(/https?:\/\/\S+/g, '') // remove URLs
    .trim();
}

async function generateAudio(text, outputPath) {
  const cleaned = cleanForAudio(text);
  if (cleaned.length < 20) { console.log('  ⚠ Text too short, skipping'); return null; }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key':   ELEVENLABS_KEY,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    },
    body: JSON.stringify({
      text:          cleaned,
      model_id:      MODEL,
      voice_settings: VOICE_SETTINGS,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ ElevenLabs error ${res.status}: ${err.slice(0, 200)}`);
    return null;
  }

  const buffer = await res.arrayBuffer();
  writeFileSync(outputPath, Buffer.from(buffer));
  const kb = Math.round(buffer.byteLength / 1024);
  console.log(`  ✓ ${kb}KB → ${outputPath}`);
  return outputPath;
}

// Narrate a single post given title + content
export async function narratePost({ id, title, content }) {
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
  const filename = join(AUDIO_DIR, `${id ?? Date.now()}.mp3`);
  if (existsSync(filename)) { console.log(`  ↩ Already exists: ${filename}`); return filename; }
  const fullText = `${title}.\n\n${content}`;
  return generateAudio(fullText, filename);
}

// Narrate a series of posts given their raw title+content (no ID needed)
export async function narrateSeries(posts) {
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
  const results = [];
  for (let i = 0; i < posts.length; i++) {
    const { title, content, id } = posts[i];
    const slug = id ?? `series-${i+1}-${Date.now()}`;
    console.log(`[${i+1}/${posts.length}] "${title.slice(0, 60)}"`);
    const path = await narratePost({ id: slug, title, content });
    results.push({ title, path });
    if (i < posts.length - 1) await sleep(1000);
  }
  return results;
}

// ── Standalone: narrate recent posts from memory ──────────────────────────────

async function run() {
  console.log('🎙 LiminalArbitrage — ElevenLabs Narration\n');
  console.log(`Voice: ${VOICE_ID} | Model: ${MODEL}\n`);

  const COUNT = parseInt(process.env.COUNT ?? '5', 10);
  const memory = loadMemory();
  const posts = (memory.recentPosts ?? []).slice(0, COUNT);

  if (!posts.length) {
    console.log('No posts in memory.json — nothing to narrate.');
    console.log('Pass post text via COUNT env var or run after a series posts.');
    process.exit(0);
  }

  console.log(`Narrating ${posts.length} most recent posts from memory...\n`);
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });

  let done = 0;
  for (const p of posts) {
    console.log(`[${done+1}/${posts.length}] /m/${p.submolt}: "${(p.title ?? p.id).slice(0, 70)}"`);

    // Memory only stores title, not content — fetch content if we have the ID
    // For now, narrate the title as a teaser (full content requires Moltbook API call)
    const text = p.title ?? 'Untitled post by LiminalArbitrage.';
    const filename = join(AUDIO_DIR, `${p.id}.mp3`);

    if (existsSync(filename)) {
      console.log(`  ↩ Already exists — skipping`);
      done++;
      continue;
    }

    const result = await generateAudio(text, filename);
    if (result) done++;
    await sleep(800);
  }

  console.log(`\n✅ ${done}/${posts.length} narrated → ${AUDIO_DIR}/`);
  console.log('\nMP3 files ready. Drag into TikTok, YouTube Shorts, or Instagram Reels.');
}

// Only run as main if called directly (not imported)
if (process.argv[1].endsWith('narrate.js')) {
  run().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
