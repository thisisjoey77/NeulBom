// telephoneGame.js - Telephone Game with OpenAI API for answer checking
let OPENAI_API_KEY = null;

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
// Example action prompts in Korean (반말)
const prompts = [
  "앉아", "일어나", "점프해", "박수쳐", "손 흔들어", "돌아", "발끝 만져", "손 들어", "끄덕여", "고개 저어", "달려", "걸어", "한 발로 뛰어", "웃어", "하품해", "눈 깜빡여", "기지개 켜", "가리켜", "기침해", "웃어봐"
];

const messages = [
  {
    role: "system",
    content: "너는 어린이 초등학생을 위한 제시어 게임의 채점 도우미야. 사용자가 단어 두개를 제시할거야. 첫 단어는 원래 제시어. 아이가 쓴 답이 두번째 단어야. 아이의 답이 원래 제시어와 의미가 비슷하거나, 동사/명사 변형(예: '박수쳐'와 '박수', '일어나'와 '일어남', '웃어'와 '웃음')처럼 형태가 달라도 의미가 같으면 '정답이야!', 아니면 '틀렸어!'만 한국어로 대답해. 띄어쓰기, 조사, 어미, 맞춤법이 달라도 의미가 같으면 정답으로 인정해."
  }
];

const oppositeMessages = [
  {
    role: "system", 
    content: "너는 어린이 초등학생을 위한 '반대말 게임'의 채점 도우미야. 사용자가 단어 두개를 제시할거야. 첫 단어는 원래 제시어. 아이가 쓴 답이 두번째 단어야. 아이의 답이 원래 제시어의 반대 의미이거나 반대 행동이면 '정답이야!', 아니면 '틀렸어!'만 한국어로 대답해. 예시: '앉아'의 반대는 '일어나/서/일어서기/일어서다/자리에서 일어나', '웃어'의 반대는 '울어/울기/운다', '들어'의 반대는 '나가/밖으로/나가기', '위로'의 반대는 '아래로/밑으로' 등. 띄어쓰기, 조사, 어미, 맞춤법이 달라도 반대 의미가 맞으면 정답으로 인정해. 또한 동사/명사 변형(예: '일어나'와 '일어남', '일어서기', '일어서다')처럼 형태가 달라도 반대 의미가 같으면 정답으로 인정해."
  }
];

let currentPrompt = "";

function isOppositeMode() {
  return document.getElementById('oppositeMode').checked;
}

function pickPrompt() {
  currentPrompt = prompts[Math.floor(Math.random() * prompts.length)];
}

function showPrompt() {
  const promptDisplay = document.getElementById('promptDisplay');
  if (isOppositeMode()) {
    promptDisplay.textContent = currentPrompt + "의 반대";
    promptDisplay.style.color = '#d32f2f'; // Red color for opposite mode
  } else {
    promptDisplay.textContent = currentPrompt;
    promptDisplay.style.color = '#1976d2'; // Original blue color
  }
  promptDisplay.style.display = 'block';
  setTimeout(() => {
    promptDisplay.style.display = 'none';
    document.getElementById('showPromptBtn').style.display = 'none';
    document.getElementById('userAnswer')?.disabled && (document.getElementById('userAnswer').disabled = false);
    document.querySelector('#answerForm button')?.disabled && (document.querySelector('#answerForm button').disabled = false);
    document.getElementById('userAnswer')?.focus();
  }, 5000);
}

window.onload = function() {
  pickPrompt();
  document.getElementById('showPromptBtn').onclick = showPrompt;

  // Add event listener for opposite mode toggle
  document.getElementById('oppositeMode').onchange = function() {
    // Reset the game when mode changes
    pickPrompt();
    document.getElementById('promptDisplay').style.display = 'none';
    document.getElementById('showPromptBtn').style.display = 'inline-block';
    document.getElementById('voiceInputDisplay').textContent = '';
    document.getElementById('resultDisplay').textContent = '';
  };

  // OpenAI Whisper Speech Recognition Setup with M Key Push-to-Talk
  let isRecording = false;
  let mediaRecorder;
  let audioChunks = [];

  function setupSpeechRecognition() {
    // Show speech instructions
    const instructionsDiv = document.createElement('div');
    instructionsDiv.innerHTML = `
      <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 0.95em; color: #1976d2;">
        <strong>음성 입력:</strong> M 키를 누르고 있는 동안 말하세요. 키를 떼면 음성이 인식됩니다.
      </div>
    `;
    const container = document.querySelector('.twentyq-container, .game-container');
    if (container) {
      container.insertBefore(instructionsDiv, container.children[1]);
    }

    // M key push-to-talk functionality
    document.addEventListener('keydown', function(event) {
      if (event.key === 'm' || event.key === 'M') {
        if (!isRecording && currentPrompt) {
          startRecording();
        }
      }
    });

    document.addEventListener('keyup', function(event) {
      if (event.key === 'm' || event.key === 'M') {
        if (isRecording) {
          stopRecording();
        }
      }
    });
  }

  async function startRecording() {
    if (isRecording || !currentPrompt) return;
    
    try {
      isRecording = true;
      audioChunks = [];
      
      const voiceInputDisplay = document.getElementById('voiceInputDisplay');
      
      voiceInputDisplay.textContent = '🎤 Recording... (Release M key to stop)';
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = function(event) {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async function() {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      
    } catch (err) {
      console.error('Error starting recording:', err);
      isRecording = false;
      const voiceInputDisplay = document.getElementById('voiceInputDisplay');
      voiceInputDisplay.textContent = 'Error: Could not access microphone';
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    isRecording = false;
    mediaRecorder.stop();
    document.getElementById('voiceInputDisplay').textContent = '🔄 Processing speech...';
  }

  async function processAudio(audioBlob) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = window.electron.bufferFrom(arrayBuffer);
      
      const transcript = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
      
      const voiceInputDisplay = document.getElementById('voiceInputDisplay');
      
      if (transcript && transcript.trim()) {
        voiceInputDisplay.textContent = '입력: ' + transcript.trim();
        
        // Auto-grade the answer
        await gradeAnswer(transcript.trim());
      } else {
        voiceInputDisplay.textContent = '❌ No speech detected';
      }
    } catch (err) {
      console.error('Speech recognition error:', err);
      const voiceInputDisplay = document.getElementById('voiceInputDisplay');
      voiceInputDisplay.textContent = '❌ Speech recognition failed';
    }
  }

  async function gradeAnswer(transcript) {
    if (!OPENAI_API_KEY) {
      document.getElementById('resultDisplay').textContent = 'API 키가 로드되지 않았습니다. 다시 시도해주세요.';
      return;
    }
    
    document.getElementById('resultDisplay').textContent = '채점 중...';
    
    // Choose the appropriate message system based on mode
    const currentMessages = isOppositeMode() ? [...oppositeMessages] : [...messages];
    
    if (isOppositeMode()) {
      currentMessages.push({
        role: 'user', 
        content: '원래 제시어는: ' + currentPrompt + '. 아이가 쓴 반대말 답은: ' + transcript
      });
    } else {
      currentMessages.push({
        role: 'user',
        content: '원래 제시어는: ' + currentPrompt + '. 아이가 쓴 답은 ' + transcript
      });
    }
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: currentMessages
        })
    });
    const data = await response.json();
    let reply = data.choices[0].message.content.trim();
    document.getElementById('resultDisplay').textContent = reply;
  }

  // Setup speech recognition
  setupSpeechRecognition();
};
