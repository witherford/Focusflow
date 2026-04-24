// AI helper — extracted from focusflow_v10.html lines 1422-1436
export async function callAI(prompt, onProgress) {
  const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=openai&json=true&seed=' + Math.floor(Math.random() * 99999);
  const r = await fetch(url); if (!r.ok) throw new Error('AI error ' + r.status);
  if (onProgress && r.body) {
    const rd = r.body.getReader(), dec = new TextDecoder(); let full = '';
    while (true) {
      const { done, value } = await rd.read(); if (done) break;
      full += dec.decode(value, { stream: true }); onProgress(full);
    }
    return full;
  }
  return await r.text();
}

export function extractJSON(raw, arr) {
  if (raw && typeof raw === 'object') return raw;
  raw = (raw || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) raw = fence[1].trim();
  const s = arr ? raw.indexOf('[') : raw.indexOf('{');
  const e = arr ? raw.lastIndexOf(']') : raw.lastIndexOf('}');
  if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
  return JSON.parse(raw);
}

window.callAI = callAI;
window.extractJSON = extractJSON;
