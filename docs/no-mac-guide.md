# Shipping FocusFlow without owning a Mac

You can install on your iPhone three ways, in increasing order of polish and cost.

---

## Option 1 — PWA on iPhone (free, today)

The fastest path. No developer account, no review, no CI.

1. Host `dist/` anywhere free:
   - **GitHub Pages**: push `dist/` to a `gh-pages` branch (or use `peaceiris/actions-gh-pages`)
   - **Netlify / Cloudflare Pages / Vercel**: drag-drop `dist/` folder
2. Open the hosted URL in **Safari** on your iPhone.
3. Share button → **Add to Home Screen**.
4. Launch from the home-screen icon — it runs full-screen, works offline, saves locally.

**What you get:** 95% of the app experience. Encrypted journal, haptics (iOS 17.4+), notifications (iOS 16.4+ when installed to home screen), wake-lock during timers (iOS 16.4+).

**What you don't get:** App Store listing, TestFlight beta distribution, some background behaviors. Ambient audio may need a tap to unlock each session on iOS.

---

## Option 2 — TestFlight via GitHub Actions ($99/yr, 1 day setup)

Build + sign + ship to your iPhone via TestFlight, never touching a Mac.

### One-time setup
1. **Enroll in Apple Developer Program** — apple.com/developer, $99/yr. Requires a verified Apple ID. You can enroll entirely from your iPhone or a browser.
2. **Create App Store Connect API key**:
   - App Store Connect → Users & Access → Keys → **+**
   - Role: **App Manager**
   - Download the `.p8` file (only shown once). Note Key ID and Issuer ID.
3. **Register App ID**:
   - developer.apple.com → Certificates, IDs & Profiles → Identifiers → **+**
   - Bundle ID: `com.focusflow.app`
4. **Create TestFlight app record**:
   - App Store Connect → My Apps → **+** → New App
   - Platform: iOS, Bundle ID: `com.focusflow.app`, Name: FocusFlow
5. **Create a private GitHub repo** for fastlane match (stores your signing cert encrypted). Generate a personal access token with repo access.
6. **Add secrets** to the FocusFlow repo → Settings → Secrets → Actions:
   - `APP_STORE_CONNECT_API_KEY_ID`
   - `APP_STORE_CONNECT_API_ISSUER_ID`
   - `APP_STORE_CONNECT_API_KEY_P8` (paste full `.p8` contents including `-----BEGIN/END PRIVATE KEY-----`)
   - `MATCH_GIT_URL` (https URL of the private match repo)
   - `MATCH_GIT_TOKEN` (PAT)
   - `MATCH_PASSWORD` (any passphrase you choose)
   - `APPLE_TEAM_ID` (10-char from developer.apple.com → Membership)

### Each release
```bash
git tag v0.1.0 && git push origin v0.1.0
```
GitHub Actions runs `.github/workflows/ios-release.yml`. On first run it creates the distribution cert and stores it encrypted in your match repo. On subsequent runs it reuses. Build uploads to TestFlight.

### Install on iPhone
1. Install the **TestFlight** app from the App Store.
2. After the build finishes processing in App Store Connect (~15 min), you get an email.
3. Open TestFlight on your iPhone → FocusFlow → Install.

### Cost: $99/yr. Per-build: free (2000 min/mo GitHub Actions free tier; macOS minutes cost 10x, so ~200 build-min/mo).

---

## Option 3 — App Store submission ($99/yr, same setup + review)

Same workflow as Option 2. After the build is live on TestFlight:
1. In App Store Connect → your app → App Store tab → Prepare for Submission.
2. Fill out metadata from [store-listing.md](store-listing.md).
3. Upload screenshots (capture them from TestFlight on your iPhone or an iPhone Simulator in a cloud Mac).
4. Link privacy policy URL ([privacy-policy.md](privacy-policy.md) hosted on your Pages site).
5. Submit for review. Typical review time: 24–48h.

---

## Android without an Android phone

1. Install **Android Studio** on Windows (free). Includes the emulator.
2. Run `npx cap add android` once locally, then open in Android Studio.
3. Build → Generate Signed Bundle. First time: create a keystore (keep it safe forever — without it you can't update the app).
4. Test on the emulator (Pixel 6, API 34 is a good default).
5. Enroll in Google Play Console ($25 one-time).
6. Upload AAB to Internal Testing track → add your Google account as a tester → install from Play Store on any Android device later.

Or: set up secrets for `.github/workflows/android-release.yml` and let CI build every tag.

---

## My strong recommendation

Start with **Option 1 (PWA)** this week. If it covers your needs, stop there — you save $99/yr and App Store review friction. Only escalate to Options 2/3 if you genuinely need store distribution (sharing with others who expect an App Store link) or native-only capabilities.

The whole point of the Capacitor layer is that it's an *option* you can exercise later without rework.
