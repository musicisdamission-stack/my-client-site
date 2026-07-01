// YouTube One-Time Auth Setup
// Run this ONCE locally to get your refresh token, then never again.
//
// Step 1: node social/youtube-auth.js
// Step 2: Open the URL it prints, sign in, copy the code
// Step 3: GOOGLE_AUTH_CODE=<paste_code> GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> node social/youtube-auth.js

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const AUTH_CODE     = process.env.GOOGLE_AUTH_CODE;

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('Usage:');
  console.log('  GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx node social/youtube-auth.js');
  process.exit(1);
}

if (!AUTH_CODE) {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  'urn:ietf:wg:oauth:2.0:oob',
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  });

  console.log('\n── Step 1 ──────────────────────────────────────────');
  console.log('Open this URL in your browser:\n');
  console.log(url);
  console.log('\n── Step 2 ──────────────────────────────────────────');
  console.log('Sign in with your Google account and click Allow.');
  console.log('Copy the authorization code shown on screen.\n');
  console.log('── Step 3 ──────────────────────────────────────────');
  console.log('Run this command with the code pasted in:');
  console.log(`\nGOOGLE_AUTH_CODE=<your_code> GOOGLE_CLIENT_ID=${CLIENT_ID} GOOGLE_CLIENT_SECRET=${CLIENT_SECRET} node social/youtube-auth.js\n`);
  process.exit(0);
}

// Exchange auth code for tokens
const res  = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code:          AUTH_CODE,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  'urn:ietf:wg:oauth:2.0:oob',
    grant_type:    'authorization_code',
  }),
});
const data = await res.json();

if (data.error) {
  console.error('Error:', data.error_description ?? data.error);
  process.exit(1);
}

console.log('\n✓ Success! Add these to GitHub Actions secrets:\n');
console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
console.log('\nDone. You never need to run this again.');
