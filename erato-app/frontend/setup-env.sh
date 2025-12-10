#!/bin/bash

# Setup EAS Environment Variables
# This script helps you set up all required environment variables for EAS builds

set -e

cd "$(dirname "$0")"

echo "🔧 EAS Environment Variables Setup"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Install it with: npm install -g eas-cli"
    exit 1
fi

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo "❌ Not logged in to EAS. Please run: eas login"
    exit 1
fi

echo "✅ EAS CLI found and logged in"
echo ""

# Function to check if secret exists
secret_exists() {
    eas secret:list --json 2>/dev/null | grep -q "\"$1\"" || return 1
}

# Function to create or update secret
create_secret() {
    local name=$1
    local value=$2
    local description=$3
    
    if secret_exists "$name"; then
        echo "⚠️  Secret '$name' already exists. Updating..."
        eas secret:delete --name "$name" --non-interactive 2>/dev/null || true
    fi
    
    echo "$value" | eas secret:create --scope project --name "$name" --value-file - --type string --non-interactive
    echo "✅ Set $description"
}

# API URLs (public, safe to store)
echo "📡 Setting up API URLs..."
create_secret "EXPO_PUBLIC_API_URL" "https://api.verrocio.com/api" "API URL"
create_secret "EXPO_PUBLIC_SOCKET_URL" "https://api.verrocio.com" "Socket URL"
echo ""

# Supabase credentials - try to read from backend .env first
echo "🗄️  Setting up Supabase credentials..."
echo ""

# Try to read from backend .env file
BACKEND_ENV="../backend/.env"
SUPABASE_URL=""
SUPABASE_KEY=""

if [ -f "$BACKEND_ENV" ]; then
    echo "📂 Found backend .env file, reading Supabase credentials..."
    SUPABASE_URL=$(grep "^SUPABASE_URL=" "$BACKEND_ENV" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)
    SUPABASE_KEY=$(grep "^SUPABASE_ANON_KEY=" "$BACKEND_ENV" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)
    
    if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
        echo "✅ Found Supabase credentials in backend .env"
        echo "   URL: ${SUPABASE_URL:0:30}..."
        echo "   Key: ${SUPABASE_KEY:0:20}..."
        echo ""
    else
        echo "⚠️  Supabase credentials not found in backend .env"
        SUPABASE_URL=""
        SUPABASE_KEY=""
    fi
else
    echo "ℹ️  Backend .env file not found at $BACKEND_ENV"
    echo "   (This is okay if you're setting up for the first time)"
    echo ""
fi

# If not found in backend .env, prompt user
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "You need to provide your Supabase credentials."
    echo "Get them from: https://app.supabase.com → Your Project → Settings → API"
    echo ""
    
    if [ -z "$SUPABASE_URL" ]; then
        read -p "Enter your Supabase Project URL (e.g., https://xxxxx.supabase.co): " SUPABASE_URL
    fi
    
    if [ -z "$SUPABASE_KEY" ]; then
        read -p "Enter your Supabase Anon Key (starts with eyJ...): " SUPABASE_KEY
    fi
fi

# Set the secrets
if [ -n "$SUPABASE_URL" ]; then
    create_secret "EXPO_PUBLIC_SUPABASE_URL" "$SUPABASE_URL" "Supabase URL"
else
    echo "⚠️  Skipping Supabase URL (you can add it later with: eas secret:create --name EXPO_PUBLIC_SUPABASE_URL)"
fi

if [ -n "$SUPABASE_KEY" ]; then
    create_secret "EXPO_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_KEY" "Supabase Anon Key"
else
    echo "⚠️  Skipping Supabase Key (you can add it later with: eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY)"
fi

echo ""
echo "✅ Environment variables setup complete!"
echo ""
echo "📋 Current secrets:"
eas secret:list
echo ""
echo "🚀 You can now build with: ./build.sh"
