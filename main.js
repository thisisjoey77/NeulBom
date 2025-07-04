const { app, BrowserWindow, systemPreferences, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
require('./speech_server');

let backendProcess = null;

// Add IPC handlers for permission checking
ipcMain.handle('check-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    console.log('IPC: Microphone permission status:', status);
    return status;
  }
  return 'granted'; // Non-macOS platforms
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
  }
  return true; // Non-macOS platforms
});

// Add camera permission handlers alongside microphone ones
ipcMain.handle('check-camera-permission', async () => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('camera');
    console.log('IPC: Camera permission status:', status);
    return status;
  }
  return 'granted'; // Non-macOS platforms
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
  }
  return true; // Non-macOS platforms
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
  
  // DevTools enabled for debugging
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
  
  win.loadFile('index.html');
}


app.whenReady().then(async () => {
  // Don't request permissions immediately - let the user trigger it
  console.log('App ready - permissions will be requested when needed');
  
  // Start the backend server before opening the window
  let backendPath;
  let workingDir;
  
  // Check if we're in development or packaged app
  if (app.isPackaged) {
    // In packaged app, the executable should be in the resources folder
    backendPath = path.join(process.resourcesPath, 'jump_server');
    workingDir = process.resourcesPath;
  } else {
    // In development
    backendPath = path.join(__dirname, 'dist', 'jump_server');
    workingDir = __dirname;
  }
  
  console.log('Backend path:', backendPath);
  console.log('Working directory:', workingDir);
  console.log('Backend exists:', fs.existsSync(backendPath));
  
  if (fs.existsSync(backendPath)) {
    console.log('Starting backend process...');
    backendProcess = spawn(backendPath, [], {
      cwd: workingDir,
      stdio: 'pipe',
      detached: false,
      env: { ...process.env }
    });
    
    backendProcess.stdout.on('data', (data) => {
      console.log('Backend stdout:', data.toString());
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.log('Backend stderr:', data.toString());
    });
    
    backendProcess.on('error', (error) => {
      console.error('Backend process error:', error);
    });
    
    backendProcess.on('exit', (code, signal) => {
      console.log('Backend process exited with code:', code, 'signal:', signal);
    });
  } else {
    console.error('Backend executable not found at:', backendPath);
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
      backendProcess.kill();
    } catch (e) {
      console.error('Error killing backend process:', e);
    }
    backendProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});
