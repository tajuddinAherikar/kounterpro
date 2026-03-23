# KounterPro Android App Build Info

## App Details for Google Play Store

```
App Name: KounterPro
Package ID: com.kounterpro.app
Version: 1.0.0
Minimum Android: API 24 (Android 7.0)
Target Android: API 34 (Android 14)
```

## App Icons & Screenshots Needed for Play Store

Before publishing, prepare:

### Icon Requirements
- **App Icon**: 512×512 px (PNG, JPG)
- **Feature Graphic**: 1024×500 px (PNG, JPG)

### Screenshots (minimum 2, maximum 8)
- Size: 1080×1920 px or 1440×2560 px
- PNG or JPG format
- Show: Dashboard, Invoice creation, Inventory management

### Descriptions
- **Short Description** (80 characters max):
  "GST Billing, Invoicing & Inventory Management for Small Businesses"

- **Full Description** (4000 characters max):
  "KounterPro is an easy-to-use billing and inventory management app for small businesses in India.
  
  Features:
  - Create professional GST invoices (with or without tax)
  - Manage inventory with barcode scanning
  - Track customer payments and credit
  - Invoice templates and customization
  - Detailed business reports
  - Dark mode support
  - Offline-capable
  
  Perfect for retail shops, service businesses, and wholesalers."

## Permissions Required

Make sure these are declared in `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- For barcode/QR scanner -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- For file storage (exports) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- For network -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Optional: For notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Capacitor Version Info

Current setup uses: **Capacitor 5.x**

Features available:
- ✅ Camera (barcode scanning)
- ✅ Local notifications
- ✅ File system access
- ✅ Geolocation
- ✅ Device info
- ✅ Status bar customization
- ✅ Splash screen

## Build Commands Cheat Sheet

```bash
# First time setup
npm install
npm install @capacitor/android
npx cap add android

# Development workflow
npx cap copy                  # Copy web files
npx cap sync android          # Sync changes
npx cap open android          # Open Android Studio

# Build APK
cd android && ./gradlew build

# Test on device
npx cap run android

# Update existing
npx cap update
npx cap sync android
```

## Troubleshooting Android Build

### Build fails with "gradle not found"
```bash
cd android
./gradlew clean build
```

### Camera permission issues
- Add to `android/app/build.gradle`:
  ```gradle
  android {
      ...
      compileSdkVersion 34
      targetSdkVersion 34
  }
  ```

### App crashes on startup
1. Check logcat: `adb logcat | grep kounterpro`
2. Ensure `capacitor.config.ts` exists
3. Run: `npx cap doctor` to diagnose

## Release Build (Production)

```bash
# Create signing key (one-time)
keytool -genkey -v -keystore kounterpro.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias kounterpro

# Build release APK
cd android
./gradlew build --release '-Pandroid.injected.signing.store.file=../kounterpro.keystore' '-Pandroid.injected.signing.store.password=YOUR_PASSWORD' '-Pandroid.injected.signing.key.alias=kounterpro' '-Pandroid.injected.signing.key.password=YOUR_PASSWORD'
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Support & Resources

- Capacitor Docs: https://capacitorjs.com/docs
- Android Studio: https://developer.android.com/studio
- Google Play Console: https://play.google.com/console
- Supabase Android: https://supabase.com/docs/reference/android

