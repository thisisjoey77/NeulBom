#!/bin/bash

# Complete Windows build script with all checks
echo "=== Starting Complete Windows Build ==="

# Clean everything first
echo "Cleaning previous builds..."
rm -rf dist/
rm -rf build/
mkdir -p build/

# Note: We're building on macOS, so we'll use the existing backend approach
# The cross-compilation issue will be handled by including the source files

# Check if Node.js and npm are available
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed or not in PATH"
    exit 1
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Copy the Python source files to build directory for Windows build
echo "Preparing Python backend source files..."
cp jump_server.py build/
cp yolov8n-pose.pt build/
cp requirements.txt build/

# Build Electron app for Windows (this will include the Python source)
echo "Building Electron app for Windows..."
npm run build:win

# Verify build output
if [ ! -d "dist" ]; then
    echo "ERROR: Electron build failed! No dist/ folder found"
    exit 1
fi

echo "✓ Checking build output:"
ls -la dist/

# Find the installer
INSTALLER=$(find dist -name "*.exe" -type f | head -1)
if [ -z "$INSTALLER" ]; then
    echo "ERROR: No Windows installer found in dist/"
    exit 1
fi

echo "✓ Windows installer created: $INSTALLER"
echo "Size: $(du -h "$INSTALLER" | cut -f1)"

echo ""
echo "=== BUILD COMPLETE ==="
echo "Installer location: $INSTALLER"
echo ""
echo "IMPORTANT NOTES:"
echo "- The installer includes Python source files that will be compiled on the target Windows machine"
echo "- Python 3.8+ and required packages must be installed on the target Windows machine"
echo "- The installer will automatically handle process management and permissions"
echo ""
echo "INSTALLATION NOTES:"
echo "1. The installer will automatically handle process management (fixed first-time install issue)"
echo "2. Admin rights are required for first-time installation"
echo "3. Camera/microphone permissions are set automatically"
echo ""
echo "TROUBLESHOOTING:"
echo "- If 'Backend not found': Install Python 3.8+ and run 'pip install -r requirements.txt'"
echo "- If permission issues: Run as administrator once"
echo "- If camera/mic not working: Check Windows Privacy Settings"
echo ""
echo "Ready to distribute: $INSTALLER"
