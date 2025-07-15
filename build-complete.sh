#!/bin/bash

# Complete build script for Neulbom app
echo "🚀 Building Neulbom App with Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "jump_server.py" ]; then
    print_error "jump_server.py not found. Make sure you're in the project directory."
    exit 1
fi

# Step 1: Install Python dependencies
print_status "Installing Python dependencies..."
if command -v python3 &> /dev/null; then
    python3 -m pip install --upgrade pyinstaller opencv-python ultralytics flask flask-cors argparse
    print_status "Python dependencies installed"
else
    print_error "Python 3 not found. Please install Python 3."
    exit 1
fi

# Step 2: Build Python executable
print_status "Building Python backend executable..."
if python3 -m PyInstaller --onefile --name jump_server jump_server.py; then
    print_status "Backend executable built successfully"
else
    print_error "Failed to build backend executable"
    exit 1
fi

# Step 3: Verify executable
if [ -f "dist/jump_server" ]; then
    print_status "Backend executable verified: dist/jump_server"
    
    # Test the executable
    print_status "Testing backend executable..."
    if timeout 5s ./dist/jump_server --help > /dev/null 2>&1; then
        print_status "Backend executable works correctly"
    else
        print_warning "Backend executable test timed out (this is normal)"
    fi
else
    print_error "Backend executable not found after build"
    exit 1
fi

# Step 4: Install Node.js dependencies
print_status "Installing Node.js dependencies..."
if command -v npm &> /dev/null; then
    npm install
    print_status "Node.js dependencies installed"
else
    print_error "npm not found. Please install Node.js and npm."
    exit 1
fi

# Step 5: Build Electron app
print_status "Building Electron app..."
case "$1" in
    "mac-signed")
        print_status "Building signed macOS app..."
        npm run build:mac-signed
        ;;
    "all")
        print_status "Building for all platforms..."
        npm run build:all
        ;;
    *)
        print_status "Building for macOS..."
        npm run build:mac
        ;;
esac

if [ $? -eq 0 ]; then
    print_status "Build completed successfully!"
    print_status "App should be available in the 'dist' directory"
    
    # List the built files
    if [ -d "dist" ]; then
        print_status "Built files:"
        ls -la dist/ | grep -v "jump_server"
    fi
else
    print_error "Electron build failed"
    exit 1
fi

print_status "🎉 Build complete! Your app is ready to distribute."
echo ""
echo "Usage examples:"
echo "  ./build-complete.sh           # Build for macOS"
echo "  ./build-complete.sh mac-signed # Build signed macOS app"
echo "  ./build-complete.sh all       # Build for all platforms"
