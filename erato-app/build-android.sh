#!/bin/bash

# Build Android APK for testing
# Usage: ./build-android.sh [--local] [--firebase]

set -e

cd "$(dirname "$0")/frontend"

LOCAL=false
FIREBASE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      LOCAL=true
      shift
      ;;
    --firebase)
      FIREBASE=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --local       Build locally (faster, requires Android SDK)"
      echo "  --firebase    Upload to Firebase after build"
      echo "  -h, --help    Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🚀 Building Android APK for testing..."
echo ""

if [ "$LOCAL" = true ]; then
  echo "📦 Building locally..."
  eas build --platform android --profile preview --local
else
  echo "☁️  Building on EAS servers..."
  eas build --platform android --profile preview
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📱 Next steps:"
echo "1. Check the build URL above"
echo "2. Share the download link with your testers"
echo "3. Testers need to enable 'Install from unknown sources' on Android"
echo ""

if [ "$FIREBASE" = true ]; then
  echo "🔥 Uploading to Firebase..."
  if command -v firebase &> /dev/null; then
    # Find the latest APK
    APK_PATH=$(find . -name "*.apk" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    if [ -n "$APK_PATH" ]; then
      firebase appdistribution:distribute "$APK_PATH" \
        --app "$(grep -o '"projectId": "[^"]*"' eas.json | cut -d'"' -f4)" \
        --groups "testers" \
        --release-notes "New build - $(date +%Y-%m-%d)"
      echo "✅ Uploaded to Firebase!"
    else
      echo "❌ Could not find APK file"
    fi
  else
    echo "❌ Firebase CLI not installed. Install with: npm install -g firebase-tools"
  fi
fi
