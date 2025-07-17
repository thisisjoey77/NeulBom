#!/bin/bash

# Build script for Windows with proper permissions

echo "Building Windows version with camera and microphone permissions..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist/
rm -rf build/jump_server/
rm -rf build/jump_server.exe

# Build the Python server first
echo "Building Python server..."
python3 -m PyInstaller --onefile --name jump_server --distpath ./build/ jump_server.py

# Verify backend build
if [ ! -f "build/jump_server.exe" ]; then
    echo "ERROR: Backend build failed! jump_server.exe not found in build/"
    exit 1
fi

echo "Backend build successful: build/jump_server.exe"
ls -la build/jump_server.exe

# Build Windows version
echo "Building Windows Electron app..."
npx electron-builder --win

# Verify dist folder exists
if [ ! -d "dist" ]; then
    echo "ERROR: Electron build failed! dist/ folder not found"
    exit 1
fi

echo "Windows build complete!"
echo ""
echo "IMPORTANT: For Windows users who can't access camera/microphone:"
echo "1. Right-click the app and select 'Run as administrator' (first time only)"
echo "2. In Windows Settings > Privacy & Security > Camera/Microphone"
echo "3. Allow desktop apps to access camera and microphone"
echo "4. Add the app to the allowed list if needed"
echo ""
echo "The app will now work with camera and microphone on Windows!"
