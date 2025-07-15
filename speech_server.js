const path = require('path');
const { app, ipcMain } = require('electron');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Load environment variables with proper path handling for both dev and production
if (app.isPackaged) {
  // In packaged app, try multiple possible locations for .env
  const possibleEnvPaths = [
    path.join(process.resourcesPath, 'app', '.env'),
    path.join(process.resourcesPath, '.env'),
    path.join(path.dirname(process.execPath), '.env'),
    path.join(__dirname, '.env')
  ];
  
  let envLoaded = false;
  for (const envPath of possibleEnvPaths) {
    console.log('Trying .env at:', envPath);
    if (require('fs').existsSync(envPath)) {
      console.log('Found .env at:', envPath);
      require('dotenv').config({ path: envPath });
      envLoaded = true;
      break;
    }
  }
  
  if (!envLoaded) {
    console.warn('No .env file found in packaged app');
  }
} else {
  // In development, load from current directory
  require('dotenv').config();
}

// Debug: Check if API key is loaded
console.log('OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? 'YES' : 'NO');
if (!process.env.OPENAI_API_KEY) {
  console.error('WARNING: OPENAI_API_KEY not found in environment variables');
}

// Expose API key to renderer process
ipcMain.handle('get-openai-key', async () => {
  return process.env.OPENAI_API_KEY;
});

ipcMain.handle('recognize-audio', async (event, audioBuffer) => {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Please check your .env file.');
  }

  console.log('Audio buffer size:', audioBuffer.length);
  
  // Check if audio buffer is too small
  if (audioBuffer.length < 1000) {
    console.log('Audio buffer too small, likely empty or silent');
    throw new Error('Audio buffer too small - no speech detected');
  }
  
  const { Readable } = require('stream');
  
  // Convert buffer to a readable stream
  const stream = new Readable();
  stream.push(audioBuffer);
  stream.push(null); // End the stream
  
  const form = new FormData();
  form.append('file', stream, {
    filename: 'audio.wav',
    contentType: 'audio/wav'
  });
  form.append('model', 'whisper-1');
  form.append('language', 'ko');

  console.log('Sending request to Whisper API...');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

  console.log('Whisper API response status:', response.status);
  if (!response.ok) {
    const err = await response.text();
    console.error('Whisper API error:', err);
    throw new Error('Whisper API error: ' + err);
  }
  const data = await response.json();
  console.log('Whisper API response:', data);
  
  // Check if the recognized text is meaningful
  if (!data.text || data.text.trim().length === 0) {
    throw new Error('No speech recognized in audio');
  }
  
  // Common fallback responses from Whisper when audio is unclear
  const fallbackResponses = ['고맙습니다', '감사합니다', '안녕하세요', 'Thank you', 'Thanks'];
  if (fallbackResponses.includes(data.text.trim())) {
    console.log('Detected likely fallback response from Whisper:', data.text);
    throw new Error('Audio unclear - please speak louder or closer to microphone');
  }
  
  return data.text;
});