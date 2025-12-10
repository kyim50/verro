#!/bin/bash

# Master build script - Sets up environment and builds in one go
# Usage: ./build-all.sh [android|ios] [preview|production]

set -e

cd "$(dirname "$0")"

PLATFORM=${1:-android}
PROFILE=${2:-preview}

echo "🚀 Erato App - Complete Build Setup"
echo "===================================="
echo ""

# Step 1: Setup environment variables
echo "📋 Step 1: Setting up environment variables..."
echo ""

# Check if secrets already exist
if eas secret:list --json 2>/dev/null | grep -q "EXPO_PUBLIC_API_URL"; then
    echo "✅ Environment variables already configured"
    echo ""
else
    echo "⚠️  Environment variables not set up."
    echo "Running setup script..."
    echo ""
    ./setup-env.sh
    echo ""
fi

# Step 2: Build
echo "🔨 Step 2: Building app..."
echo ""
./build.sh --platform "$PLATFORM" --profile "$PROFILE"

echo ""
echo "✅ Complete! Your app is ready to share with testers."
echo ""
