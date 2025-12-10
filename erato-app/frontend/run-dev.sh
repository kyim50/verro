#!/bin/bash

# Run app in development mode with full error logging
# Usage: ./run-dev.sh

set -e

cd "$(dirname "$0")"

echo "🚀 Starting Development Server with Debug Logging"
echo "=================================================="
echo ""

# Check if Expo CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Make sure Node.js is installed"
    exit 1
fi

# Start Metro bundler with clear cache
echo "📦 Starting Metro bundler (clearing cache)..."
echo ""

# Start in one terminal, logcat in another
echo "Starting app in development mode..."
echo "This will:"
echo "  1. Clear Metro cache"
echo "  2. Start development server"
echo "  3. Open on connected device/emulator"
echo ""

# Start Metro with clear cache
npx expo start --dev-client --clear
