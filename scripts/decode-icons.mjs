import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const outDir = process.argv[3] || 'public';
if (!src) { console.error('Usage: node decode-icons.mjs <tool-result.txt> [outDir]'); process.exit(1); }

const raw = fs.readFileSync(src, 'utf8');
// Tool result file: first line is a preamble, then the JSON object
const jsonStart = raw.indexOf('{');
const obj = JSON.parse(raw.slice(jsonStart));
fs.mkdirSync(outDir, { recursive: true });
for (const [name, b64] of Object.entries(obj)) {
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`wrote ${name} (${buf.length} bytes)`);
}
