// LiminalArbitrage Verification Solver — L402 gated
// POST /solve { image_base64: "..." } → { answer: 42 }
// Returns HTTP 402 + Lightning invoice if unpaid

const PRICE_SATS = 10;

async function createInvoice(albyToken) {
  const res = await fetch('https://api.getalby.com/invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${albyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: PRICE_SATS,
      memo: 'Moltbook verification solve — LiminalArbitrage',
    }),
  });
  return res.json();
}

async function isInvoicePaid(albyToken, paymentHash) {
  const res = await fetch(`https://api.getalby.com/invoices/${paymentHash}`, {
    headers: { 'Authorization': `Bearer ${albyToken}` },
  });
  const data = await res.json();
  return data.settled === true;
}

async function solveWithClaude(imageBase64, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: 'Solve this math challenge. Reply with ONLY the integer answer.' },
        ],
      }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim();
  const n = parseInt(text);
  return isNaN(n) ? null : n;
}

async function solveWithGemini(imageBase64, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/png', data: imageBase64 } },
            { text: 'What is the numeric answer to the math problem in this image? Reply with ONLY the integer.' },
          ],
        }],
        generationConfig: { maxOutputTokens: 16, temperature: 0 },
      }),
    }
  );
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  const n = parseInt(text);
  return isNaN(n) ? null : n;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', price_sats: PRICE_SATS, agent: 'LiminalArbitrage' });
    }

    if (url.pathname !== '/solve') {
      return new Response('Not found', { status: 404 });
    }
    if (request.method !== 'POST') {
      return new Response('POST required', { status: 405 });
    }

    // L402 gate — check Authorization: Bearer <payment_hash>
    const auth = request.headers.get('Authorization') ?? '';
    let paid = false;

    if (auth.startsWith('Bearer ')) {
      const paymentHash = auth.slice(7).trim();
      paid = await isInvoicePaid(env.ALBY_TOKEN, paymentHash).catch(() => false);
    }

    if (!paid) {
      const invoice = await createInvoice(env.ALBY_TOKEN);
      return Response.json(
        {
          error: 'Payment required',
          price_sats: PRICE_SATS,
          payment_request: invoice.payment_request,
          payment_hash: invoice.payment_hash,
          instructions: 'Pay the Lightning invoice, then POST again with: Authorization: Bearer <payment_hash>',
        },
        {
          status: 402,
          headers: {
            'WWW-Authenticate': `L402 macaroon="${invoice.payment_hash}", invoice="${invoice.payment_request}"`,
          },
        }
      );
    }

    // Paid — solve
    let body;
    try { body = await request.json(); }
    catch { return Response.json({ error: 'JSON body required' }, { status: 400 }); }

    const imageBase64 = body.image_base64 || body.image;
    if (!imageBase64) {
      return Response.json({ error: 'image_base64 field required' }, { status: 400 });
    }

    // Triple solver: Claude Haiku → Gemini Lite → null
    const [claudeAnswer, geminiAnswer] = await Promise.all([
      solveWithClaude(imageBase64, env.ANTHROPIC_API_KEY).catch(() => null),
      solveWithGemini(imageBase64, env.GEMINI_API_KEY).catch(() => null),
    ]);

    // Majority vote: if both agree, high confidence. If one null, use the other.
    let answer = null;
    let confidence = 'low';

    if (claudeAnswer !== null && geminiAnswer !== null) {
      if (claudeAnswer === geminiAnswer) {
        answer = claudeAnswer;
        confidence = 'high';
      } else {
        answer = claudeAnswer; // Claude wins on split
        confidence = 'medium';
      }
    } else {
      answer = claudeAnswer ?? geminiAnswer;
      confidence = answer !== null ? 'medium' : 'failed';
    }

    if (answer === null) {
      return Response.json({ error: 'Could not solve challenge — refund not automatic, retry recommended' }, { status: 500 });
    }

    return Response.json({ answer, confidence, solvers: { claude: claudeAnswer, gemini: geminiAnswer } });
  },
};
