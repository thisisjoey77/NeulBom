const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (...args) => ipcRenderer.invoke(...args)
  },
  bufferFrom: (arrayBuffer) => Buffer.from(arrayBuffer),
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),
  checkCameraPermission: () => ipcRenderer.invoke('check-camera-permission'),
  requestCameraPermission: () => ipcRenderer.invoke('request-camera-permission'),
  openPermissionDialog: () => ipcRenderer.invoke('open-permission-dialog')
});