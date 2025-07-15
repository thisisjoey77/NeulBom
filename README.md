# Neulbom - Educational Games App

An Electron-based educational app with various games for children including story time, image guessing, and interactive voice games.

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **Python 3.x** (for the backend server)
3. **Apple Developer Account** (for macOS distribution)
4. **Developer ID Certificate** installed in Keychain (for macOS code signing)

## Python Dependencies

The app requires several Python packages for the motion detection backend:

### Quick Installation
- **Windows**: Run `install_dependencies.bat`
- **macOS/Linux**: Run `install_dependencies.sh`

### Manual Installation
```bash
pip install -r requirements.txt
```

Required packages:
- flask
- flask-cors
- opencv-python
- numpy
- ultralytics
- PyInstaller

## Setup for Distribution

### 1. Install Dependencies
```bash
npm install
```

### 2. Install Python Dependencies
```bash
# Windows
install_dependencies.bat

# macOS/Linux
./install_dependencies.sh
```

## Build Process

The build process now automatically handles Python backend compilation and packaging across platforms.

### Quick Build Commands
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac      # macOS
npm run build:win      # Windows  
npm run build:linux    # Linux

# Build for all platforms
npm run build:all
```

### Build Process Details

1. **Automatic Python Backend Build**: The build process automatically:
   - Detects the correct Python executable
   - Installs all required packages (handling Homebrew Python restrictions)
   - Builds a standalone executable with PyInstaller
   - Copies the executable to the correct location in the app bundle

2. **Cross-Platform Support**: 
   - **macOS**: Creates `.dmg` installer for Intel and Apple Silicon
   - **Windows**: Creates NSIS installer and portable executable
   - **Linux**: Creates AppImage and .deb packages

3. **Code Signing**: Automatically signs macOS builds with Developer ID certificate

### Manual Python Backend Build

If you need to build the Python backend separately:

```bash
# Windows
build_python_exe.bat

# macOS/Linux  
python3 build_python_exe.py
```

### Build Environment Setup

#### macOS
- Install Xcode Command Line Tools
- Install Python via Homebrew (recommended): `brew install python`
- Install certificates in Keychain Access

#### Windows
- Install Python from https://python.org/downloads/
- Ensure "Add Python to PATH" is checked during installation
- Install Visual Studio Build Tools (if needed for some packages)

#### Linux
- Install Python 3 and pip: `sudo apt-get install python3 python3-pip`
- Install system dependencies for OpenCV if needed

### Troubleshooting

#### Python Package Installation Issues
- **Homebrew Python (macOS)**: The build process automatically handles `--break-system-packages` flag
- **Permission Issues**: Scripts will try `--user` installation as fallback
- **Missing Dependencies**: Check that all system requirements for OpenCV are met

#### Build Failures
- Ensure Python executable is in PATH
- Check that all required packages are installed
- Verify the `yolov8n-pose.pt` model file exists
- Check available disk space for build artifacts

#### Port Conflicts
- The backend runs on port 5001 by default
- Kill any existing processes on this port: `lsof -ti:5001 | xargs kill`

#### macOS Signing and Notarization Issues

**Error: "APPLE_APP_SPECIFIC_PASSWORD env var needs to be set"**

This error occurs during the macOS build process. You have several options:

1. **Skip notarization (Development):**
   - The app builds successfully but shows a warning on first launch
   - Users can bypass by right-clicking and selecting "Open"
   - No additional setup required

2. **Enable notarization (Production):**
   - Set up Apple credentials as described above
   - Required for distribution outside the Mac App Store
   - Eliminates security warnings for end users

3. **Disable signing entirely (Not recommended):**
   - Remove the `identity` line from `package.json`
   - May cause issues with modern macOS versions

**The build process will complete successfully regardless of notarization status.** The error is just a notification that notarization was skipped.

### Environment Variables

For signed and notarized macOS builds, set these environment variables:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="your-team-id"
```

**To generate an app-specific password:**
1. Go to https://appleid.apple.com/
2. Sign in with your Apple ID
3. Go to Security > App-Specific Passwords
4. Generate a new password for your app

**Quick setup:** Run `./setup_notarization.sh` to interactively set up credentials.

### Build Options

#### Development/Testing Builds
For development builds, you can skip notarization:
- Apps will be code-signed but not notarized
- Users may see "App can't be opened" warning on first launch
- Users can override by right-clicking and selecting "Open"

#### Production Builds
For production/distribution:
```bash
# Set credentials first
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# Build with notarization
npm run build:mac
```

Or run with inline credentials:
```bash
APPLE_ID="your-id" APPLE_APP_SPECIFIC_PASSWORD="your-password" APPLE_TEAM_ID="your-team" npm run build:mac
```

## Folder Structure

The project is organized into the following directories:

```
├── .gitignore              # Git ignore file (includes Mac-specific files)
├── index.html              # Main application entry point
├── main.js                 # Electron main process
├── package.json            # Node.js dependencies and scripts
├── jump_server.py          # Python Flask backend for motion detection
├── requirements.txt        # Python dependencies
├── games/                  # Game-related HTML and JS files
│   ├── 369.html/js         # 369 number game
│   ├── br31.html/js        # BR31 game
│   ├── commandAI.html/js   # AI command interface
│   ├── firstSoundGame.html/js # Korean initial sound game
│   ├── flagGame.html/js    # Flag guessing game
│   ├── fruitList.html/js   # Fruit listing game
│   ├── gomoku.html/js      # Gomoku (Five in a Row) game
│   ├── guessPerson.html/js # Person guessing game
│   ├── imageGuess.html/js  # Image guessing game
│   ├── lastWord.html/js    # Word chain game
│   ├── storyTime.html/js   # Story time interactive
│   ├── telephoneGame.html/js # Telephone game
│   └── twentyQ.html/js     # 20 Questions game
├── styles/                 # CSS stylesheets
│   ├── style.css           # Main application styles
│   └── 369.css             # 369 game specific styles
├── images/                 # Game images (animals, etc.)
├── scripts/                # Build and setup scripts
│   ├── build_python_exe.bat/.sh
│   ├── install_dependencies.bat/.sh
│   ├── reset_permissions.sh
│   ├── manual_permission_fix.sh
│   ├── setup_notarization.sh
│   ├── test_setup.sh
│   └── notarize.js
├── certificates/           # Code signing certificates (ignored by git)
├── build/                  # Build artifacts (ignored by git)
├── dist/                   # Distribution files (ignored by git)
└── node_modules/           # Node.js dependencies (ignored by git)
```

### Important Notes:
- **certificates/**: Contains sensitive code signing certificates and is excluded from git
- **Mac-specific files**: `.DS_Store`, `._*` files are automatically ignored
- **Environment files**: `.env` is ignored but `.env.example` is tracked
- **Build artifacts**: `build/`, `dist/`, `node_modules/` are ignored
- **Large files**: Media files and ML models are ignored for repository size

## Development

### Running in Development
```bash
# Start the Electron app
npm start

# The Python backend will be started automatically
```

### Development Notes
- The app automatically starts the Python backend on port 5001
- Backend logs are displayed in the Electron console
- Hot reload is available for frontend changes
- Backend changes require restart

The build system now automatically handles Python executable creation for each platform:

### Cross-Platform Building

**Building on macOS:**
- ✅ **macOS builds**: Python executable is built automatically
- ⚠️ **Windows builds**: Creates app structure but requires pre-built Windows executable
- ✅ **Linux builds**: Python executable is built automatically

**Building on Windows:**
- ✅ **Windows builds**: Python executable is built automatically  
- ⚠️ **macOS builds**: Creates app structure but requires pre-built macOS executable
- ✅ **Linux builds**: Python executable is built automatically

**Building on Linux:**
- ✅ **Linux builds**: Python executable is built automatically
- ⚠️ **Windows builds**: Creates app structure but requires pre-built Windows executable
- ⚠️ **macOS builds**: Creates app structure but requires pre-built macOS executable

### Pre-building Python Executables

For cross-platform distribution, build the Python executable on each target platform:

**Windows:**
```cmd
build_python_exe.bat
```

**macOS/Linux:**
```bash
python3 build_python_exe.py
```

This creates the executable in the `dist/` folder, which will be automatically included in the Electron app.

### Build Commands

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac
npm run build:win
npm run build:linux

# Build for all platforms
npm run build:all
```

```bash
cp .env.example .env
```

Required variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `APPLE_ID`: Your Apple ID (thisisjae2025@gmail.com)
- `APPLE_PASSWORD`: App-specific password for your Apple ID
- `APPLE_TEAM_ID`: Your team ID (MZ4A8222G6)
- `APPLE_CERTIFICATE`: Path to your Developer ID .p12 certificate file
- `APPLE_CERTIFICATE_PASSWORD`: Password for your certificate

### 3. Apple App-Specific Password

Create an app-specific password for notarization:
1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. Go to "Sign-In and Security" > "App-Specific Passwords"
4. Generate a new password for "Electron Builder"
5. Use this password as `APPLE_PASSWORD`

### 4. Developer ID Certificate

You need a "Developer ID Application" certificate:
1. Go to https://developer.apple.com/account/resources/certificates
2. Create a new certificate of type "Developer ID Application"
3. Download and install it in your Keychain
4. Export as .p12 file and use the path in `APPLE_CERTIFICATE`

## Building

### Development Build
```bash
npm start
```

### Production Builds

#### macOS (unsigned - for testing)
```bash
npm run build:mac
```

#### macOS (signed and notarized - for distribution)
```bash
npm run build:mac-signed
```

#### Windows (for any Windows computer)
```bash
npm run build:win
```

#### All platforms
```bash
npm run build:release
```

## Distribution

### macOS
- The signed and notarized DMG file can be distributed to any macOS user
- Users can install by dragging the app to Applications folder
- Gatekeeper will allow the app to run without warnings

### Windows
- The NSIS installer (`.exe`) can run on any Windows computer
- The portable version requires no installation
- Both x64 and 32-bit versions are created for maximum compatibility

## Troubleshooting

### macOS Code Signing Issues
1. Verify your certificate is installed: `security find-identity -v -p codesigning`
2. Check if notarization credentials are correct
3. Ensure your Apple ID has the necessary agreements signed

### Windows Compatibility Issues
1. The app creates both x64 and 32-bit versions for compatibility
2. The installer allows users to choose installation directory
3. Portable version can run without installation

## Game Features

- **Story Time**: Interactive storytelling with AI
- **Image Guess**: Animal identification game with voice input
- **369 Game**: Number pattern game with motion detection
- **Twenty Questions**: AI-powered guessing game
- **Sound Games**: Various audio-based educational activities

All games support voice input via push-to-talk (M key) and include Korean language support.

## Maintenance and Organization

This project has been recently reorganized for better maintainability:

### Cleaned Up:
- ✅ Removed all Mac-specific files (`.DS_Store`, `._*` files)
- ✅ Organized games into `/games` folder
- ✅ Moved stylesheets to `/styles` folder
- ✅ Secured certificates in `/certificates` folder (git-ignored)
- ✅ Organized scripts in `/scripts` folder
- ✅ Added comprehensive `.gitignore` for macOS, Node.js, Python, and Electron
- ✅ Updated all path references in HTML files

### Git Ignore includes:
- macOS system files (`.DS_Store`, `._*`, etc.)
- Build artifacts (`build/`, `dist/`, `node_modules/`)
- Environment variables (`.env`)
- Certificates and private keys
- Large media and model files
- Python cache and build files
