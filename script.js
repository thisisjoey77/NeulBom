// Remove hardcoded API key - we'll get it from main process
let OPENAI_API_KEY = null;

// Check if Electron IPC is available
console.log('window.electron available:', typeof window.electron !== 'undefined');
console.log('window.electron.ipcRenderer available:', typeof window.electron?.ipcRenderer !== 'undefined');

// Initialize API key from main process
(async () => {
  try {
    if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
      OPENAI_API_KEY = await window.electron.ipcRenderer.invoke('get-openai-key');
      console.log('API key loaded:', OPENAI_API_KEY ? 'YES' : 'NO');
    } else {
      console.error('Electron IPC not available - running in browser?');
    }
  } catch (err) {
    console.error('Failed to load API key:', err);
  }
})();

// Get DOM elements (but don't fail if they don't exist)
const inputTextSpan = document.getElementById('inputText');
const aiResponseSpan = document.getElementById('aiResponse');

const messages = [
    {
        role: "system", content:
            "당신은 초등학생들을 위한 친절하고 즐거운 한국어 게임 비서입니다. " +
            "당신의 주된 역할은 아이들이 '끝말잇기', '숫자 세기 (예: 369 게임)', '점프 게임'과 같은 게임을 할 수 있도록 돕는 것입니다. " +
            "모든 대화는 한국어로 진행됩니다. " +
            "**매우 중요** 당신의 역할은 직접 게임을 같이 해주는 것이 아니라 아이들이 게임을 시작하고 규칙을 이해할 수 있도록 돕는 것입니다. "

            +"**매우 중요** 369게임처럼 프롬프트에 변형된 규칙이 있는 경우엔 오로지 쓰여있는 규칙만 따라야하고, 알려져있는 게임의 규칙은 전부 무시해야 합니다." +
            "사용자가 게임을 시작하려 할 때, 먼저 게임 설명이 필요한지 물어보고, 설명 요청 시 각 게임의 규칙을 간단하고 알기 쉽게 설명해주세요. " +
            "**매우 중요:** 당신은 직접 게임을 플레이하거나 게임의 진행 상황을 관리하지 않습니다. 사용자가 '시작하자'고 할 때, 항상 '게임은 화면에 있는 버튼을 눌러서 진행해주세요!'와 같이 버튼을 통해 진행하도록 안내해야 합니다. " +
            "다른 주제에 대한 질문에는 답변하지 않고, 항상 게임과 관련된 대화로 유도하거나, 게임을 시작하도록 안내해주세요. " +
            "초등학생 눈높이에 맞춰 친근하고 긍정적인 어조를 유지해주세요."

            + "단, 버튼을 눌러 시작하라는 말은 시작하자고 말하지 않는 이상 하지 마세요. 시작하자는 말 없이 진행하려는 경우, 오직 규칙 설명이 필요한지 물어보고 필요한 경우 설명을 해주세요."

            // 369 게임 규칙 설명
            + "**매우 중요** 그리고 369 게임 규칙을 설명할때, 몇가지 규칙을 다르게 해줘야해요. 우선 '짝'이 아닌 '코알라'라고 말을 해야하고, 3의 배수일 때만 '코알라'라고 말해야 합니다. 그리고, 3의 배수가 아닌 숫자를 말할때는 그냥 숫자만 말해줘야 해요. "
            + "3이 들어간 숫자인데 3의 배수가 아닌 경우엔, 코알라가 아니고 숫자를 외쳐야 합니다. 예를 들어, 13, 29, 43 등은 그냥 숫자만 말해야 합니다. "

            //끝말잇기 게임 규칙 설명
            + "끝말잇기 게임은 한국어 단어를 이어가는 게임입니다. " +
            "게임을 시작할 때, 첫 번째 플레이어가 단어를 말하면 다음 플레이어는 그 단어의 마지막 글자로 시작하는 새로운 단어를 말해야 합니다. " +
            "예를 들어, 첫 번째 플레이어가 '사과'라고 하면, 두 번째 플레이어는 '과일' 같은 단어를 말해야 합니다. " +
            "단, 이미 사용된 단어는 사용할 수 없으며, 단어가 존재하지 않는 경우에도 탈락하게 됩니다. " +
            "또한, 끝말잇기 규칙에 따라 두음법칙을 적용하여 단어를 이어가야 합니다. " +
            "게임은 모둠으로 진행할 수 있으며, 모둠원 전체가 함께 참여해야 합니다. " +
            "만약 모둠원이 한 명이라도 규칙을 어기거나 입력하지 않으면 해당 모둠은 탈락하게 됩니다."

            //점프 게임 규칙
            + "점프게임이라는 것은 존재하지 않는 게임이며, 규칙은 오로지 아래 설명대로 읽고 따라야 합니다. " +
            "점프게임은 컴퓨터에 써져있는 숫자 만큼 점프를 연속적으로 해야하는데, 이 때 점프는 1부터 10까지의 숫자 중 하나를 AI가 임의로 선택합니다. " +
            "이 때, 사용자는 AI가 선택한 숫자만큼 점프를 해야하며, 만약 사용자가 점프를 하지 않거나, 시간 안에 못하거나, 말한 숫자보다 더, 또는 덜 하게 되면 실패하게 됩니다. " +
            "점프게임은 모둠으로 할때 규칙이 하나 더 추가되는데, 점프를 할때 반드시 팀원 전체가 같이 점프를 해야합니다. " +
            "모둠으로 점프할때 시간안에 점프하고 모든 다른 규칙을 준수해도 다같이 점프를 하지 않는 경우에는 그 팀은 실패하게 되는 것입니다."

            //대화 방식
            +"**매우 중요:** 당신이 대화하는 주요 연령층은 초등학생들이기 때문에 대화 방식은 항상 친근하고 쉽게 이해할 수 있도록 해야 합니다. 그러기 위해서 모든 대화는 반말로 진행되어야 합니다. "
    }
];

// Display for player count
if (!document.getElementById('playerCountDisplay')) {
  const div = document.createElement('div');
  div.innerHTML = '현재 인원: <span id="playerCountDisplay">0</span>명';
  document.body.prepend(div);
}

let koreanVoice = null; // Store the Korean voice once it's found

// Find and store the Korean voice when voices change
speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    koreanVoice = voices.find(v => v.lang === 'ko-KR' && v.name.includes("Google"));
};

let peopleCount = 0;

function updatePeopleCount() {
    fetch('/people_count')
        .then(response => response.json())
        .then(data => {
            peopleCount = data.people;
            // Optionally update the UI if you have an element for it
            const display = document.getElementById('peopleCountDisplay');
            if (display) display.textContent = peopleCount;
        });
}

// Example: Call this when you detect the prompt "lets play 369"
function onLetsPlay369Prompt() {
    updatePeopleCount();
}

function pollPeopleCount() {
  fetch('http://localhost:5001/people_count')
    .then(res => res.json())
    .then(data => {
      playerCount = data.people;
      document.getElementById('playerCountDisplay').textContent = playerCount;
    })
    .catch(err => {
      // Silently handle connection errors when backend isn't ready
      console.log('Backend not ready yet, skipping people count update');
    });
}

// Wait a bit before starting to poll, and then poll every 2 seconds
setTimeout(() => {
  // Start polling after 5 seconds to give backend time to start
  setInterval(pollPeopleCount, 2000);
}, 5000);

// Microphone permission and SpeechRecognition support check
window.addEventListener('DOMContentLoaded', async function() {
  const startBtn = document.getElementById('start');
  const speechStatus = document.getElementById('speechStatus');

  // Electron detection
  const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';

  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    if (startBtn) startBtn.disabled = true;
    if (speechStatus) speechStatus.textContent = isElectron
      ? '이 앱에서는 음성 인식이 지원되지 않습니다. (Electron 환경)'
      : '이 브라우저에서는 음성 인식이 지원되지 않습니다.';
    return;
  }

  // Check and request microphone permission in Electron
  // For built apps, we should always test actual access rather than system status
  
  if (speechStatus) speechStatus.textContent = '마이크 권한을 확인하는 중...';
  
  // Always try to request permission through getUserMedia first
  // This is the most reliable way to trigger the macOS permission dialog
  // and works for both development and built apps
  try {
    console.log('Testing microphone access for built app...');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 44100,
        sampleSize: 16
      }
    });
    console.log('Microphone access test successful');
    stream.getTracks().forEach(track => track.stop()); // Stop immediately after testing
    if (speechStatus) speechStatus.textContent = '마이크 권한이 허용되었습니다.';
  } catch (getUserMediaError) {
    console.error('Microphone access test failed:', getUserMediaError);
    
    if (getUserMediaError.name === 'NotAllowedError') {
      if (speechStatus) speechStatus.textContent = '마이크 권한이 필요합니다. 권한을 설정해주세요.';
      
      // Only open permission dialog if available (for Electron context)
      if (isElectron && window.electron && window.electron.openPermissionDialog) {
        await window.electron.openPermissionDialog();
      }
      
      // Try again after the dialog or user action
      try {
        const retryStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 44100,
            sampleSize: 16
          }
        });
        retryStream.getTracks().forEach(track => track.stop());
        if (speechStatus) speechStatus.textContent = '마이크 권한이 허용되었습니다.';
      } catch (retryError) {
        if (speechStatus) {
          speechStatus.innerHTML = `
            ❌ 마이크 권한이 거부되었습니다.<br>
            <strong>해결 방법:</strong><br>
            • macOS: 시스템 환경설정 > 보안 및 개인정보 보호 > 개인정보 보호 > 마이크에서 이 앱 허용<br>
            • 앱을 다시 시작해야 할 수도 있습니다.
          `;
        }
        return;
      }
    } else if (getUserMediaError.name === 'NotFoundError') {
      if (speechStatus) speechStatus.textContent = '마이크를 찾을 수 없습니다.';
      return;
    } else {
      if (speechStatus) speechStatus.textContent = '마이크 접근 중 오류가 발생했습니다: ' + getUserMediaError.message;
      return;
    }
  }

  // Try to get mic permission proactively for web browsers
  if (!isElectron && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately, just testing permission
      if (speechStatus) speechStatus.textContent = '마이크 권한이 허용되었습니다.';
    } catch (error) {
      if (speechStatus) speechStatus.textContent = '마이크 권한이 필요합니다. 브라우저에서 마이크 권한을 허용해주세요.';
    }
  }
});

// Add a manual permission request button
window.addEventListener('DOMContentLoaded', function() {
  const permissionBtn = document.createElement('button');
  permissionBtn.textContent = '🎤 마이크 권한 설정';
  permissionBtn.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #007AFF;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    z-index: 1000;
  `;
  
  permissionBtn.addEventListener('click', async function() {
    if (window.electron && window.electron.openPermissionDialog) {
      await window.electron.openPermissionDialog();
    }
  });
  
  // Only show in Electron
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    document.body.appendChild(permissionBtn);
  }
});

// Microphone permission and SpeechRecognition support check
window.addEventListener('DOMContentLoaded', async function() {
  const startBtn = document.getElementById('start');
  const speechStatus = document.getElementById('speechStatus');

  // Electron detection
  const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';

  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    if (startBtn) startBtn.disabled = true;
    if (speechStatus) speechStatus.textContent = isElectron
      ? '이 앱에서는 음성 인식이 지원되지 않습니다. (Electron 환경)'
      : '이 브라우저에서는 음성 인식이 지원되지 않습니다.';
    return;
  }

  if (speechStatus) speechStatus.textContent = 'M 키를 눌러서 음성 인식을 시작하세요.';

  // Check if microphone devices are available
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    
    if (audioDevices.length === 0) {
      if (speechStatus) speechStatus.textContent = '⚠️ 마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
    }
  } catch (error) {
    console.error('Error enumerating devices:', error);
  }
});

window.addEventListener('DOMContentLoaded', function() {
  // Initialize camera on main page
  initializeMainPageCamera();
  
  // Legacy camera logic for other pages (like jump game)
  const loadingOverlay = document.getElementById('loadingOverlay');
  const localCamera = document.getElementById('localCamera');
  const yoloFeed = document.getElementById('yoloFeed');

  // Only run legacy camera logic if loading overlay exists (i.e., on specific game pages)
  if (loadingOverlay && localCamera && yoloFeed) {
    // Show local camera feed
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
          localCamera.srcObject = stream;
          localCamera.style.display = 'block';
          if (loadingOverlay) loadingOverlay.style.display = 'none';
        })
        .catch(function(err) {
          if (loadingOverlay) loadingOverlay.textContent = '카메라 접근이 불가합니다.';
        });
    }

    // Poll for YOLO backend readiness
    function checkYoloReady() {
      fetch('http://localhost:5001/video-feed-369', { method: 'HEAD' })
        .then(res => {
          if (res.ok) {
            // Add a 1 second delay before switching to YOLO feed
            setTimeout(() => {
              if (localCamera.srcObject) {
                localCamera.srcObject.getTracks().forEach(track => track.stop());
              }
              localCamera.style.display = 'none';
              yoloFeed.src = 'http://localhost:5001/video-feed-369';
              yoloFeed.style.display = 'block';
            }, 1000);
          } else {
            setTimeout(checkYoloReady, 1000);
          }
        })
        .catch(() => setTimeout(checkYoloReady, 1000));
    }
    checkYoloReady();
  }
});

// Main page camera initialization
async function initializeMainPageCamera() {
  const localCamera = document.getElementById('localCamera');
  const yoloFeed = document.getElementById('yoloFeed');
  const cameraStatus = document.getElementById('cameraStatus');
  
  // Only run on main page (check if we have the camera elements but not loading overlay)
  if (!localCamera || !yoloFeed || document.getElementById('loadingOverlay')) {
    return; // Not on main page or on a game page
  }
  
  console.log('Initializing main page camera...');
  
  // Check camera permissions in Electron
  const isBuiltElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
  
  if (isBuiltElectron && window.electron && window.electron.checkCameraPermission) {
    try {
      const permission = await window.electron.checkCameraPermission();
      console.log('Current camera permission:', permission);
      
      if (permission !== 'granted') {
        if (cameraStatus) cameraStatus.textContent = '카메라 권한을 요청하는 중...';
        
        // For macOS, we need to actually call getUserMedia to trigger the permission dialog
        try {
          console.log('Triggering getUserMedia to request camera permission...');
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Don't stop the stream yet - we'll use it for the local camera
          localCamera.srcObject = stream;
          localCamera.style.display = 'block';
          yoloFeed.style.display = 'none';
          if (cameraStatus) cameraStatus.textContent = '카메라 권한 허용됨 - 로컬 카메라 (AI 준비 중...)';
          console.log('Camera permission granted through getUserMedia');
          
          // Now start checking for AI backend
          pollForAIBackend();
          return;
          
        } catch (getUserMediaError) {
          console.error('getUserMedia for camera failed:', getUserMediaError);
          if (cameraStatus) cameraStatus.textContent = '카메라 권한이 거부되었습니다. 시스템 설정에서 카메라 권한을 허용해주세요.';
          return;
        }
      }
    } catch (error) {
      console.error('Error checking camera permission:', error);
    }
  }
  
  // Always start with local video first
  startLocalCamera();
  
  function startLocalCamera() {
    console.log('Starting local camera...');
    if (cameraStatus) cameraStatus.textContent = '로컬 카메라 시작 중...';
    
    // Start with a simple video tag showing local camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
          console.log('Local camera stream obtained');
          localCamera.srcObject = stream;
          localCamera.style.display = 'block';
          yoloFeed.style.display = 'none'; // Make sure AI feed is hidden
          if (cameraStatus) cameraStatus.textContent = '로컬 카메라 (AI 준비 중...)';
          
          // Now start checking for AI backend
          pollForAIBackend();
        })
        .catch(function(err) {
          console.error('Camera access error:', err);
          if (cameraStatus) cameraStatus.textContent = '카메라 접근이 불가합니다.';
        });
    }
  }
  
  function pollForAIBackend() {
    checkForAIBackend();
  }
  
  function checkForAIBackend() {
    console.log('Checking for AI backend...');
    
    // First check if backend is alive
    fetch('http://localhost:5001/people_count')
      .then(res => {
        if (res.ok) {
          console.log('Backend server is alive, now checking video feed...');
          
          // Backend is responding, now check video feed
          fetch('http://localhost:5001/video-feed-369', { method: 'HEAD' })
            .then(res => {
              console.log('AI video feed response status:', res.status);
              
              if (res.ok) {
                console.log('AI backend video feed is ready!');
                if (cameraStatus) cameraStatus.textContent = 'AI 준비 완료, 전환 중...';
                
                // Sleep 1 second as requested, then switch
                setTimeout(() => {
                  switchToAICamera();
                }, 1000);
                
              } else {
                console.log('AI video feed not ready, status:', res.status, 'retrying...');
                setTimeout(checkForAIBackend, 3000);
              }
            })
            .catch((err) => {
              console.log('AI video feed check failed:', err.message, 'retrying...');
              setTimeout(checkForAIBackend, 3000);
            });
            
        } else {
          console.log('Backend server not ready, retrying...');
          setTimeout(checkForAIBackend, 3000);
        }
      })
      .catch((err) => {
        console.log('Backend server check failed:', err.message, 'retrying...');
        setTimeout(checkForAIBackend, 3000);
      });
  }
  
  function switchToAICamera() {
    console.log('Switching to AI camera...');
    console.log('Local camera element:', localCamera);
    console.log('AI feed element:', yoloFeed);
    console.log('Local camera srcObject before:', localCamera.srcObject);
    
    // Stop local camera cleanly first
    if (localCamera.srcObject) {
      console.log('Stopping local camera tracks...');
      localCamera.srcObject.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      localCamera.srcObject = null;
    }
    
    // Hide local camera
    localCamera.style.display = 'none';
    console.log('Set local camera display to none');
    
    if (cameraStatus) cameraStatus.textContent = 'AI 카메라 준비 중...';
    
    // Wait a bit longer for camera to be fully released before starting AI feed
    setTimeout(() => {
      console.log('Now starting AI feed after camera release delay...');
      
      const aiUrl = 'http://localhost:5001/video-feed-369';
      console.log('Setting AI feed src to:', aiUrl);
      
      // Add event listeners before setting src
      yoloFeed.onerror = function(e) {
        console.error('AI feed error:', e);
        if (cameraStatus) cameraStatus.textContent = 'AI 카메라 로딩 실패 - 다시 시도 중...';
        
        // Try to restart the process
        setTimeout(() => {
          checkForAIBackend();
        }, 3000);
      };
      
      yoloFeed.onload = function() {
        console.log('AI feed loaded successfully');
        if (cameraStatus) cameraStatus.textContent = 'AI 사람 감지 카메라 활성';
      };
      
      // Set the source and display
      yoloFeed.src = aiUrl;
      yoloFeed.style.display = 'block';
      console.log('Set AI feed display to block');
      
      if (cameraStatus) cameraStatus.textContent = 'AI 사람 감지 카메라 로딩 중...';
      console.log('Successfully initiated switch to AI camera');
      
    }, 2000); // 2 second delay for camera to be fully released
  }
}

// Push-to-talk speech recognition with M key
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let stream = null;

// M key push-to-talk functionality
document.addEventListener('keydown', async (event) => {
  console.log('Key pressed:', event.code, 'isRecording:', isRecording);
  
  // Update visual indicator
  const keyStatus = document.getElementById('keyStatus');
  if (keyStatus) {
    keyStatus.textContent = `키 눌림: ${event.code}`;
    keyStatus.style.color = '#1976d2';
  }
  
  // Only trigger on M key and if not already recording
  if (event.code === 'KeyM' && !isRecording) {
    console.log('Starting recording...');
    event.preventDefault(); // Prevent any default behavior
    await startRecording();
  }
});

document.addEventListener('keyup', async (event) => {
  console.log('Key released:', event.code, 'isRecording:', isRecording);
  
  // Update visual indicator
  const keyStatus = document.getElementById('keyStatus');
  if (keyStatus) {
    keyStatus.textContent = 'M 키를 눌러서 테스트하세요';
    keyStatus.style.color = '#d32f2f';
  }
  
  // Only trigger on M key release and if currently recording
  if (event.code === 'KeyM' && isRecording) {
    console.log('Stopping recording...');
    event.preventDefault();
    await stopRecording();
  }
});

async function startRecording() {
  try {
    console.log('startRecording called');
    
    // First, test if we can actually access the microphone
    console.log('Testing microphone access...');
    let testStream;
    try {
      testStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          sampleSize: 16
        } 
      });
      console.log('Microphone test successful');
    } catch (testError) {
      console.error('Microphone test failed:', testError);
      const speechStatusElement = document.getElementById('speechStatus');
      isRecording = false;
      
      if (speechStatusElement) {
        if (testError.name === 'NotAllowedError') {
          speechStatusElement.innerHTML = `
            ❌ 마이크 권한이 필요합니다.<br>
            <strong>해결 방법:</strong><br>
            1. 브라우저에서 마이크 권한 허용<br>
            2. macOS: 시스템 환경설정 > 보안 및 개인정보 보호 > 개인정보 보호 > 마이크에서 이 앱 허용
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
    }
    
    // Use the test stream for recording
    stream = testStream;
    
    console.log('Creating MediaRecorder...');
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    });
    
    mediaRecorder.ondataavailable = (event) => {
      console.log('Audio data available, size:', event.data.size);
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    console.log('Starting MediaRecorder...');
    mediaRecorder.start();
    
  } catch (err) {
    console.error('Error starting recording:', err);
    const speechStatusElement = document.getElementById('speechStatus');
    isRecording = false;
    
    if (speechStatusElement) {
      if (err.name === 'NotAllowedError') {
        speechStatusElement.innerHTML = `
          ❌ 마이크 권한이 거부되었습니다.<br>
          <strong>해결 방법:</strong><br>
          1. 오른쪽 위의 🎤 버튼 클릭<br>
          2. 또는 시스템 환경설정 > 보안 및 개인정보 보호 > 개인정보 보호 > 마이크에서 이 앱 허용
        `;
      } else if (err.name === 'NotFoundError') {
        speechStatusElement.textContent = '❌ 마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
      } else {
        speechStatusElement.textContent = '❌ 녹음 시작 오류: ' + err.message;
      }
    }
  }
}

async function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  
  isRecording = false;
  
  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      try {
        document.getElementById('speechStatus').textContent = '음성 인식 중...';
        
        // Check if we have any audio chunks
        if (audioChunks.length === 0) {
          console.log('No audio chunks recorded');
          document.getElementById('speechStatus').textContent = '❌ 녹음된 오디오가 없습니다. 다시 시도해주세요.';
          resolve();
          return;
        }
        
        // Convert recorded audio to buffer
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('Audio blob size:', audioBlob.size);
        
        // Check if audio blob is too small (likely silence)
        if (audioBlob.size < 1000) { // Less than 1KB is probably silence
          console.log('Audio blob too small, likely silence');
          document.getElementById('speechStatus').textContent = '❌ 녹음된 음성이 너무 짧습니다. 더 길게 말씀해주세요.';
          resolve();
          return;
        }
        
        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = window.electron.bufferFrom(new Uint8Array(arrayBuffer));
        
        console.log('Sending audio buffer of size:', buffer.length);
        const text = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
        console.log('Recognized text:', text);
        
        document.getElementById('inputText').textContent = text;
        document.getElementById('speechStatus').textContent = '';
        
        // Add the recognized text to messages and send to OpenAI
        messages.push({ role: "user", content: text });

        // Trigger 369 game if user mentions it
        if (text.toLowerCase().includes("369")) {
          onLetsPlay369Prompt();
          resolve();
          return; // Don't continue with OpenAI chat if starting game
        }

        // Get API key via IPC
        const apiKey = await window.electron.ipcRenderer.invoke('get-openai-key');
        if (!apiKey) {
          throw new Error('OpenAI API key not available');
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: messages
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        let reply = data.choices[0].message.content.trim();

        // Remove emojis
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        reply = reply.replace(emojiRegex, '');

        // Add AI response to messages
        messages.push({ role: "assistant", content: reply });

        document.getElementById('aiResponse').textContent = reply;

        // Speak the response
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = 'ko-KR';
        if (koreanVoice) {
          utterance.voice = koreanVoice;
        }
        speechSynthesis.speak(utterance);
        
      } catch (err) {
        console.error('Speech recognition error:', err);
        document.getElementById('speechStatus').textContent = '음성 인식 오류: ' + err.message;
      } finally {
        // Clean up
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
        }
        resolve();
      }
    };
    
    mediaRecorder.stop();
  });
}