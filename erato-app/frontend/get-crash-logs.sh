#!/bin/bash

# Get crash logs from Android device
# Usage: ./get-crash-logs.sh

set -e

cd "$(dirname "$0")"

echo "📱 Getting Crash Logs from Android Device"
echo "=========================================="
echo ""

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device connected"
    echo ""
    echo "Please:"
    echo "  1. Connect your phone via USB"
    echo "  2. Enable USB debugging"
    echo "  3. Run this script again"
    exit 1
fi

echo "✅ Device connected"
echo ""

# Create logs directory
LOGS_DIR="./crash-logs"
mkdir -p "$LOGS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "📝 Collecting logs..."
echo ""

# Get all logs
echo "1. Full logcat..."
adb logcat -d > "$LOGS_DIR/full_log_$TIMESTAMP.txt"

# Get crash logs
echo "2. Crash logs (FATAL, AndroidRuntime)..."
adb logcat -d | grep -E "FATAL|AndroidRuntime|Exception" > "$LOGS_DIR/crashes_$TIMESTAMP.txt"

# Get React Native logs
echo "3. React Native logs..."
adb logcat -d | grep -E "ReactNative|Expo" > "$LOGS_DIR/react_native_$TIMESTAMP.txt"

# Get recent errors
echo "4. Recent errors..."
adb logcat -d -t 500 | grep -i error > "$LOGS_DIR/errors_$TIMESTAMP.txt"

# Get app-specific logs
echo "5. App-specific logs..."
adb logcat -d | grep -E "erato|Erato|ERATO" > "$LOGS_DIR/app_$TIMESTAMP.txt"

# Get system info
echo "6. Device info..."
{
    echo "=== Device Information ==="
    adb shell getprop ro.product.model
    adb shell getprop ro.build.version.release
    adb shell getprop ro.build.version.sdk
    echo ""
    echo "=== Installed Packages ==="
    adb shell pm list packages | grep -i erato
} > "$LOGS_DIR/device_info_$TIMESTAMP.txt"

echo ""
echo "✅ Logs saved to: $LOGS_DIR/"
echo ""
echo "📋 Files created:"
ls -lh "$LOGS_DIR"/*"$TIMESTAMP"* | awk '{print "   " $9 " (" $5 ")"}'
echo ""

# Show recent crashes
echo "🔍 Recent crashes:"
if [ -s "$LOGS_DIR/crashes_$TIMESTAMP.txt" ]; then
    head -20 "$LOGS_DIR/crashes_$TIMESTAMP.txt"
else
    echo "   No crash logs found"
fi

echo ""
echo "💡 Tip: Check 'crashes_$TIMESTAMP.txt' for crash details"
