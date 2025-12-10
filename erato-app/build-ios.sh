#!/bin/bash

# Build iOS IPA for testing
# Usage: ./build-ios.sh [--local] [--testflight]

set -e

cd "$(dirname "$0")/frontend"

LOCAL=false
TESTFLIGHT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      LOCAL=true
      shift
      ;;
    --testflight)
      TESTFLIGHT=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --local       Build locally (requires Xcode)"
      echo "  --testflight  Submit to TestFlight after build"
      echo "  -h, --help    Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🚀 Building iOS IPA for testing..."
echo ""

if [ "$LOCAL" = true ]; then
  echo "📦 Building locally (requires Xcode)..."
  eas build --platform ios --profile preview --local
else
  echo "☁️  Building on EAS servers..."
  eas build --platform ios --profile preview
fi

echo ""
echo "✅ Build complete!"
echo ""

if [ "$TESTFLIGHT" = true ]; then
  echo "✈️  Submitting to TestFlight..."
  eas submit --platform ios
  echo ""
  echo "✅ Submitted to TestFlight!"
  echo "📧 Testers will receive an email invitation"
else
  echo "📱 Next steps:"
  echo "1. Check the build URL above"
  echo "2. For TestFlight: Run 'eas submit --platform ios'"
  echo "3. Add testers in App Store Connect > TestFlight"
fi

echo ""
