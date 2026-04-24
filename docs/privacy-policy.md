# FocusFlow Privacy Policy

_Last updated: 2026-04-21_

FocusFlow is a personal productivity app. We have designed it to keep your data on your device.

## What we collect

**Nothing on our servers.** FocusFlow has no backend account system. All your habits, tasks, goals, sessions, journal entries, and settings are stored locally on your device using your browser/app's local storage and IndexedDB.

## Optional AI assistant

If you enable the AI assistant in Profile settings, FocusFlow sends the text of your prompt (and only the prompt) over HTTPS to the Pollinations API (`https://text.pollinations.ai/`). We do not send your habits, journal entries, or any other app data. The AI feature is off by default and can be disabled at any time.

## Journal encryption

Journal entries can be protected with a passcode. When set, entries are encrypted on your device with AES‑GCM 256, derived from your passcode via PBKDF2‑SHA256 (250,000 iterations). Your passcode is never stored, never transmitted, and cannot be recovered. Resetting the passcode deletes all encrypted entries.

## Notifications

If you grant notification permission, FocusFlow uses it to remind you of timer completions and streaks. Notifications are scheduled locally by your device. Nothing is sent to us.

## Backups

The backup feature creates a JSON file containing your data. You choose where that file goes (local disk, cloud drive, email, etc.). FocusFlow does not upload backups anywhere.

## Permissions we request

- **Notifications** — local reminders (opt-in).
- **Haptics / vibration** — feedback on habit toggles (automatic; no permission prompt).
- **Wake lock / keep awake** — keeps screen on during timers.
- **Filesystem / sharing** — export/import backup files you initiate.

## Third parties

- **Pollinations AI** — only if you enable AI assistant, and only receives your prompt text.
- No analytics, no advertising, no tracking SDKs.

## Children

FocusFlow is not directed at children under 13. We do not knowingly collect data from anyone.

## Changes

Policy updates will be reflected here with a new "Last updated" date.

## Contact

witherford.m@hotmail.com
