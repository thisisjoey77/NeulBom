// Permission helper for Electron app
window.PermissionHelper = {
  async checkMicrophonePermission() {
    const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
    
    // For Electron apps, always test actual microphone access rather than relying on system status
    // This is especially important for built apps where system status can be unreliable
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        console.log('Testing actual microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 44100,
            sampleSize: 16
          }
        });
        console.log('Microphone access test successful');
        stream.getTracks().forEach(track => track.stop()); // Stop immediately
        return true;
      } catch (error) {
        console.log('Microphone access test failed:', error.name, error.message);
        return false;
      }
    }
    
    return false;
  },
  
  async requestMicrophonePermission() {
    // The most reliable way to request microphone permission is through getUserMedia
    // This works for both development and built apps
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        console.log('Requesting microphone permission via getUserMedia...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 44100,
            sampleSize: 16
          }
        });
        console.log('Microphone permission granted');
        stream.getTracks().forEach(track => track.stop()); // Stop immediately
        return true;
      } catch (error) {
        console.error('Microphone permission request failed:', error.name, error.message);
        return false;
      }
    }
    
    return false;
  },
  
  async checkCameraPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        console.log('Testing actual camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('Camera access test successful');
        stream.getTracks().forEach(track => track.stop()); // Stop immediately
        return true;
      } catch (error) {
        console.log('Camera access test failed:', error.name, error.message);
        return false;
      }
    }
    
    return false;
  },
  
  async requestCameraPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        console.log('Requesting camera permission via getUserMedia...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('Camera permission granted');
        stream.getTracks().forEach(track => track.stop()); // Stop immediately
        return true;
      } catch (error) {
        console.error('Camera permission request failed:', error.name, error.message);
        return false;
      }
    }
    
    return false;
  }
};
