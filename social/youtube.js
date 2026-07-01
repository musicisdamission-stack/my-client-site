// YouTube Automation — LiminalArbitrage
// Checks a Google Drive folder for new videos, generates metadata with Claude,
// uploads to YouTube. Runs daily via GitHub Actions.

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const FOLDER_ID     = process.env.GDRIVE_FOLDER_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const MEMORY_FILE   = 'social/youtube-memory.json';

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
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,createdTime)&orderBy=createdTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Drive list error: ${data.error.message}`);
  return data.files ?? [];
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

// ── Claude metadata ───────────────────────────────────────────────────────────

async function generateMetadata(filename) {
  const baseName = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

  if (!ANTHROPIC_KEY) {
    return {
      title:       baseName,
      description: baseName,
      tags:        ['AI', 'technology', 'LiminalArbitrage'],
    };
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:     'You are a YouTube SEO expert for a channel about AI, consciousness, technology-nature harmony, music production, and autonomous living. Write compelling, authentic metadata — not clickbait.',
      messages: [{
        role:    'user',
        content: `Write YouTube metadata for a video. The filename gives the topic hint: "${filename}"

Format exactly:
TITLE: [under 80 chars, compelling, specific]
DESCRIPTION: [3 short paragraphs: what the video covers, why it matters, call to action. 150-250 words total.]
TAGS: [12 comma-separated tags, mix of broad and specific]`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() ?? '';

  const title       = text.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim()           ?? baseName;
  const description = text.match(/DESCRIPTION:\s*([\s\S]*?)(?=\nTAGS:)/)?.[1]?.trim() ?? baseName;
  const tagsRaw     = text.match(/^TAGS:\s*(.+)$/m)?.[1]?.trim()            ?? '';
  const tags        = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 15);

  return { title, description, tags };
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

  const files    = await listDriveVideos(token);
  const newFiles = files.filter(f => !memory.uploadedIds.includes(f.id));

  console.log(`Drive folder: ${files.length} video(s) found, ${newFiles.length} new\n`);

  if (!newFiles.length) {
    console.log('Nothing to upload.');
    return;
  }

  for (const file of newFiles) {
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
      console.log(`  ✓ Live: ${videoUrl}\n`);

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
