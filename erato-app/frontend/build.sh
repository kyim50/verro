#!/bin/bash

# Build script for Erato app
# Handles environment setup and builds for Android/iOS

set -e

cd "$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
PLATFORM="android"
PROFILE="preview"
SKIP_ENV_CHECK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --platform|-p)
      PLATFORM="$2"
      shift 2
      ;;
    --profile|-pr)
      PROFILE="$2"
      shift 2
      ;;
    --ios)
      PLATFORM="ios"
      shift
      ;;
    --android)
      PLATFORM="android"
      shift
      ;;
    --preview)
      PROFILE="preview"
      shift
      ;;
    --production|--prod)
      PROFILE="production"
      shift
      ;;
    --development|--dev)
      PROFILE="development"
      shift
      ;;
    --skip-env-check)
      SKIP_ENV_CHECK=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --platform, -p <platform>  Build platform: android or ios (default: android)"
      echo "  --profile, -pr <profile>   Build profile: preview, production, or development (default: preview)"
      echo "  --ios                       Build for iOS"
      echo "  --android                   Build for Android"
      echo "  --preview                   Use preview profile"
      echo "  --production, --prod        Use production profile"
      echo "  --development, --dev        Use development profile"
      echo "  --skip-env-check            Skip environment variable check"
      echo "  -h, --help                  Show this help"
      echo ""
      echo "Examples:"
      echo "  $0                          # Build Android preview"
      echo "  $0 --ios                    # Build iOS preview"
      echo "  $0 --platform android --profile production  # Build Android production"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 Building Erato App${NC}"
echo "Platform: $PLATFORM"
echo "Profile: $PROFILE"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}❌ EAS CLI not found. Install it with: npm install -g eas-cli${NC}"
    exit 1
fi

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to EAS. Logging in...${NC}"
    eas login
fi

# Check environment variables
if [ "$SKIP_ENV_CHECK" = false ]; then
    echo "🔍 Checking environment variables..."
    
    MISSING_SECRETS=()
    
    # Check required secrets
    if ! eas secret:list --json 2>/dev/null | grep -q "EXPO_PUBLIC_API_URL"; then
        MISSING_SECRETS+=("EXPO_PUBLIC_API_URL")
    fi
    
    if ! eas secret:list --json 2>/dev/null | grep -q "EXPO_PUBLIC_SOCKET_URL"; then
        MISSING_SECRETS+=("EXPO_PUBLIC_SOCKET_URL")
    fi
    
    if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
        for secret in "${MISSING_SECRETS[@]}"; do
            echo "   - $secret"
        done
        echo ""
        echo "Run './setup-env.sh' to set them up, or use --skip-env-check to continue anyway"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Run: ./setup-env.sh"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Environment variables configured${NC}"
    fi
    echo ""
fi

# Validate platform
if [[ "$PLATFORM" != "android" && "$PLATFORM" != "ios" ]]; then
    echo -e "${RED}❌ Invalid platform: $PLATFORM. Use 'android' or 'ios'${NC}"
    exit 1
fi

# Validate profile
if [[ "$PROFILE" != "preview" && "$PROFILE" != "production" && "$PROFILE" != "development" ]]; then
    echo -e "${RED}❌ Invalid profile: $PROFILE. Use 'preview', 'production', or 'development'${NC}"
    exit 1
fi

# iOS specific checks
if [ "$PLATFORM" = "ios" ]; then
    if [ "$PROFILE" = "production" ]; then
        echo -e "${YELLOW}⚠️  iOS production builds require Apple Developer account${NC}"
        echo "Make sure you have:"
        echo "  - Apple Developer account ($99/year)"
        echo "  - App Store Connect access"
        echo ""
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Show current secrets (for verification)
echo "📋 Current environment variables:"
eas secret:list 2>/dev/null | grep "EXPO_PUBLIC" || echo "   (Using values from eas.json/app.json)"
echo ""

# Build
echo -e "${GREEN}🔨 Starting build...${NC}"
echo ""

if [ "$PLATFORM" = "ios" ] && [ "$PROFILE" = "production" ]; then
    # For iOS production, we might want to submit to TestFlight
    echo "Building iOS production..."
    eas build --platform ios --profile "$PROFILE"
    
    echo ""
    echo -e "${GREEN}✅ Build complete!${NC}"
    echo ""
    read -p "Submit to TestFlight? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Submitting to TestFlight..."
        eas submit --platform ios
    fi
else
    # Regular build
    eas build --platform "$PLATFORM" --profile "$PROFILE"
    
    echo ""
    echo -e "${GREEN}✅ Build complete!${NC}"
    echo ""
    echo "📱 Next steps:"
    echo "  1. Check the build URL above"
    echo "  2. Share the download link with testers"
    if [ "$PLATFORM" = "android" ]; then
        echo "  3. Testers need to enable 'Install from unknown sources'"
    fi
fi

echo ""
