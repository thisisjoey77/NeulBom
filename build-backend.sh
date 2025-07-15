#!/bin/bash

# Build backend executable for macOS
echo "Building backend executable..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install required packages
echo "Installing Python packages..."
pip install pyinstaller opencv-python ultralytics flask flask-cors argparse

# Build the executable
echo "Building executable with PyInstaller..."
pyinstaller --onefile --name jump_server jump_server.py

# Check if build was successful
if [ -f "dist/jump_server" ]; then
    echo "✓ Backend executable built successfully: dist/jump_server"
    echo "Deactivating virtual environment..."
    deactivate
    echo "Now building Electron app..."
    npm run build:mac  # Creates DMG for macOS
else
    echo "✗ Failed to build backend executable"
    deactivate
    exit 1
fi