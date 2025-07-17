#!/bin/bash

# Load environment variables from .env file
set -a
source .env
set +a

echo "Building with notarization and signing for macOS..."
echo "Using APPLE_ID: $APPLE_ID"
echo "Using APPLE_TEAM_ID: $APPLE_TEAM_ID"
echo "Using Certificate: $APPLE_CERTIFICATE"

# First build the Python server
echo "Building Python server..."
python3 -m PyInstaller --onefile --name jump_server jump_server.py

# Then build the Electron app with signing and notarization
echo "Building Electron app with signing and notarization..."
CSC_LINK="$APPLE_CERTIFICATE" \
CSC_KEY_PASSWORD="$APPLE_CERTIFICATE_PASSWORD" \
APPLE_ID="$APPLE_ID" \
APPLE_PASSWORD="$APPLE_PASSWORD" \
APPLE_TEAM_ID="$APPLE_TEAM_ID" \
npm run build:mac

echo "Build complete!"
