# Release Checklist

## Android (Phase 8) — user-local steps

```bash
npx cap init "FocusFlow" com.focusflow.app --web-dir=dist
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

In Android Studio:
1. Build → Generate Signed Bundle / APK → Android App Bundle.
2. Create keystore (`focusflow-release.jks`) — **back this up; losing it locks you out of future updates**.
3. Release → Play Console → Internal testing track first.

Required Play Console assets:
- App icon 512×512 PNG
- Feature graphic 1024×500
- Phone screenshots (min 2, 16:9 or 9:16)
- Short description (≤80 chars), full description (≤4000)
- Content rating questionnaire
- Data safety form: "Data is collected? No." "Data is shared? No." Reference [privacy-policy.md](privacy-policy.md)

## iOS (Phase 9) — needs macOS + Apple Developer ($99/yr)

```bash
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:
1. Signing & Capabilities → select team, bundle id `com.focusflow.app`.
2. Add capabilities if needed: Background Modes → Audio (only if ambient audio must play backgrounded).
3. Product → Archive → Distribute App → App Store Connect → TestFlight.

Required App Store Connect assets:
- 1024×1024 app icon
- Screenshots: 6.7" (iPhone 15 Pro Max), 6.1", 12.9" iPad Pro
- App description, keywords (100 chars), support URL (can be GitHub page)
- Privacy policy URL (host [privacy-policy.md](privacy-policy.md) publicly)
- App privacy questionnaire: "Data Not Collected"

## Both stores

- Host privacy policy at a stable URL (GitHub Pages is fine).
- Test build on physical device once before submitting.
- Version bump: `package.json` version + `android/app/build.gradle` versionCode/versionName + Xcode version/build.

## Gradle signing config (one-time, after `npx cap add android`)

Edit `android/app/build.gradle` — inside `android { ... }`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

Add `android/keystore.properties` and `android/app/focusflow-release.jks` to `.gitignore` — never commit.

## GitHub Actions (android-release.yml)

Secrets to set in repo → Settings → Secrets → Actions:
- `ANDROID_KEYSTORE_BASE64` — `[Convert]::ToBase64String([IO.File]::ReadAllBytes("focusflow-release.jks"))` (PowerShell)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Trigger: push a tag `v0.1.0` or run the workflow manually. Artifacts land in the Actions run + a draft GitHub Release (on tag).

## Optional: crash reporting

If you want Sentry (opt-in), install `@sentry/browser`, init only when user enables it in settings. Do NOT init by default — our privacy policy says no telemetry.
