#!/bin/bash

# Debug Android app - Run in emulator with full logging
# Usage: ./debug-android.sh

set -e

cd "$(dirname "$0")"

echo "🐛 Android Debug Mode"
echo "===================="
echo ""

# Check if Android SDK is available
if ! command -v adb &> /dev/null; then
    echo "❌ ADB not found. Make sure Android SDK is installed and in PATH"
    echo ""
    echo "Install Android Studio and add to PATH:"
    echo "  export PATH=\$PATH:\$HOME/Library/Android/sdk/platform-tools"
    exit 1
fi

# Check for connected devices/emulators
echo "📱 Checking for Android devices/emulators..."
DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l | xargs)

if [ "$DEVICES" -eq 0 ]; then
    echo "⚠️  No Android device/emulator found"
    echo ""
    echo "Starting Android emulator..."
    
    # Try to start emulator
    if command -v emulator &> /dev/null; then
        echo "Starting default emulator..."
        emulator -avd Pixel_5_API_33 -no-snapshot-load &
        echo "Waiting for emulator to boot..."
        adb wait-for-device
        sleep 10
    else
        echo "❌ Emulator command not found"
        echo ""
        echo "Please:"
        echo "  1. Open Android Studio"
        echo "  2. Tools → Device Manager"
        echo "  3. Start an emulator"
        echo "  4. Then run this script again"
        exit 1
    fi
else
    echo "✅ Found $DEVICES device(s)"
    adb devices
fi

echo ""
echo "📋 Device Info:"
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
echo ""

# Clear previous logs
echo "🧹 Clearing previous logs..."
adb logcat -c

# Start logcat in background with filtering
echo "📝 Starting logcat (filtered for errors)..."
echo "   Press Ctrl+C to stop"
echo ""
echo "=== LOGS START ==="
echo ""

# Filter for React Native, Expo, and crash-related logs
adb logcat -v time | grep -E "ReactNative|Expo|AndroidRuntime|FATAL|Error|Exception|crash|Crash" --color=always
