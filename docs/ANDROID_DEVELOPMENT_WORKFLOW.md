# Android App Development Workflow

This guide explains how to update the KounterPro Android app when you make changes to your web app code.

## Quick Start: Update the App in 1 Command

Whenever you modify your app code, run this single command to rebuild and redeploy:

```bash
cd /Users/a2251/Development/Working-KPro/kounterpro
npx cap run android
```

This command:
- ✅ Copies all your code changes to Android
- ✅ Rebuilds the APK
- ✅ Uninstalls old version from phone
- ✅ Installs updated APK
- ✅ Automatically launches the app

**Expected time:** 2-3 minutes

---

## Where to Make Changes

Make changes to your web app in these directories:

```
src/pages/          → HTML files (index.html, create-bill.html, inventory.html, etc.)
src/pages/scripts/  → JavaScript files (auth.js, billing.js, inventory.js, etc.)
src/pages/styles/   → CSS files (styles.css, dark-mode.css, etc.)
src/pages/assets/   → Images and other assets
```

After making changes, the `npx cap run android` command will pick them up automatically.

---

## Step-by-Step Update Process

### Step 1: Edit Your Code
Modify any HTML, CSS, or JavaScript files in `src/pages/` directory.

**Example:** Edit an invoice calculation:
```bash
# Edit the file
open src/pages/scripts/billing.js
```

### Step 2: Sync to Android
Copy all changes to Android project:

```bash
npx cap copy android
```

This syncs your web files to Android's asset folder.

### Step 3: Rebuild APK
Compile the Android app:

```bash
cd android && ./gradlew assembleDebug -q
```

The APK will be created at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 4: Install on Phone
Install the updated APK on your connected device:

```bash
~/Library/Android/sdk/platform-tools/adb install android/app/build/outputs/apk/debug/app-debug.apk
```

The app will automatically uninstall the old version and install the new one.

---

## Faster Workflow (Recommended)

Combine sync, build, and install into one command:

```bash
cd /Users/a2251/Development/Working-KPro/kounterpro && \
npx cap copy android && \
cd android && \
./gradlew assembleDebug -q && \
~/Library/Android/sdk/platform-tools/adb uninstall com.kounterpro.app 2>/dev/null; \
sleep 2; \
~/Library/Android/sdk/platform-tools/adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or use the simplified command:
```bash
npx cap run android
```

---

## Common Development Tasks

### Task: Fix a Bug in JavaScript
```bash
# 1. Edit the JS file
nano src/pages/scripts/billing.js

# 2. Update and rebuild
npx cap run android
```

### Task: Update Styling/CSS
```bash
# 1. Edit the CSS file
nano src/pages/styles/styles.css

# 2. Update and rebuild
npx cap run android
```

### Task: Add HTML Content
```bash
# 1. Edit the HTML file
nano src/pages/create-bill.html

# 2. Update and rebuild
npx cap run android
```

### Task: Update for Multiple Devices
Build once, install on multiple phones:
```bash
# Build once
cd /Users/a2251/Development/Working-KPro/kounterpro && \
npx cap copy android && \
cd android && \
./gradlew assembleDebug -q

# Then install on each phone connected via USB
adb devices  # List connected devices
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Troubleshooting

### APK Installation Fails
**Error:** "Installation failed"

**Solution:**
```bash
# Uninstall old version first
adb uninstall com.kounterpro.app

# Then install
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Build Takes Too Long
**Problem:** First build takes 2-3 minutes

**Solution:** This is normal. Subsequent builds are faster. Get a ☕ coffee!

### No Changes Appear After Update
**Problem:** Updated app but changes don't show

**Solution:**
```bash
# Ensure you ran cap copy before building
npx cap copy android

# Clear cache and rebuild
cd android && ./gradlew clean && ./gradlew assembleDebug
```

### Phone Not Found
**Problem:** "adb: device not found"

**Solution:**
1. Check phone is connected via USB
2. Enable USB Debugging: **Settings → Developer options → USB Debugging**
3. Approve USB debugging prompt on phone
4. Verify: `adb devices` should show your device

### Gradle Build Fails
**Problem:** "Gradle build failed"

**Solution:**
```bash
# Clean previous builds
cd /Users/a2251/Development/Working-KPro/kounterpro/android
./gradlew clean

# Rebuild
./gradlew assembleDebug -q
```

---

## File Locations Reference

| What | Location |
|------|----------|
| Main app HTML | `src/pages/index.html` |
| Billing page | `src/pages/create-bill.html` |
| Inventory page | `src/pages/inventory.html` |
| Login page | `src/pages/login.html` |
| JavaScript code | `src/pages/scripts/*.js` |
| Stylesheets | `src/pages/styles/*.css` |
| App icons | `src/pages/assets/` |
| Capacitor config | `capacitor.config.ts` |
| Android project | `android/` |
| Built APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Gradle wrapper | `android/gradle/wrapper/gradle-wrapper.properties` |

---

## Important Notes

### DO NOT Edit These Files Directly:
- ❌ Files in `android/` folder (except AndroidManifest.xml for permissions)
- ❌ Files in `android/app/src/main/assets/public/`

These are generated by Capacitor and will be overwritten on next sync.

### ALWAYS Edit These Files:
- ✅ `src/pages/*.html` - UI changes
- ✅ `src/pages/scripts/*.js` - Logic changes
- ✅ `src/pages/styles/*.css` - Styling changes
- ✅ `capacitor.config.ts` - App configuration

---

## Environment Setup Check

Verify your environment is ready:

```bash
# Check Java is installed
java -version

# Check Node.js is installed
node -v && npm -v

# Check Android SDK is installed
ls ~/Library/Android/sdk/

# Check Gradle wrapper
cat android/gradle/wrapper/gradle-wrapper.properties
```

---

## Tips for Efficient Development

1. **Install one phone first** - Test everything works
2. **Share stable APK** - Build release version for beta testers
3. **Keep changes small** - Easier to debug if something breaks
4. **Test on real device** - Emulator sometimes behaves differently
5. **Keep git changes** - Commit your changes to version control

---

## Next Steps

- For a **Release Build** (for Play Store): See [ANDROID_BUILD_INFO.md](ANDROID_BUILD_INFO.md)
- For **Setup Guide**: See [CAPACITOR_SETUP.md](../CAPACITOR_SETUP.md)
- For **Device Debugging**: See [ANDROID_COMMANDS.md](../ANDROID_COMMANDS.md)

---

## Quick Reference Commands

```bash
# One-liner to update everything
npx cap run android

# Just sync changes
npx cap copy android

# Just rebuild
cd android && ./gradlew assembleDebug -q

# Just install
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Check environment
npx cap doctor

# View device logs
adb logcat

# List connected devices
adb devices

# Take screenshot from phone
adb shell screencap /sdcard/screen.png && adb pull /sdcard/screen.png
```

---

Last updated: March 16, 2026
