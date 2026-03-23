# KounterPro Android Quick Start

This guide gets you from zero to building your Android app in 15 minutes.

## Step 1: Automatic Setup (5 minutes)

Run the setup script that handles everything:

```bash
chmod +x setup-android.sh
./setup-android.sh
```

This will:
- ✅ Check Node.js and Java installation
- ✅ Install all npm dependencies
- ✅ Initialize Capacitor
- ✅ Add Android platform
- ✅ Sync your web files to Android

## Step 2: Manual Prerequisites (if script fails)

If the setup script fails, install these manually:

### macOS:
```bash
# Install Java JDK 11+
brew install openjdk@11

# Download Android Studio
# 1. Visit: https://developer.android.com/studio
# 2. Install the .dmg file
# 3. Open Android Studio and complete setup wizard
# 4. Install Android SDK (in Android Studio: Settings > SDK Manager)
```

### Check Java installation:
```bash
java -version
```

Should show version 11 or higher.

## Step 3: Install Android Studio

1. Download from: https://developer.android.com/studio
2. Install the DMG file
3. Open Android Studio
4. Complete initial setup wizard
5. When prompted, install Android SDK
6. Go to Settings > SDK Manager and install:
   - Android SDK Platform 31+ (for optimal compatibility)
   - Android SDK Build-Tools 33.0.0+
   - Android Emulator (optional, for testing without device)

## Step 4: Prepare Your Phone (or use Emulator)

### Using Physical Phone:
1. Enable Developer Mode:
   - Settings > About phone > Build number (tap 7 times)
   - Go back > System > Developer options > Enable USB Debugging
2. Connect phone to Mac via USB cable
3. Approve USB debugging prompt on phone

### Using Emulator (no phone needed):
1. In Android Studio: Tools > Device Manager
2. Click "Create Device"
3. Choose Pixel 4a (recommended)
4. Download system image and create
5. Click play to start emulator

## Step 5: Run Your App

### Option A: Let Android Studio handle it (Easiest)

```bash
npx cap open android
```

This opens Android Studio. Then:
1. Wait for project to load (takes 1-2 minutes first time)
2. Click green ▶️ (Run) button
3. Select your device/emulator from popup
4. App builds and launches!

### Option B: Command line (for experienced developers)

```bash
npx cap run android
```

This automatically builds and runs on connected device.

## Step 6: Test Barcode Scanner

1. Open inventory screen
2. Click "Scan Barcode" button
3. Point camera at barcode/QR code
4. Should recognize the code

**Note:** If barcodes aren't detected well, the library might need upgrade (see troubleshooting).

## Quick Commands Reference

See [ANDROID_COMMANDS.md](ANDROID_COMMANDS.md) for all available commands.

Most common:
```bash
npx cap open android          # Open in Android Studio
npx cap run android           # Build & run on device
npx cap sync android          # Sync web files after changes
npx cap doctor                # Check if everything is installed
```

## After Making Changes to Web App

Every time you modify your web code:

```bash
npx cap sync android
```

This copies your updated files to the Android project. Then rebuild in Android Studio.

## Building for App Store

See [ANDROID_BUILD_INFO.md](ANDROID_BUILD_INFO.md) for full Play Store publishing guide.

Quick version:
1. Create release build: `cd android && ./gradlew assembleRelease`
2. Sign APK with your keystore
3. Upload to Google Play Console

## Troubleshooting

### "command not found: npx"
- Node.js not installed. Download from https://nodejs.org/

### "Java not found"
- Install JDK 11+: `brew install openjdk@11`

### Android Studio won't load project
- Run: `npx cap doctor` to check everything
- If errors, run: `cd android && ./gradlew clean`

### Capacitor commands not working
- Make sure you're in the kounterpro directory
- Run: `npm install` first

### App crashes on startup
- Check logs: `adb logcat | grep -i kounterpro`
- Most common: web files not synced (run `npx cap sync android`)

### Barcode scanner not detecting barcodes
- html5-qrcode works best with QR codes
- For standard barcodes (UPC/EAN), library upgrade needed
- See CAPACITOR_SETUP.md troubleshooting section

## What's Next?

1. ✅ Run the setup script (or do manual steps)
2. ✅ Install Android Studio
3. ✅ Connect your phone (or start emulator)
4. ✅ Run `npx cap open android` and hit Run button
5. ✅ Test the app on your device
6. 📱 Share with beta testers (internal testing)
7. 🚀 Publish to Play Store (see ANDROID_BUILD_INFO.md)

## Need Help?

- Full setup guide: [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md)
- Build & publishing: [ANDROID_BUILD_INFO.md](ANDROID_BUILD_INFO.md)
- All commands: [ANDROID_COMMANDS.md](ANDROID_COMMANDS.md)
- Capacitor docs: https://capacitorjs.com/docs
- Android docs: https://developer.android.com/docs

---

**Ready?** Run `./setup-android.sh` and follow the prompts!
