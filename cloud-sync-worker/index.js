// Cloudflare Worker — FocusFlow encrypted sync.
// Deploy: `wrangler deploy` (after `wrangler d1 create focusflow-sync` and applying schema.sql).
// CORS allows any origin so the PWA on github.io and your phone all work.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

const MAX_BLOB_BYTES = 1_000_000; // 1 MB

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    try {
      if (path === '/sync/push' && request.method === 'POST') return await push(request, env);
      if (path === '/sync/pull' && request.method === 'GET')  return await pull(url, env);
      if (path === '/sync/info' && request.method === 'GET')  return await info(url, env);
      if (path === '/sync/wipe' && request.method === 'DELETE') return await wipe(request, env);
      if (path === '' || path === '/') return new Response('FocusFlow sync worker — see /sync/*', { headers: CORS });
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: e.message || 'server_error' }, 500);
    }
  }
};

function validCode(c) {
  return typeof c === 'string' && c.length >= 12 && c.length <= 64 && /^[A-Za-z0-9_-]+$/.test(c);
}

async function push(req, env) {
  const body = await req.json();
  if (!validCode(body.syncCode)) return json({ error: 'bad_code' }, 400);
  if (typeof body.ciphertext !== 'string' || body.ciphertext.length === 0) return json({ error: 'bad_blob' }, 400);
  const size = body.ciphertext.length;
  if (size > MAX_BLOB_BYTES) return json({ error: 'too_large', max: MAX_BLOB_BYTES }, 413);
  const ts = body.lastUpdated || Date.now();
  await env.DB.prepare(
    `INSERT INTO blobs (sync_code, ciphertext, last_updated, size_bytes)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(sync_code) DO UPDATE SET ciphertext=excluded.ciphertext, last_updated=excluded.last_updated, size_bytes=excluded.size_bytes`
  ).bind(body.syncCode, body.ciphertext, ts, size).run();
  return json({ ok: true, lastUpdated: ts });
}

async function pull(url, env) {
  const code = url.searchParams.get('code') || '';
  if (!validCode(code)) return json({ error: 'bad_code' }, 400);
  const row = await env.DB.prepare(`SELECT ciphertext, last_updated FROM blobs WHERE sync_code = ?1`).bind(code).first();
  if (!row) return json({ error: 'not_found' }, 404);
  return json({ ciphertext: row.ciphertext, lastUpdated: row.last_updated });
}

async function info(url, env) {
  const code = url.searchParams.get('code') || '';
  if (!validCode(code)) return json({ error: 'bad_code' }, 400);
  const row = await env.DB.prepare(`SELECT last_updated, size_bytes FROM blobs WHERE sync_code = ?1`).bind(code).first();
  if (!row) return json({ error: 'not_found' }, 404);
  return json({ lastUpdated: row.last_updated, sizeBytes: row.size_bytes });
}

async function wipe(req, env) {
  const body = await req.json();
  if (!validCode(body.syncCode)) return json({ error: 'bad_code' }, 400);
  await env.DB.prepare(`DELETE FROM blobs WHERE sync_code = ?1`).bind(body.syncCode).run();
  return json({ ok: true });
}
