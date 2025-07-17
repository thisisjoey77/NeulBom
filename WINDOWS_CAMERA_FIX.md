# Windows Camera and Microphone Access Fix

## Problem
The Electron app cannot access camera and microphone on Windows due to permission restrictions.

## Solutions

### Solution 1: Run as Administrator (First Time)
1. Right-click the app executable
2. Select "Run as administrator"
3. Allow Windows to grant permissions
4. After first run, app should work normally

### Solution 2: Windows Privacy Settings
1. Open Windows Settings (Windows key + I)
2. Go to Privacy & Security
3. Click on "Camera" in the left sidebar
4. Turn ON "Allow desktop apps to access your camera"
5. Click on "Microphone" in the left sidebar
6. Turn ON "Allow desktop apps to access your microphone"

### Solution 3: Windows Defender / Antivirus
1. Add the app to Windows Defender exceptions
2. Add the app folder to antivirus exceptions
3. Temporarily disable real-time protection during first run

### Solution 4: Command Line Launch
Run the app from Command Prompt with media flags:
```
NeulBom.exe --enable-media-stream --enable-usermedia-screen-capturing
```

### Solution 5: Browser-based Fallback
If the desktop app doesn't work:
1. Start the Python server: `python jump_server.py`
2. Open Chrome/Edge browser
3. Go to `http://localhost:5001`
4. Allow camera/microphone when prompted

## Technical Details

The app now includes:
- Automatic permission handlers for camera/microphone
- Windows-specific command line flags
- Session permission management
- Fallback browser mode

## Build Instructions

To build Windows version with proper permissions:
```bash
./build-windows.sh
```

This creates both NSIS installer and portable versions with proper Windows permissions.
