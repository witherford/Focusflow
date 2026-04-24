# Schema & Migration Log

Current schema: **v2**.

## Storage layout

| Where | Key / bucket | Contents |
|---|---|---|
| localStorage | `ff:v2:core` | Slices: settings, profile, habits, chores, projects, tasks, goals, fitness, meta |
| localStorage | `ff7` | v1 blob kept as backup until one post-migration release |
| localStorage | `ff.sec:*` | Passcode salt + verifier (Capacitor Preferences on native) |
| IndexedDB (`idb-keyval`) | `ff.habitLog` | Date-keyed `{ [YYYY-MM-DD]: { habitId: count } }` |
| IndexedDB | `ff.choreLog` | Week-keyed chore completion |
| IndexedDB | `ff.dwSessions` | Deep-work session history |
| IndexedDB | `ff.medSessions` | Meditation session history |
| IndexedDB | `ff.fitSessions` | Fitness sessions + PRs |
| IndexedDB | `ff.journal` | Plaintext entries **or** encrypted ciphertext records |

## Slice shapes (v2)

**meta**: `{ schemaVersion: 2, createdAt, lastMigration }`

**settings**: `{ theme, aiEnabled, incrementalHabits, passcodeSalt?, passcodeVerifier?, habitJournalPrompt? }`

**habits[]**: `{ id, name, block, icon, mode: 'binary'|'counter', target?, unit?, incrementStep?, cumulative?, tier?, tierBase?, profileLink? }`

**tasks[]**: `{ id, projectId?, goalId?, parentId?, name, done, priority?, due?, accruedMinutes? }`

**goals[]**: `{ id, name, milestones: [{id, name, done}], minuteTarget? }` — goals pull linked `tasks[].goalId` for progress.

**fitness**: `{ modalities: [], sessions: [], prs: [] }`
  - modality: `{ id, name, type: 'weightlifting'|'cardio'|'martial'|'custom', fields }`
  - session: `{ id, modalityId, date, sets?, distance?, duration?, rounds?, notes }`

**journal[]** (plain): `{ id, type, text, createdAt, habitId? }`
**journal ciphertext record**: `{ id, iv (base64), ct (base64), meta: { createdAt, habitId?, type? } }`

## Migrations

### v1 → v2 (`migrate_1_to_2`)
- Read `localStorage.ff7` if present; write `ff7.bak`; never delete v1 until proven.
- Split monolithic blob into sliced `ff:v2:core` + IDB buckets.
- Habits default `mode: 'binary'`; existing completion log copied into IDB `habitLog`.
- Goals gain empty `milestones[]` if absent.
- Tasks normalize `priority` / `due` fields.
- Fitness slice seeded empty.
- Meta set to `{ schemaVersion: 2, lastMigration: 'v1→v2', ... }`.

### v2 → v3 (planned, on first passcode set)
- When user sets passcode: encrypt existing `S.journal` with derived key, write to IDB, clear plaintext bucket.
- Stored: salt + verifier in secureStorage; key derived on unlock.

## Invariants
1. Migrations are pure, idempotent functions keyed on `meta.schemaVersion`.
2. Timer ticks never trigger persistence — only session stop does.
3. Per-slice writes are debounced 400ms.
4. When `passcodeSalt && passcodeVerifier` are set, `persistence.writeAll` skips `ff.journal` (managed by `features/journal/encryption.js`).
5. `S.journal` is `[]` in memory on load when encrypted — populated only after unlock.

## Backup format
```json
{
  "app": "focusflow",
  "schemaVersion": 2,
  "exportedAt": "2026-04-21T12:00:00Z",
  "core": { /* ff:v2:core */ },
  "buckets": { "habitLog": {}, "choreLog": {}, "dwSessions": [], "medSessions": [], "fitSessions": [], "journal": [] }
}
```
Encrypted journal exports the ciphertext records as-is; they're unreadable without the passcode.
