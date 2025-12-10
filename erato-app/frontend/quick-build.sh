#!/bin/bash

# Quick build script - one command to build everything
# Usage: ./quick-build.sh [android|ios]

set -e

cd "$(dirname "$0")"

PLATFORM=${1:-android}

echo "🚀 Quick Build - Erato App"
echo "Platform: $PLATFORM"
echo ""

# Check if setup is needed
if ! eas secret:list --json 2>/dev/null | grep -q "EXPO_PUBLIC_API_URL"; then
    echo "⚠️  Environment variables not set up yet."
    echo "Running setup script..."
    echo ""
    ./setup-env.sh
    echo ""
fi

# Build
./build.sh --platform "$PLATFORM" --profile preview

echo ""
echo "✅ Done! Check the build URL above to share with testers."
