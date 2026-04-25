# FocusFlow Sync Worker

Tiny Cloudflare Worker that stores end-to-end encrypted FocusFlow snapshots in D1.

## One-time setup (~10 minutes, free)

```bash
# 1. Install wrangler globally
npm i -g wrangler
wrangler login                                  # opens browser

# 2. Create the D1 database (free)
cd cloud-sync-worker
wrangler d1 create focusflow-sync
# Copy the printed database_id into wrangler.toml

# 3. Apply the schema
wrangler d1 execute focusflow-sync --file=./schema.sql

# 4. Deploy
wrangler deploy
# Note the URL it prints, e.g. https://focusflow-sync.YOURUSER.workers.dev
```

## Use it

In FocusFlow → Settings → Cloud sync:
1. Paste the Worker URL.
2. Click "↻ New" to generate a sync code.
3. Type a strong passphrase. **You must remember it — it isn't stored.**
4. Click "💾 Save settings", then "⬆ Push" to upload your encrypted snapshot.
5. On a second device, paste the same URL + sync code + passphrase, then "⬇ Pull".

## Free tier

- D1: 5 GB storage, 5 M reads/day, 100 k writes/day on the workers.dev free plan.
- Workers: 100 k requests/day.
- TLS: free, automatic.
- A typical FocusFlow blob is 10–50 KB; you'll never approach the limits.

## Deleting your data

```
DELETE /sync/wipe   { "syncCode": "..." }
```

The Settings UI doesn't expose this yet — POST it manually with `curl` if needed.
