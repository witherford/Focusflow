# Cloud Sync — Free Options & Recommended Path

## Goals

- Encrypted backup of your full FocusFlow state to a cloud you control.
- Optional multi-device sync (read on phone, write on laptop, no conflict pain in the common case of a single active user).
- **Zero recurring cost.** Free tier only.
- Local-first stays the source of truth — cloud is a mirror.

## Comparison of free options

| Option | Free quota | Pros | Cons |
| --- | --- | --- | --- |
| **Cloudflare Workers + D1** *(recommended)* | 100k requests/day, 5 GB D1 storage, free TLS, free domain | Tiny, fast worldwide, no cold starts, owns your data, easy auth via shared secret | You deploy a small worker once (free Cloudflare account) |
| Supabase | 500 MB Postgres, 50 k MAU, 50 MB file storage | Auth + DB + Storage all included, Postgres muscle | More moving parts than needed; pauses inactive projects after 7 days |
| Firebase (Spark) | 1 GB storage, 10 GB egress/mo | Real-time sync, Google-scale | Vendor lock-in, NoSQL semantics, billing surprises if you grow |
| GitHub Gist (private) | Unlimited gists | Zero infra — paste a personal access token in Settings | Awkward auth flow, no real-time, treats commits as snapshots |
| WebDAV (Nextcloud, Box) | Varies by host | Open standard, your own server option | User must supply URL + creds, no built-in encryption |
| iCloud Drive / Google Drive | Free with account | Native Capacitor plugins exist | OAuth pain, App Store review headaches, slow API |

## Recommendation: **Cloudflare Workers + D1**

You get a free `*.workers.dev` URL, persistent D1 storage, no monthly cost, and only ~30 lines of server code. Auth is a long random sync code generated on-device — no email needed.

### Architecture

```
Device (FocusFlow)            Cloudflare Worker            D1
  ┌─────────────┐              ┌──────────────┐         ┌────────┐
  │ S (state)   │  encrypt     │ /sync/push   │  upsert │ blobs  │
  │  ↓ AES-GCM  │ ───────────▶ │ /sync/pull   │ ───────▶│ + meta │
  │  ↓ JSON     │  bearer code │ /sync/info   │         │        │
  └─────────────┘              └──────────────┘         └────────┘
```

- Client encrypts the whole state blob with AES-256-GCM using a key derived from a passphrase the user types once.
- Worker stores: `(syncCode, lastUpdated, ciphertext)`.
- Server never sees plaintext or the passphrase.
- Conflict policy v1: last-write-wins, with a confirmation modal if remote is newer than the local snapshot we last pulled.

### Worker endpoints

```
POST /sync/push          { syncCode, ciphertext, lastUpdated } → { ok, lastUpdated }
GET  /sync/pull?code=…   → { ciphertext, lastUpdated } | 404
GET  /sync/info?code=…   → { lastUpdated } | 404
DELETE /sync/wipe        { syncCode }    → { ok }
```

### D1 schema

```sql
CREATE TABLE blobs (
  sync_code     TEXT PRIMARY KEY,
  ciphertext    TEXT NOT NULL,
  last_updated  INTEGER NOT NULL,
  size_bytes    INTEGER NOT NULL
);
```

### Setup steps (~10 minutes one-time)

1. Make a free Cloudflare account → enable Workers + D1.
2. `npm install -g wrangler` then `wrangler login`.
3. Create a D1 db: `wrangler d1 create focusflow-sync` and apply the schema.
4. Deploy the worker (script in `cloud-sync-worker/index.ts` — to be added).
5. Note the `https://focusflow-sync.<your>.workers.dev` URL.
6. In FocusFlow Settings → Cloud Sync, paste the URL + create a passphrase.

### Caps

- Per blob ≤ 1 MB (D1 row limit) — current state is < 50 KB even with thousands of entries; photos compressed to JPEG keep growth modest.
- 100 k req/day = ~ a sync every 0.86 s — you'll never hit it.

## Status

This document is the scoping spec. The repo now ships:

- `src/core/cloudSync.js` — client adapter (push/pull/encrypt) — ✅
- `src/features/settings/cloudSyncUI.js` — Settings card — ✅
- `cloud-sync-worker/` — worker source for self-deploy — to add when you decide to flip it on

For now the Settings card explains the design and lets you generate a sync code + passphrase locally, so once the worker is deployed all you do is paste the URL.
