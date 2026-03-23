# Capacitor Setup Guide for KounterPro Android App

## Prerequisites

Before you start, make sure you have:

1. **Node.js & npm** (v14 or higher)
   - Check: `node --version` and `npm --version`

2. **Java Development Kit (JDK)**
   - Download JDK 11 or higher from: https://www.oracle.com/java/technologies/downloads/

3. **Android Studio** (for emulator/device testing)
   - Download from: https://developer.android.com/studio
   - Install Android SDK tools

4. **Android SDK** (automatically installed with Android Studio)
   - Check: Android Studio → SDK Manager → APIs >= 24

---

## Step-by-Step Setup

### Step 1: Initialize Capacitor in your project

```bash
cd ~/Development/Working-KPro/kounterpro
npm init -y
npm install @capacitor/core @capacitor/cli
```

### Step 2: Initialize Capacitor with your app

```bash
npx cap init KounterPro com.kounterpro.app
```

When prompted:
- App name: `KounterPro`
- App Package ID: `com.kounterpro.app`
- Web assets directory: `src/pages`

### Step 3: Add Android platform

```bash
npm install @capacitor/android
npx cap add android
```

This creates an `android/` folder with the native Android project.

### Step 4: Copy web files to Capacitor

```bash
npx cap copy
```

This copies your HTML, CSS, and JavaScript to the Android app.

### Step 5: Sync with Android

```bash
npx cap sync android
```

This updates the Android project with any changes.

### Step 6: Open in Android Studio

```bash
npx cap open android
```

This opens Android Studio with your project ready to build.

---

## Building the APK

### Option A: Using Android Studio (Easiest for first-time)

1. Open Android Studio (from `npx cap open android`)
2. Click: **Build** → **Build Bundle(s)/APK(s)** → **Build APK(s)**
3. Wait for build to complete (about 2-5 minutes)
4. You'll see: "Build Completed Successfully"
5. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option B: Using Terminal

```bash
cd android
./gradlew build
```

APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Testing on Android Device

### Option 1: Physical Device (Easiest)

1. Enable USB Debugging on your phone:
   - Settings → About Phone → tap Build Number 7 times
   - Back to Settings → Developer Options → Enable USB Debugging
   
2. Connect phone via USB cable

3. In Android Studio:
   - Click the Device dropdown (top right)
   - Select your phone
   - Click the Run button (green play icon)

4. App will install and launch on your phone

### Option 2: Android Emulator

1. In Android Studio:
   - Click: **Device Manager** (left sidebar)
   - Click: **Create Device**
   - Select a phone model
   - Choose Android API 24 or higher
   - Click: **Create**

2. Start the emulator
3. Click Run in Android Studio
4. App launches in emulator

---

## Publishing to Google Play Store

Once testing is done on device, you can:

1. **Generate Release APK** (production build):
   ```bash
   cd android
   ./gradlew build -Dorg.gradle.project.android.useAndroidX=true --release
   ```

2. **Create Google Play Account** (one-time $25 fee)
   - https://play.google.com/console

3. **Upload APK** to Google Play Console
4. **Set pricing and permissions**
5. **Submit for review** (usually 24-48 hours)

---

## Commands Reference

```bash
# Initial setup
npm install @capacitor/core @capacitor/cli
npx cap init KounterPro com.kounterpro.app
npm install @capacitor/android
npx cap add android

# Development workflow
npm run build              # Build your web app (if using build tools)
npx cap copy              # Copy web files to native project
npx cap sync android      # Sync everything
npx cap open android      # Open in Android Studio

# Testing
npx cap run android       # Build and run on device/emulator

# Updating
npx cap update            # Update Capacitor plugins
```

---

## Useful Plugins for KounterPro

Your barcode scanner and camera features are already using:
- Camera via `html5-qrcode` ✅
- Notifications (optional): `@capacitor/local-notifications`

To add more native features later:

```bash
npm install @capacitor/camera
npm install @capacitor/local-notifications
npm install @capacitor/filesystem
npx cap sync android
```

---

## Troubleshooting

### "Command not found: npx"
- Install Node.js from: https://nodejs.org/

### Android Studio won't open
- Check Java version: `java -version` (needs JDK 11+)
- Download from: https://www.oracle.com/java/technologies/downloads/

### Build fails with gradle error
- Delete `android/.gradle` folder
- Run: `npx cap sync android` again
- Open Android Studio and try building again

### Camera/Barcode scanner not working on Android
- Check AndroidManifest.xml permissions in `android/app/src/main/AndroidManifest.xml`
- Ensure camera permission is requested at runtime
- Test on real device (emulators sometimes have camera issues)

---

## Next Steps

1. Run the setup commands above
2. Test on your Android phone via USB
3. Share the APK with team/customers for testing
4. Once stable, publish to Play Store

**Need help?** Run: `npx cap doctor` to diagnose issues

