// AI helper — Pollinations text endpoint. POST is far more reliable than GET
// (no URL length limits, proper JSON mode, fewer encoding issues).
const POLLINATIONS_POST = 'https://text.pollinations.ai/';
const POLLINATIONS_GET  = 'https://text.pollinations.ai/';

async function postChat(prompt, { jsonMode = false, model = 'openai' } = {}) {
  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Reply with valid JSON when asked, no markdown fences.' },
      { role: 'user', content: prompt },
    ],
    seed: Math.floor(Math.random() * 99999),
  };
  if (jsonMode) body.jsonMode = true;
  const res = await fetch(POLLINATIONS_POST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pollinations POST ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.text();
}

async function getChat(prompt) {
  const url = POLLINATIONS_GET + encodeURIComponent(prompt) + '?model=openai&seed=' + Math.floor(Math.random() * 99999);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations GET ${res.status}`);
  return await res.text();
}

// Public API. `onProgress` kept for backwards-compat (we don't stream POST).
export async function callAI(prompt, onProgress, opts = {}) {
  // Prefer POST. Fall back to GET on network/parse failure.
  try {
    const out = await postChat(prompt, opts);
    if (onProgress) onProgress(out);
    return out;
  } catch (err1) {
    console.warn('[ai] POST failed, falling back to GET', err1);
    try {
      const out = await getChat(prompt);
      if (onProgress) onProgress(out);
      return out;
    } catch (err2) {
      console.error('[ai] GET fallback also failed', err2);
      throw err2;
    }
  }
}

export function extractJSON(raw, arr) {
  if (raw && typeof raw === 'object') return raw;
  raw = (raw || '').trim();
  // Strip markdown fences.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  // Pollinations sometimes wraps in `{"response": ...}`.
  // Prefer extracting the bracketed/braced section ourselves.
  const open = arr ? '[' : '{', close = arr ? ']' : '}';
  const s = raw.indexOf(open);
  const e = raw.lastIndexOf(close);
  if (s !== -1 && e !== -1 && e > s) raw = raw.slice(s, e + 1);
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Try to repair common quote/comma issues.
    const repaired = raw
      .replace(/,\s*([\]}])/g, '$1')        // trailing commas
      .replace(/[“”]/g, '"')       // smart quotes
      .replace(/[‘’]/g, "'");
    return JSON.parse(repaired);
  }
}

if (typeof window !== 'undefined') {
  window.callAI = callAI;
  window.extractJSON = extractJSON;
}
