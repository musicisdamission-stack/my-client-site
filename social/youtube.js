// YouTube Automation — LiminalArbitrage
// Checks a Google Drive folder for new videos, generates metadata with Claude,
// uploads to YouTube. Runs daily via GitHub Actions.

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const FOLDER_ID     = (process.env.GDRIVE_FOLDER_ID ?? '').trim();
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY     = process.env.OPENAI_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const FAL_KEY        = process.env.FAL_API_KEY;

const MEMORY_FILE   = 'social/youtube-memory.json';
const MAX_PER_RUN   = 5;  // uploads per day

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !FOLDER_ID) {
  console.error('Missing required env vars. Need: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GDRIVE_FOLDER_ID');
  process.exit(1);
}

// ── Google Auth ───────────────────────────────────────────────────────────────

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${data.error_description ?? data.error}`);
  return data.access_token;
}

// ── Google Drive ──────────────────────────────────────────────────────────────

async function listDriveVideos(token) {
  const q = `'${FOLDER_ID}' in parents and mimeType contains 'video/' and trashed=false`;
  const all = [];
  let pageToken = null;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'nextPageToken,files(id,name,size,createdTime)');
    url.searchParams.set('orderBy', 'createdTime');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res  = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.error) throw new Error(`Drive list error: ${data.error.message}`);

    all.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  return all;
}

async function downloadDriveFile(token, fileId, filename) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const path   = join(tmpdir(), filename);
  writeFileSync(path, buffer);
  console.log(`  Downloaded: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
  return path;
}

// ── LLM helpers ──────────────────────────────────────────────────────────────

async function llm(userPrompt, system, maxTokens = 500) {
  if (ANTHROPIC_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userPrompt }] }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (text) return text;
    console.log('Claude unavailable — trying OpenAI...');
  }
  if (OPENAI_KEY) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }] }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  }
  return null;
}

// ── Filename parser ───────────────────────────────────────────────────────────
// Filenames follow: creatorhandle_Video_Title_Words_YYYY-MM-DD_VideoID_TikTokID.mp4

function parseFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const dateMatch = base.match(/^(.+?)_(\d{4}-\d{2}-\d{2})_.+$/);
  if (dateMatch) {
    const beforeDate = dateMatch[1];
    const idx = beforeDate.indexOf('_');
    if (idx > -1) {
      const creator  = '@' + beforeDate.slice(0, idx);
      const rawTitle = beforeDate.slice(idx + 1).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      return { creator, rawTitle };
    }
  }
  // fallback: no date pattern found
  const idx = base.indexOf('_');
  return {
    creator:  idx > -1 ? '@' + base.slice(0, idx) : null,
    rawTitle: (idx > -1 ? base.slice(idx + 1) : base).replace(/_/g, ' ').trim(),
  };
}

// ── Creator research ─────────────────────────────────────────────────────────

async function findCreators(topic) {
  if (!PERPLEXITY_KEY) return { mentions: [], tags: [] };

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Return only a JSON object. No markdown, no explanation.',
          },
          {
            role: 'user',
            content: `For a YouTube Short about: "${topic}"

Find:
1. The original creator or source of this content (if it's a clip, trend, or remix — who made the original?)
2. 3-5 highly relevant YouTube channels or public figures whose audience would love this video

Return exactly this JSON:
{
  "original": "@YouTubeHandle or null",
  "related": ["@Handle1", "@Handle2", "@Handle3"],
  "tags": ["CreatorName1", "CreatorName2", "topic keyword", "niche keyword"]
}

Use real YouTube @handles where known. If unknown, use null.`,
          },
        ],
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');

    const mentions = [
      ...(json.original ? [json.original] : []),
      ...(json.related ?? []),
    ].filter(h => h && h.startsWith('@')).slice(0, 5);

    return { mentions, tags: json.tags ?? [] };
  } catch {
    return { mentions: [], tags: [] };
  }
}

// ── Metadata generation ───────────────────────────────────────────────────────

async function generateMetadata(filename) {
  const { creator, rawTitle } = parseFilename(filename);
  const safeBase = rawTitle.slice(0, 80);

  // Research creators and generate metadata in parallel
  const [text, creators] = await Promise.all([
    llm(
      `Write YouTube Shorts metadata for this video.

Original creator: ${creator ?? 'unknown'}
Original title hint: "${rawTitle}"

Format exactly:
TITLE: [under 80 chars, punchy and compelling — rewrite the title hook, do NOT just copy it verbatim]
DESCRIPTION: [2-3 short paragraphs: hook sentence, what the video covers, call to action. 100-150 words total.]
TAGS: [15 comma-separated tags — trending Shorts tags + topic-specific niche tags]`,
      'You are a YouTube SEO expert for a Shorts channel about mindset, consciousness, AI, and autonomous living. Rewrite titles to maximize click-through in the Shorts feed. No clickbait — be authentic and sharp.',
      600
    ),
    findCreators(rawTitle),
  ]);

  // Always guaranteed a valid short title even if both LLMs fail
  const fallbackTitle = safeBase.slice(0, 97).trimEnd() + (safeBase.length > 97 ? '...' : '');

  let title       = (text?.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim() ?? fallbackTitle).slice(0, 100);
  let description = text?.match(/DESCRIPTION:\s*([\s\S]*?)(?=\nTAGS:)/)?.[1]?.trim() ?? rawTitle;
  const tagsRaw   = text?.match(/^TAGS:\s*(.+)$/m)?.[1]?.trim() ?? '';
  let tags        = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  // Build @mentions: parsed creator from filename + Perplexity results
  const allMentions = [
    ...(creator ? [creator] : []),
    ...creators.mentions.filter(h => h !== creator),
  ].slice(0, 6);

  if (allMentions.length > 0) {
    description += `\n\n${allMentions.join(' ')}`;
    console.log(`  Creators tagged: ${allMentions.join(', ')}`);
  }

  tags = [...new Set([...tags, ...creators.tags, 'Shorts', '#Shorts'])].slice(0, 30);

  return { title, description, tags };
}

// ── Thumbnail generation ──────────────────────────────────────────────────────

async function generateThumbnailPrompt(title, description) {
  return llm(
    `Write a Fal.ai image prompt for a YouTube thumbnail for this video:
Title: "${title}"
Topic: "${description.slice(0, 200)}"

Requirements: bold large text overlay showing the title, high contrast colors, dramatic lighting,
professional photography or cinematic style, eye-catching, 16:9 landscape format.
Style: dark background with bright accent colors (electric blue, gold, or neon),
photorealistic or hyper-detailed illustration.

Respond with ONLY the image prompt, nothing else.`,
    'You write image generation prompts for viral YouTube thumbnails. Be specific and visual.',
    150
  );
}

async function generateThumbnail(title, description) {
  if (!FAL_KEY) { console.log('  ⚠ No FAL_API_KEY — skipping thumbnail'); return null; }

  const prompt = await generateThumbnailPrompt(title, description);
  if (!prompt) return null;

  console.log('  Generating thumbnail...');
  try {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method:  'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size:    'landscape_16_9',  // 1280×720 — perfect for YouTube
        num_images:    1,
        output_format: 'jpeg',
        num_inference_steps: 4,
      }),
    });
    const data = await res.json();
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) { console.log('  ⚠ Thumbnail generation failed'); return null; }

    // Download the image
    const imgRes = await fetch(imageUrl);
    return Buffer.from(await imgRes.arrayBuffer());
  } catch (err) {
    console.log(`  ⚠ Thumbnail error: ${err.message}`);
    return null;
  }
}

async function setThumbnail(token, videoId, imageBuffer) {
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'image/jpeg',
      },
      body: imageBuffer,
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// ── YouTube upload ────────────────────────────────────────────────────────────

async function uploadToYouTube(token, videoPath, metadata) {
  const videoData = readFileSync(videoPath);
  const mimeType  = 'video/*';

  // Step 1: initiate resumable upload session
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method:  'POST',
      headers: {
        Authorization:             `Bearer ${token}`,
        'Content-Type':            'application/json',
        'X-Upload-Content-Type':   mimeType,
        'X-Upload-Content-Length': String(videoData.length),
      },
      body: JSON.stringify({
        snippet: {
          title:       metadata.title,
          description: metadata.description,
          tags:        metadata.tags,
          categoryId:  '22', // People & Blogs
        },
        status: {
          privacyStatus:           'public',
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    const body = await initRes.text();
    throw new Error(`No upload URL. Status ${initRes.status}: ${body.slice(0, 200)}`);
  }

  // Step 2: upload the video bytes
  const uploadRes = await fetch(uploadUrl, {
    method:  'PUT',
    headers: {
      'Content-Type':   mimeType,
      'Content-Length': String(videoData.length),
    },
    body: videoData,
  });

  const result = await uploadRes.json();
  if (!result.id) throw new Error(`Upload failed: ${JSON.stringify(result).slice(0, 300)}`);
  return result;
}

// ── Memory ────────────────────────────────────────────────────────────────────

function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) return JSON.parse(readFileSync(MEMORY_FILE, 'utf8'));
  } catch {}
  return { uploadedIds: [], uploads: [] };
}

function saveMemory(memory) {
  if (!existsSync('social')) mkdirSync('social', { recursive: true });
  writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('📺 YouTube Automation\n');

  const memory = loadMemory();
  const token  = await getAccessToken();
  console.log('✓ Authenticated\n');

  if (!FOLDER_ID) { console.log('GDRIVE_FOLDER_ID not set — nothing to do.'); return; }

  let files;
  try {
    files = await listDriveVideos(token);
  } catch (err) {
    console.error(`Drive error: ${err.message}`);
    console.error(`Folder ID used: "${FOLDER_ID}" — verify this matches your Google Drive folder URL`);
    return;
  }
  let newFiles = files.filter(f => !memory.uploadedIds.includes(f.id));

  if (!newFiles.length && files.length > 0) {
    console.log('All videos uploaded — recycling back to the beginning\n');
    memory.uploadedIds = [];
    memory.cycleCount  = (memory.cycleCount ?? 0) + 1;
    newFiles           = files;
  }

  const toUpload = newFiles.slice(0, MAX_PER_RUN);

  console.log(`Drive folder: ${files.length} total, ${newFiles.length} remaining, uploading ${toUpload.length} today (cycle ${memory.cycleCount ?? 1})\n`);

  if (!toUpload.length) {
    console.log('Nothing to upload — no videos in folder yet.');
    return;
  }

  for (const file of toUpload) {
    console.log(`Processing: ${file.name}`);
    let tmpPath = null;
    try {
      const metadata = await generateMetadata(file.name);
      console.log(`  Title:    "${metadata.title}"`);
      console.log(`  Tags:     ${metadata.tags.slice(0, 5).join(', ')}...`);

      tmpPath = await downloadDriveFile(token, file.id, file.name);

      console.log('  Uploading to YouTube...');
      const result = await uploadToYouTube(token, tmpPath, metadata);

      const videoUrl = `https://youtube.com/watch?v=${result.id}`;
      console.log(`  ✓ Live: ${videoUrl}`);

      // Generate and set viral thumbnail
      const thumbBuffer = await generateThumbnail(metadata.title, metadata.description);
      if (thumbBuffer) {
        try {
          await setThumbnail(token, result.id, thumbBuffer);
          console.log('  ✓ Thumbnail set');
        } catch (e) {
          console.log(`  ⚠ Thumbnail failed: ${e.message}`);
        }
      }
      console.log();

      memory.uploadedIds.push(file.id);
      memory.uploads.push({
        driveFileId: file.id,
        filename:    file.name,
        youtubeId:   result.id,
        title:       metadata.title,
        url:         videoUrl,
        uploadedAt:  new Date().toISOString(),
      });

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}\n`);
    } finally {
      if (tmpPath && existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  }

  saveMemory(memory);
  console.log('✅ Done');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
