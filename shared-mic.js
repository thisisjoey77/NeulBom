// Shared microphone functionality for all game pages
// This module provides M-key push-to-talk functionality

console.log('Loading shared microphone module...');

// Check if Electron IPC is available
let OPENAI_API_KEY = null;

// Initialize API key from main process
(async () => {
  try {
    if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
      OPENAI_API_KEY = await window.electron.ipcRenderer.invoke('get-openai-key');
      console.log('API key loaded for microphone module:', OPENAI_API_KEY ? 'YES' : 'NO');
    } else {
      console.error('Electron IPC not available in microphone module');
    }
  } catch (err) {
    console.error('Failed to load API key in microphone module:', err);
  }
})();

// Microphone variables
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let stream = null;

// Add minimum recording time to prevent very short recordings
const MIN_RECORDING_TIME = 1000; // 1 second minimum
let recordingStartTime = 0;

// Create status elements if they don't exist
function ensureStatusElements() {
  if (!document.getElementById('speechStatus')) {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'speechStatus';
    statusDiv.style.cssText = 'color: red; margin-bottom: 8px; font-weight: bold; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;';
    statusDiv.textContent = '🎙️ M 키를 누르고 있는 동안 말하세요';
    
    // Find a good place to insert - after title or at top of container
    const container = document.querySelector('.container') || 
                     document.querySelector('.twentyq-container') ||
                     document.querySelector('body > div') ||
                     document.body;
    
    // Try to insert after any title/heading elements
    const title = container.querySelector('h1, h2, .title, .twentyq-title');
    if (title) {
      title.parentNode.insertBefore(statusDiv, title.nextSibling);
    } else {
      container.insertBefore(statusDiv, container.firstChild);
    }
  }
  
  if (!document.getElementById('inputText')) {
    const inputDiv = document.createElement('div');
    inputDiv.innerHTML = '<strong>입력 텍스트:</strong> <span id="inputText" style="color: #1976d2;"></span>';
    inputDiv.style.cssText = 'margin: 10px 0; padding: 8px; background: #e3f2fd; border-radius: 4px;';
    
    const speechStatus = document.getElementById('speechStatus');
    speechStatus.parentNode.insertBefore(inputDiv, speechStatus.nextSibling);
  }
  
  if (!document.getElementById('aiResponse')) {
    const responseDiv = document.createElement('div');
    responseDiv.innerHTML = '<strong>AI 응답:</strong> <span id="aiResponse" style="color: #388e3c;"></span>';
    responseDiv.style.cssText = 'margin: 10px 0; padding: 8px; background: #e8f5e8; border-radius: 4px;';
    
    const inputDiv = document.querySelector('#inputText').parentNode;
    inputDiv.parentNode.insertBefore(responseDiv, inputDiv.nextSibling);
  }
}

// M key push-to-talk functionality
document.addEventListener('keydown', async (event) => {
  console.log('Shared-mic: Key pressed:', event.code, 'isRecording:', isRecording);
  
  // Update visual indicator
  const speechStatus = document.getElementById('speechStatus');
  if (speechStatus && event.code === 'KeyM') {
    speechStatus.textContent = '🎙️ 녹음 중... (M키를 놓으면 인식 시작)';
    speechStatus.style.color = '#1976d2';
  }
  
  // Only trigger on M key and if not already recording
  if (event.code === 'KeyM' && !isRecording) {
    console.log('Shared-mic: Starting recording...');
    event.preventDefault();
    recordingStartTime = Date.now(); // Track recording start time
    await startRecording();
  }
});

document.addEventListener('keyup', async (event) => {
  console.log('Shared-mic: Key released:', event.code, 'isRecording:', isRecording);
  
  // Update visual indicator
  const speechStatus = document.getElementById('speechStatus');
  if (speechStatus && event.code === 'KeyM') {
    speechStatus.textContent = '🎙️ M 키를 누르고 있는 동안 말하세요';
    speechStatus.style.color = '#d32f2f';
  }
  
  // Only trigger on M key release and if currently recording
  if (event.code === 'KeyM' && isRecording) {
    console.log('Shared-mic: Stopping recording...');
    event.preventDefault();
    
    const recordingDuration = Date.now() - recordingStartTime;
    if (recordingDuration < MIN_RECORDING_TIME) {
      console.warn('Shared-mic: Recording too short, extending...');
      // Don't stop immediately, let it record for minimum time
      setTimeout(async () => {
        if (isRecording) {
          await stopRecording();
        }
      }, MIN_RECORDING_TIME - recordingDuration);
    } else {
      await stopRecording();
    }
  }
});

async function startRecording() {
  try {
    console.log('Shared-mic: startRecording called');
    ensureStatusElements();
    
    // Test microphone access with enhanced settings for better quality
    let testStream;
    try {
      testStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Lower sample rate for better Whisper compatibility
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      console.log('Shared-mic: Microphone test successful');
    } catch (testError) {
      console.error('Shared-mic: Microphone test failed:', testError);
      const speechStatusElement = document.getElementById('speechStatus');
      isRecording = false;
      
      if (speechStatusElement) {
        if (testError.name === 'NotAllowedError') {
          speechStatusElement.innerHTML = `
            ❌ 마이크 권한이 필요합니다.<br>
            <strong>해결 방법:</strong><br>
            1. 브라우저에서 마이크 권한 허용<br>
            2. Windows: 설정 > 개인정보 > 마이크에서 앱 허용
          `;
        } else if (testError.name === 'NotFoundError') {
          speechStatusElement.textContent = '❌ 마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
        } else {
          speechStatusElement.textContent = '❌ 마이크 접근 오류: ' + testError.message;
        }
      }
      return;
    }
    
    isRecording = true;
    audioChunks = [];
    
    const speechStatusElement = document.getElementById('speechStatus');
    if (speechStatusElement) {
      speechStatusElement.textContent = '🎙️ 녹음 중... (M키를 놓으면 인식 시작)';
      speechStatusElement.style.color = '#1976d2';
    }
    
    stream = testStream;
    
    // Try different audio formats for better compatibility
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }
    }
    
    console.log('Shared-mic: Using audio format:', mimeType);
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000 // Higher bit rate for better quality
    });
    
    mediaRecorder.ondataavailable = (event) => {
      console.log('Shared-mic: Audio data available, size:', event.data.size);
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      console.log('Shared-mic: MediaRecorder stopped');
      if (audioChunks.length > 0) {
        await processAudio();
      }
      
      // Clean up stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    };
    
    mediaRecorder.start();
    console.log('Shared-mic: Recording started');
    
  } catch (error) {
    console.error('Shared-mic: Error starting recording:', error);
    isRecording = false;
    const speechStatusElement = document.getElementById('speechStatus');
    if (speechStatusElement) {
      speechStatusElement.textContent = '❌ 녹음 시작 실패: ' + error.message;
    }
  }
}

async function stopRecording() {
  if (!mediaRecorder || !isRecording) {
    console.log('Shared-mic: Not recording, nothing to stop');
    return;
  }
  
  console.log('Shared-mic: Stopping recording...');
  isRecording = false;
  
  const speechStatusElement = document.getElementById('speechStatus');
  if (speechStatusElement) {
    speechStatusElement.textContent = '⏳ 음성 인식 중...';
    speechStatusElement.style.color = '#ff9800';
  }
  
  mediaRecorder.stop();
}

async function processAudio() {
  try {
    console.log('Shared-mic: Processing audio...');
    
    if (audioChunks.length === 0) {
      console.error('Shared-mic: No audio data to process');
      return;
    }
    
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    console.log('Shared-mic: Audio blob created, size:', audioBlob.size);
    
    if (audioBlob.size < 1000) {
      console.warn('Shared-mic: Audio blob too small, likely no speech');
      const speechStatusElement = document.getElementById('speechStatus');
      if (speechStatusElement) {
        speechStatusElement.textContent = '⚠️ 음성이 감지되지 않았습니다. 더 크게 말씀해주세요.';
      }
      return;
    }
    
    // Convert to array buffer for Electron IPC
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = new Uint8Array(arrayBuffer);
    
    console.log('Shared-mic: Sending audio to Electron for recognition...');
    
    // Use Electron IPC if available, otherwise fall back to fetch
    let result;
    if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
      try {
        const text = await window.electron.ipcRenderer.invoke('recognize-audio', audioBuffer);
        result = { text: text };
      } catch (ipcError) {
        console.error('Shared-mic: IPC recognition failed:', ipcError);
        throw ipcError;
      }
    } else {
      // Fallback: try HTTP request to Flask server (if it has speech endpoint)
      console.warn('Shared-mic: Electron IPC not available, trying HTTP fallback...');
      const base64Audio = await blobToBase64(audioBlob);
      
      const response = await fetch('http://localhost:5001/speech-to-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
          format: 'webm'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      result = await response.json();
    }
    
    console.log('Shared-mic: Speech recognition result:', result);
    
    if (result.text) {
      const inputTextSpan = document.getElementById('inputText');
      if (inputTextSpan) {
        inputTextSpan.textContent = result.text;
      }
      
      // Get AI response
      await getAIResponse(result.text);
    } else {
      const speechStatusElement = document.getElementById('speechStatus');
      if (speechStatusElement) {
        speechStatusElement.textContent = '⚠️ 음성을 인식하지 못했습니다. 다시 시도해주세요.';
      }
    }
    
  } catch (error) {
    console.error('Shared-mic: Error processing audio:', error);
    const speechStatusElement = document.getElementById('speechStatus');
    if (speechStatusElement) {
      // Provide more specific error messages
      if (error.message.includes('Audio unclear')) {
        speechStatusElement.textContent = '⚠️ 음성이 명확하지 않습니다. 더 크고 명확하게 말씀해주세요.';
        speechStatusElement.style.color = '#ff9800';
      } else if (error.message.includes('No speech recognized')) {
        speechStatusElement.textContent = '⚠️ 음성을 인식하지 못했습니다. 마이크 가까이에서 다시 시도해주세요.';
        speechStatusElement.style.color = '#ff9800';
      } else if (error.message.includes('Audio too short')) {
        speechStatusElement.textContent = '⚠️ 녹음 시간이 너무 짧습니다. M키를 더 오래 눌러주세요.';
        speechStatusElement.style.color = '#ff9800';
      } else {
        speechStatusElement.textContent = '❌ 음성 처리 오류: ' + error.message;
        speechStatusElement.style.color = '#d32f2f';
      }
    }
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getAIResponse(userText) {
  try {
    const speechStatusElement = document.getElementById('speechStatus');
    if (speechStatusElement) {
      speechStatusElement.textContent = '🤖 AI 응답 생성 중...';
      speechStatusElement.style.color = '#9c27b0';
    }
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not available');
    }
    
    const messages = [
      {
        role: "system", 
        content: "당신은 초등학생들을 위한 친절하고 즐거운 한국어 게임 비서입니다. " +
          "당신의 주된 역할은 아이들이 '끝말잇기', '숫자 세기 (예: 369 게임)', '점프 게임'과 같은 게임을 할 수 있도록 돕는 것입니다. " +
          "모든 대화는 한국어로 진행됩니다. " +
          "**매우 중요** 당신의 역할은 직접 게임을 같이 해주는 것이 아니라 아이들이 게임을 시작하고 규칙을 이해할 수 있도록 돕는 것입니다. " +
          "**매우 중요** 369게임처럼 프롬프트에 변형된 규칙이 있는 경우엔 오로지 쓰여있는 규칙만 따라야하고, 알려져있는 게임의 규칙은 전부 무시해야 합니다." +
          "사용자가 게임을 시작하려 할 때, 먼저 게임 설명이 필요한지 물어보고, 설명 요청 시 각 게임의 규칙을 간단하고 알기 쉽게 설명해주세요. " +
          "**매우 중요:** 당신은 직접 게임을 플레이하거나 게임의 진행 상황을 관리하지 않습니다. 사용자가 '시작하자'고 할 때, 항상 '게임은 화면에 있는 버튼을 눌러서 진행해주세요!'와 같이 버튼을 통해 진행하도록 안내해야 합니다. " +
          "다른 주제에 대한 질문에는 답변하지 않고, 항상 게임과 관련된 대화로 유도하거나, 게임을 시작하도록 안내해주세요. " +
          "초등학생 눈높이에 맞춰 친근하고 긍정적인 어조를 유지해주세요." +
          "단, 버튼을 눌러 시작하라는 말은 시작하자고 말하지 않는 이상 하지 마세요. 시작하자는 말 없이 진행하려는 경우, 오직 규칙 설명이 필요한지 물어보고 필요한 경우 설명을 해주세요." +
          "**매우 중요** 그리고 369 게임 규칙을 설명할때, 몇가지 규칙을 다르게 해줘야해요. 우선 '짝'이 아닌 '코알라'라고 말을 해야하고, 3의 배수일 때만 '코알라'라고 말해야 합니다. 그리고, 3의 배수가 아닌 숫자를 말할때는 그냥 숫자만 말해줘야 해요. " +
          "3이 들어간 숫자인데 3의 배수가 아닌 경우엔, 코알라가 아니고 숫자를 외쳐야 합니다. 예를 들어, 13, 29, 43 등은 그냥 숫자만 말해야 합니다. " +
          "끝말잇기 게임은 한국어 단어를 이어가는 게임입니다. " +
          "게임을 시작할 때, 첫 번째 플레이어가 단어를 말하면 다음 플레이어는 그 단어의 마지막 글자로 시작하는 새로운 단어를 말해야 합니다. " +
          "예를 들어, 첫 번째 플레이어가 '사과'라고 하면, 두 번째 플레이어는 '과일' 같은 단어를 말해야 합니다. " +
          "단, 이미 사용된 단어는 사용할 수 없으며, 단어가 존재하지 않는 경우에도 탈락하게 됩니다. " +
          "또한, 끝말잇기 규칙에 따라 두음법칙을 적용하여 단어를 이어가야 합니다. " +
          "게임은 모둠으로 진행할 수 있으며, 모둠원 전체가 함께 참여해야 합니다. " +
          "만약 모둠원이 한 명이라도 규칙을 어기거나 입력하지 않으면 해당 모둠은 탈락하게 됩니다." +
          "점프게임이라는 것은 존재하지 않는 게임이며, 규칙은 오로지 아래 설명대로 읽고 따라야 합니다. " +
          "점프게임은 컴퓨터에 써져있는 숫자 만큼 점프를 연속적으로 해야하는데, 이 때 점프는 1부터 10까지의 숫자 중 하나를 AI가 임의로 선택합니다. " +
          "이 때, 사용자는 AI가 선택한 숫자만큼 점프를 해야하며, 만약 사용자가 점프를 하지 않거나, 시간 안에 못하거나, 말한 숫자보다 더, 또는 덜 하게 되면 실패하게 됩니다. " +
          "점프게임은 모둠으로 할때 규칙이 하나 더 추가되는데, 점프를 할때 반드시 팀원 전체가 같이 점프를 해야합니다. " +
          "모둠으로 점프할때 시간안에 점프하고 모든 다른 규칙을 준수해도 다같이 점프를 하지 않는 경우에는 그 팀은 실패하게 되는 것입니다." +
          "**매우 중요:** 당신이 대화하는 주요 연령층은 초등학생들이기 때문에 대화 방식은 항상 친근하고 쉽게 이해할 수 있도록 해야 합니다. 그러기 위해서 모든 대화는 반말로 진행되어야 합니다."
      },
      {
        role: "user",
        content: userText
      }
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 200,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    const aiResponseSpan = document.getElementById('aiResponse');
    if (aiResponseSpan) {
      aiResponseSpan.textContent = aiResponse;
    }
    
    // Speak the response
    speakText(aiResponse);
    
    if (speechStatusElement) {
      speechStatusElement.textContent = '✅ 완료! M 키를 누르고 있는 동안 말하세요';
      speechStatusElement.style.color = '#4caf50';
    }
    
  } catch (error) {
    console.error('Shared-mic: Error getting AI response:', error);
    const speechStatusElement = document.getElementById('speechStatus');
    if (speechStatusElement) {
      speechStatusElement.textContent = '❌ AI 응답 오류: ' + error.message;
    }
  }
}

function speakText(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    // Try to use Korean voice if available
    const voices = speechSynthesis.getVoices();
    const koreanVoice = voices.find(voice => voice.lang === 'ko-KR');
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }
    
    speechSynthesis.speak(utterance);
  }
}

// Initialize status elements when the page loads
document.addEventListener('DOMContentLoaded', () => {
  ensureStatusElements();
  console.log('Shared microphone module initialized');
});

// Also try to initialize immediately in case DOMContentLoaded already fired
if (document.readyState === 'loading') {
  // Still loading, wait for DOMContentLoaded
} else {
  // Already loaded
  ensureStatusElements();
  console.log('Shared microphone module initialized (immediate)');
}
