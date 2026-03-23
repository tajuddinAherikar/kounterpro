#!/bin/bash

# KounterPro Android Development Cheat Sheet

echo "================================"
echo "KounterPro Android Dev Commands"
echo "================================"
echo ""

echo "📋 Prerequisites Check:"
echo "  npx cap doctor"
echo ""

echo "🔄 Sync web assets to Android:"
echo "  npx cap sync android"
echo ""

echo "📱 Open Android Studio:"
echo "  npx cap open android"
echo ""

echo "🛠️  Run development build on device:"
echo "  npx cap run android"
echo ""

echo "📦 Build APK (debug):"
echo "  cd android && ./gradlew assembleDebug"
echo ""

echo "📦 Build APK (release):"
echo "  cd android && ./gradlew assembleRelease"
echo ""

echo "🧹 Clean build (if having issues):"
echo "  cd android && ./gradlew clean && ./gradlew build"
echo ""

echo "📲 Install APK on device:"
echo "  adb install android/app/build/outputs/apk/debug/app-debug.apk"
echo ""

echo "📝 View device logs:"
echo "  adb logcat | grep -i kounterpro"
echo ""

echo "🔗 Enable USB debugging on Android phone:"
echo "  Settings > Developer options > USB Debugging (enable)"
echo ""

echo "Additional resources:"
echo "  - Setup guide: CAPACITOR_SETUP.md"
echo "  - Build info: ANDROID_BUILD_INFO.md"
echo "  - Capacitor docs: https://capacitorjs.com/docs"
