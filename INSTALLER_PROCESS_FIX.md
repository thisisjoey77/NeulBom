# Installer Process Closing Fix

## Problem
The installer would show the error: "Neulbom cannot be closed. Please close it manually and click Retry to continue."

## Root Cause
The original NSIS installer script was missing logic to automatically close running processes before installation.

## Solution Implemented
Updated the NSIS installer script (`scripts/installer.nsh`) to include automatic process closing in the `customInit` macro:

### Process Closing Logic:
1. **Check for running Neulbom.exe**: Uses `tasklist` to detect if the app is running
2. **Graceful shutdown**: First tries `taskkill /IM "Neulbom.exe" /T` to close nicely
3. **Force close**: If graceful fails, uses `taskkill /F /IM "Neulbom.exe" /T` to force close
4. **Manual fallback**: Only shows the manual close dialog if all automatic methods fail
5. **Backend cleanup**: Also closes any `jump_server.exe` processes
6. **Wait period**: Includes 2-second wait for processes to fully terminate

### Key Features:
- **Automatic**: No user intervention needed in most cases
- **Progressive**: Tries gentle methods first, then more forceful
- **Comprehensive**: Handles both frontend and backend processes
- **Fallback**: Still has manual option if automatic fails
- **Feedback**: Shows detailed progress messages to user

## Files Updated:
- `scripts/installer.nsh` - Added process closing logic
- Generated new installer files with the fix

## Testing:
1. Run the old app
2. Install the new version
3. Installer should automatically close the running app
4. No manual intervention should be needed

## Build Command:
```bash
npm run build:win
```

This fix ensures a smooth installation experience for users upgrading or reinstalling the application.
