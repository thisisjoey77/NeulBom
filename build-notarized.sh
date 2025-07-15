#!/bin/bash

echo "🚀 Starting Neulbom App Build with Code Signing and Notarization"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please create it with your Apple Developer credentials."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check required environment variables
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "❌ Error: Missing required environment variables:"
    echo "   APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID"
    echo "   Please check your .env file"
    exit 1
fi

if [ -z "$APPLE_CERTIFICATE" ] || [ -z "$APPLE_CERTIFICATE_PASSWORD" ]; then
    echo "❌ Error: Missing certificate information:"
    echo "   APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD"
    echo "   Please check your .env file"
    exit 1
fi

# Check if certificate file exists
if [ ! -f "$APPLE_CERTIFICATE" ]; then
    echo "❌ Error: Certificate file not found at: $APPLE_CERTIFICATE"
    exit 1
fi

# Get absolute path for certificate
CERT_PATH=$(realpath "$APPLE_CERTIFICATE")

echo "✅ Environment variables loaded successfully"
echo "🍎 Apple ID: $APPLE_ID"
echo "🏢 Team ID: $APPLE_TEAM_ID"
echo "📜 Certificate: $CERT_PATH"

# Import certificate to keychain (if not already imported)
echo "🔐 Importing certificate to keychain..."
security import "$CERT_PATH" -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k ~/Library/Keychains/login.keychain-db 2>/dev/null || echo "   (Certificate may already be imported)"

# Find the certificate identity
echo "🔍 Finding certificate identity..."
IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | cut -d '"' -f 2)
if [ -z "$IDENTITY" ]; then
    echo "❌ Error: Could not find Developer ID Application certificate in keychain"
    echo "   Make sure your certificate is properly imported"
    exit 1
fi
echo "✅ Found certificate identity: $IDENTITY"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf build/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build Python executable
echo "🐍 Building Python executable..."
npm run prebuild

# Build and sign the app
echo "🔨 Building and signing the app..."
CSC_IDENTITY="$IDENTITY" \
CSC_LINK="$CERT_PATH" \
CSC_KEY_PASSWORD="$APPLE_CERTIFICATE_PASSWORD" \
APPLE_ID="$APPLE_ID" \
APPLE_PASSWORD="$APPLE_PASSWORD" \
APPLE_TEAM_ID="$APPLE_TEAM_ID" \
npx electron-builder --mac

echo "✅ Build completed!"
echo "📁 Check the dist/ folder for your signed and notarized app"
