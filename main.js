const { app, BrowserWindow, systemPreferences, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Temporarily commenting out speech_server to isolate the issue
 require('./speech_server');

let backendProcess = null;

// Backend configuration
const BACKEND_PORT = process.env.BACKEND_PORT || 5001;
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';

// Add IPC handler for getting correct image paths
ipcMain.handle('get-image-path', async (event, imageName) => {
  console.log('=== IMAGE PATH REQUEST ===');
  console.log('Requested image:', imageName);
  console.log('App is packaged:', app.isPackaged);
  console.log('__dirname:', __dirname);
  console.log('Resources path:', process.resourcesPath);
  
  let imagePath;
  if (app.isPackaged) {
    // In packaged app, images are in the app resources
    imagePath = path.join(process.resourcesPath, 'app', 'games', 'images', imageName);
  } else {
    // In development, images are in the games/images directory
    imagePath = path.join(__dirname, 'games', 'images', imageName);
  }
  
  console.log('Primary image path:', imagePath);
  console.log('Path exists:', fs.existsSync(imagePath));
  
  // Check if file exists and return appropriate path
  if (fs.existsSync(imagePath)) {
    // Use file:// protocol and ensure proper URL encoding
    const fileUrl = `file://${imagePath.replace(/\\/g, '/')}`;
    console.log('✓ Returning image URL:', fileUrl);
    return fileUrl;
  } else {
    console.error('✗ Image not found at primary path:', imagePath);
    
    // List what's actually in the images directory
    const imagesDir = path.join(__dirname, 'images');
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir);
      console.log('Available images:', files);
    }
    
    // Try alternative paths as fallback
    const alternatives = [
      path.join(process.resourcesPath, 'images', imageName),
      path.join(__dirname, '..', 'images', imageName),
      path.join(app.getPath('userData'), 'images', imageName)
    ];
    
    for (const altPath of alternatives) {
      console.log('Trying alternative path:', altPath);
      if (fs.existsSync(altPath)) {
        const fileUrl = `file://${altPath.replace(/\\/g, '/')}`;
        console.log('✓ Found image at alternative path, returning:', fileUrl);
        return fileUrl;
      }
    }
    
    console.error('✗ Image not found in any location');
    return null;
  }
});

// Add IPC handlers for permission checking
ipcMain.handle('check-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    console.log('IPC: Microphone permission status:', status);
    return status;
  } else if (process.platform === 'win32') {
    // On Windows, we need to check if microphone access is available
    try {
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const checkMic = spawn('powershell', ['-Command', 'Get-WmiObject -Class Win32_SoundDevice | Select-Object -First 1'], { 
          stdio: 'pipe',
          windowsHide: true 
        });
        
        let hasOutput = false;
        checkMic.stdout.on('data', (data) => {
          if (data.toString().trim()) {
            hasOutput = true;
          }
        });
        
        checkMic.on('close', (code) => {
          console.log('IPC: Windows microphone check result:', hasOutput ? 'granted' : 'denied');
          resolve(hasOutput ? 'granted' : 'denied');
        });
        
        checkMic.on('error', () => {
          console.log('IPC: Windows microphone check error, assuming granted');
          resolve('granted');
        });
      });
    } catch (error) {
      console.error('IPC: Error checking Windows microphone:', error);
      return 'granted'; // Assume granted on error
    }
  }
  return 'granted'; // Other platforms
});

ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    try {
      console.log('IPC: Requesting microphone permission via askForMediaAccess');
      const result = await systemPreferences.askForMediaAccess('microphone');
      console.log('IPC: askForMediaAccess result:', result);
      return result;
    } catch (error) {
      console.error('IPC: Error in askForMediaAccess:', error);
      return false;
    }
  } else if (process.platform === 'win32') {
    // On Windows, we can't programmatically request permissions
    // Show instructions to the user
    console.log('IPC: Windows microphone permission request - showing instructions');
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Microphone Permission Required',
      message: 'Please allow microphone access for Neulbom',
      detail: 'Go to Windows Settings > Privacy & Security > Microphone\nTurn on "Allow desktop apps to access your microphone"',
      buttons: ['Open Settings', 'I\'ve Done This', 'Cancel'],
      defaultId: 0
    });
    
    if (result.response === 0) {
      // Open Windows Settings
      require('child_process').spawn('ms-settings:privacy-microphone', { shell: true });
    }
    
    return result.response !== 2; // Return true unless cancelled
  }
  return true; // Other platforms
});

// Add camera permission handlers alongside microphone ones
ipcMain.handle('check-camera-permission', async () => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('camera');
    console.log('IPC: Camera permission status:', status);
    return status;
  } else if (process.platform === 'win32') {
    // On Windows, we need to check if camera access is available
    try {
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const checkCam = spawn('powershell', ['-Command', 'Get-PnpDevice -FriendlyName "*camera*" | Where-Object {$_.Status -eq "OK"} | Select-Object -First 1'], { 
          stdio: 'pipe',
          windowsHide: true 
        });
        
        let hasOutput = false;
        checkCam.stdout.on('data', (data) => {
          if (data.toString().trim()) {
            hasOutput = true;
          }
        });
        
        checkCam.on('close', (code) => {
          console.log('IPC: Windows camera check result:', hasOutput ? 'granted' : 'denied');
          resolve(hasOutput ? 'granted' : 'denied');
        });
        
        checkCam.on('error', () => {
          console.log('IPC: Windows camera check error, assuming granted');
          resolve('granted');
        });
      });
    } catch (error) {
      console.error('IPC: Error checking Windows camera:', error);
      return 'granted'; // Assume granted on error
    }
  }
  return 'granted'; // Other platforms
});

ipcMain.handle('request-camera-permission', async () => {
  if (process.platform === 'darwin') {
    try {
      console.log('IPC: Requesting camera permission via askForMediaAccess');
      const result = await systemPreferences.askForMediaAccess('camera');
      console.log('IPC: askForMediaAccess camera result:', result);
      return result;
    } catch (error) {
      console.error('IPC: Error in askForMediaAccess camera:', error);
      return false;
    }
  } else if (process.platform === 'win32') {
    // On Windows, we can't programmatically request permissions
    // Show instructions to the user
    console.log('IPC: Windows camera permission request - showing instructions');
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Camera Permission Required',
      message: 'Please allow camera access for Neulbom',
      detail: 'Go to Windows Settings > Privacy & Security > Camera\nTurn on "Allow desktop apps to access your camera"',
      buttons: ['Open Settings', 'I\'ve Done This', 'Cancel'],
      defaultId: 0
    });
    
    if (result.response === 0) {
      // Open Windows Settings
      require('child_process').spawn('ms-settings:privacy-webcam', { shell: true });
    }
    
    return result.response !== 2; // Return true unless cancelled
  }
  return true; // Other platforms
});

// Simplified permission dialog that focuses on getUserMedia
ipcMain.handle('open-permission-dialog', async () => {
  return new Promise((resolve) => {
    const permissionWindow = new BrowserWindow({
      width: 500,
      height: 400,
      modal: true,
      parent: BrowserWindow.getFocusedWindow(),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: 'default'
    });
    
    permissionWindow.loadFile('permission-request.html');
    
    permissionWindow.on('closed', () => {
      resolve();
    });
  });
});

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // Handle permissions for Windows and other platforms
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission request:', permission);
    
    // Always allow camera and microphone permissions
    if (permission === 'camera' || permission === 'microphone' || permission === 'media') {
      console.log('✓ Granting permission for:', permission);
      callback(true);
    } else {
      console.log('✗ Denying permission for:', permission);
      callback(false);
    }
  });
  
  // Handle permission checks
  win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('Permission check:', permission, 'from:', requestingOrigin);
    
    // Allow camera and microphone permissions
    if (permission === 'camera' || permission === 'microphone' || permission === 'media') {
      console.log('✓ Permission check passed for:', permission);
      return true;
    }
    
    console.log('✗ Permission check failed for:', permission);
    return false;
  });
  
  // DevTools enabled for debugging
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
  
  win.loadFile('index.html');
  
  // Log permission status after window is created
  if (process.platform === 'darwin') {
    setTimeout(() => {
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      const camStatus = systemPreferences.getMediaAccessStatus('camera');
      console.log('Current microphone status:', micStatus);
      console.log('Current camera status:', camStatus);
    }, 1000);
  }
}


app.whenReady().then(() => {
  console.log('App ready - starting without permission requests...');
  console.log('App is packaged:', app.isPackaged);
  console.log('Platform:', process.platform);
  
  // Start the backend server before opening the window
  let backendPath;
  let workingDir;

  const executableName = process.platform === 'win32' ? 'jump_server.exe' : 'jump_server';

  // Look for the bundled executable in the packaged app
  const possibleExecutablePaths = app.isPackaged
    ? [
        // Primary location in packaged app resources
        path.join(process.resourcesPath, executableName),
        // Alternative locations for different packaging configurations
        path.join(process.resourcesPath, 'app', executableName),
        path.join(path.dirname(process.execPath), executableName),
        path.join(path.dirname(process.execPath), 'resources', executableName),
        path.join(process.resourcesPath, 'Resources', executableName)
      ]
    : [
        // Development paths
        path.join(__dirname, 'dist', executableName),
        path.join(__dirname, executableName)
      ];

  console.log('Searching for backend executable in:');
  for (const testPath of possibleExecutablePaths) {
    console.log(`  - ${testPath} (exists: ${fs.existsSync(testPath)})`);
    if (fs.existsSync(testPath)) {
      backendPath = testPath;
      workingDir = path.dirname(testPath);
      console.log('✓ Found backend executable:', backendPath);
      break;
    }
  }

  if (!backendPath) {
    console.error('✗ Backend executable not found!');
    console.error('  Make sure the Python backend has been compiled to an executable.');
    console.error('  Run: npm run prebuild');
    
    // For Windows, try to find Python and run the script directly
    if (process.platform === 'win32') {
      const pythonScript = app.isPackaged
        ? path.join(process.resourcesPath, 'jump_server.py')
        : path.join(__dirname, 'jump_server.py');
      
      if (fs.existsSync(pythonScript)) {
        console.log('✓ Found Python script, will try to run directly:', pythonScript);
        backendPath = pythonScript;
        workingDir = path.dirname(pythonScript);
      } else {
        console.error('✗ Python script not found either:', pythonScript);
        // Show error to user but continue loading the app
        setTimeout(() => {
          const { dialog } = require('electron');
          dialog.showErrorBox(
            'Backend Not Found', 
            'The motion detection backend could not be found. Motion-based games will not work.\n\nPlease ensure Python 3.8+ is installed and run:\npip install -r requirements.txt\n\nThen restart the application.'
          );
        }, 2000);
      }
    } else {
      // Show error to user but continue loading the app
      setTimeout(() => {
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Backend Not Found', 
          'The motion detection backend could not be found. Motion-based games will not work.\n\nTo fix this, rebuild the app or contact support.'
        );
      }, 2000);
    }
  }

  console.log('=== Backend Executable Configuration ===');
  console.log('Platform:', process.platform);
  console.log('Backend executable:', backendPath || 'NOT FOUND');
  console.log('Working directory:', workingDir || 'N/A');
  console.log('App is packaged:', app.isPackaged);
  console.log('Process resources path:', process.resourcesPath);
  console.log('========================================');

  // Only start backend if executable exists
  if (backendPath && fs.existsSync(backendPath)) {
    console.log('✓ Starting backend executable...');

    // Ensure the YOLO model file is accessible
    const modelFileName = 'yolov8n-pose.pt';
    let modelPath;
    
    if (app.isPackaged) {
      // In packaged app, model should be in resources
      modelPath = path.join(process.resourcesPath, modelFileName);
    } else {
      // In development, model is in the project root
      modelPath = path.join(__dirname, modelFileName);
    }

    console.log('Looking for YOLO model at:', modelPath);
    console.log('Model exists:', fs.existsSync(modelPath));

    try {
      // Start the backend with proper environment variables
      const env = {
        ...process.env,
        YOLO_MODEL_PATH: modelPath,
        PYTHONPATH: workingDir
      };

      // Determine if we're running a Python script or executable
      const isLaunchingPyScript = backendPath && backendPath.endsWith('.py');
      
      if (isLaunchingPyScript) {
        // Try to find Python executable
        const pythonExecutables = ['python', 'python3', 'py'];
        let pythonExec = null;
        
        for (const pyExec of pythonExecutables) {
          try {
            const { spawn } = require('child_process');
            const testProcess = spawn(pyExec, ['--version'], { stdio: 'pipe' });
            pythonExec = pyExec;
            testProcess.kill();
            break;
          } catch (error) {
            // Continue to next Python executable
          }
        }
        
        if (pythonExec) {
          console.log(`✓ Found Python executable: ${pythonExec}`);
          backendProcess = spawn(pythonExec, [backendPath, '--port', BACKEND_PORT.toString(), '--host', BACKEND_HOST], {
            cwd: workingDir,
            stdio: 'pipe',
            detached: false,
            env: env
          });
        } else {
          console.error('✗ Python executable not found!');
          setTimeout(() => {
            const { dialog } = require('electron');
            dialog.showErrorBox(
              'Python Not Found', 
              'Python is required to run the motion detection backend.\n\nPlease install Python 3.8+ and the required packages:\npip install -r requirements.txt'
            );
          }, 2000);
          return;
        }
      } else {
        // Run as executable
        backendProcess = spawn(backendPath, ['--port', BACKEND_PORT.toString(), '--host', BACKEND_HOST], {
          cwd: workingDir,
          stdio: 'pipe',
          detached: false,
          env: env
        });
      }

      backendProcess.stdout.on('data', (data) => {
        try {
          console.log('Backend stdout:', data.toString().trim());
        } catch (error) {
          // Silently ignore EPIPE errors during shutdown
          if (error.code !== 'EPIPE') {
            console.error('Error logging backend stdout:', error.message);
          }
        }
      });

      backendProcess.stderr.on('data', (data) => {
        try {
          console.log('Backend stderr:', data.toString().trim());
        } catch (error) {
          // Silently ignore EPIPE errors during shutdown
          if (error.code !== 'EPIPE') {
            console.error('Error logging backend stderr:', error.message);
          }
        }
      });

      // Handle pipe errors to prevent crashes
      backendProcess.stdout.on('error', (error) => {
        if (error.code !== 'EPIPE') {
          console.error('Backend stdout error:', error.message);
        }
      });

      backendProcess.stderr.on('error', (error) => {
        if (error.code !== 'EPIPE') {
          console.error('Backend stderr error:', error.message);
        }
      });

      backendProcess.on('error', (error) => {
        console.error('✗ Backend process error:', error);
        backendProcess = null;
      });

      backendProcess.on('exit', (code, signal) => {
        console.log(`Backend process exited with code: ${code}, signal: ${signal}`);
        backendProcess = null;
      });

      backendProcess.on('close', (code) => {
        console.log(`Backend process closed with code: ${code}`);
        backendProcess = null;
      });

      // Give the backend a moment to start
      setTimeout(() => {
        console.log(`✓ Backend should be running on http://${BACKEND_HOST}:${BACKEND_PORT}`);
      }, 2000);

    } catch (error) {
      console.error('✗ Failed to start backend executable:', error);
    }
  } else {
    console.error('✗ Backend executable not found - motion detection games will not work');
    console.error('  The app will still work, but motion-based games will be disabled.');
    console.error('  To fix: Rebuild the app with: npm run build:mac');
  }

  // Immediately open the window (show loading in UI until backend/camera is ready)
  createWindow();

  app.on('activate', function () {
    // Only create a window if none exist (prevents duplicate windows)
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on('window-all-closed', function () {
  if (backendProcess) {
    try {
      console.log('Shutting down backend process...');
      
      // Close stdin/stdout/stderr pipes to prevent EPIPE errors
      if (backendProcess.stdout) {
        backendProcess.stdout.removeAllListeners();
        backendProcess.stdout.destroy();
      }
      if (backendProcess.stderr) {
        backendProcess.stderr.removeAllListeners();
        backendProcess.stderr.destroy();
      }
      if (backendProcess.stdin) {
        backendProcess.stdin.end();
      }
      
      // Send SIGTERM first, then SIGKILL if needed
      backendProcess.kill('SIGTERM');
      
      // Force kill after 3 seconds if still running
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          console.log('Force killing backend process...');
          backendProcess.kill('SIGKILL');
        }
      }, 3000);
      
    } catch (e) {
      console.error('Error shutting down backend process:', e);
    }
    backendProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', function () {
  if (backendProcess) {
    try {
      console.log('App quitting, shutting down backend process...');
      
      // Close pipes to prevent EPIPE errors
      if (backendProcess.stdout) {
        backendProcess.stdout.removeAllListeners();
        backendProcess.stdout.destroy();
      }
      if (backendProcess.stderr) {
        backendProcess.stderr.removeAllListeners();
        backendProcess.stderr.destroy();
      }
      if (backendProcess.stdin) {
        backendProcess.stdin.end();
      }
      
      // Send SIGTERM
      backendProcess.kill('SIGTERM');
      
    } catch (e) {
      console.error('Error in before-quit backend shutdown:', e);
    }
  }
});
