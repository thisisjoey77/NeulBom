const OPENAI_API_KEY = window.OPENAI_API_KEY;

    const startBtn = document.getElementById('start');
    const inputTextSpan = document.getElementById('inputText');
    const aiResponseSpan = document.getElementById('aiResponse');
   // #const video = document.getElementById('talkingVideo');

let playerCount = 0;
let currentNumber = 1;
let isFirstRound = true;
let awaitingAITurn = false;
let userInputs = [];
let inputTimeout = null;
let gameOver = false;

// Display for player count
if (!document.getElementById('playerCountDisplay')) {
  const div = document.createElement('div');
  div.innerHTML = '현재 인원: <span id="playerCountDisplay">0</span>명';
  document.body.prepend(div);
}

// Global variable to store the selected voice once loaded
let koreanVoice = null;

// Function to load and set the Korean voice
function loadKoreanVoice() {
  const voices = speechSynthesis.getVoices();
  koreanVoice = voices.find(v => v.lang === 'ko-KR' && v.name.includes("Google"));
  if (!koreanVoice) {
    console.warn("Google Korean voice not found, falling back to any Korean voice.");
    koreanVoice = voices.find(v => v.lang === 'ko-KR');
  }
}

// Listen for voices to be loaded initially
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadKoreanVoice;
  // If voices are already loaded before the event fires (e.g., page refresh), load them
  if (speechSynthesis.getVoices().length > 0) {
    loadKoreanVoice();
  }
}

// --- Helper function for AI speech ---
function speakAiResponse(text) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis API not supported.");
    return;
  }

  // If a speech is already in progress, stop it to prevent queuing up too many.
  // This might be desirable for a game where quick responses are needed.
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';

  // Use the globally set Korean voice
  if (koreanVoice) {
    utterance.voice = koreanVoice;
  } else {
    // If voice not yet loaded, try to load it or log a warning
    console.warn("Korean voice not yet loaded for speech. Speaking with default voice.");
    loadKoreanVoice(); // Attempt to load again in case it was missed
    if (koreanVoice) { // If loaded now, assign it
      utterance.voice = koreanVoice;
    }
  }

  speechSynthesis.speak(utterance);
}
// --- End Helper function ---


function pollPeopleCount() {
  fetch('http://localhost:5001/people_count')
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      playerCount = data.people;
      document.getElementById('playerCountDisplay').textContent = playerCount;
    })
    .catch(error => {
      console.error('Error fetching people count:', error);
      // Keep the last known player count if server is unavailable
    });
}
setInterval(pollPeopleCount, 2000);

function nextTurn() {
  if (playerCount === 0) return; // Wait for at least one player
  // This function is not currently used but kept for future reference
}

function listenForUserInputs() {
  showLoading('M키를 누르고 숫자나 "코알라"를 말하세요...');
  
  // Set up speech callback
  speechCallback = (transcript) => {
    hideLoading();
    handleUserInput(transcript);
  };
  
  // Set a timeout for input window
  const WINDOW = 10000; // 10 seconds
  if (inputTimeout) clearTimeout(inputTimeout);
  inputTimeout = setTimeout(() => {
    speechCallback = null;
    hideLoading();
    processUserInputs(); // Process with current inputs
  }, WINDOW);
}

function startUserInputPhase() {
  if (gameOver) return;
  if (playerCount === 0) {
    aiResponseSpan.textContent = '카메라에 사람이 감지될 때까지 대기 중...';
    aiResponseSpan.style.color = '';
    setTimeout(startUserInputPhase, 1000);
    return;
  }
  let message;
  if (isFirstRound) {
    message = `게임 시작! ${playerCount}명의 플레이어가 차례로 숫자를 말하세요.`;
    aiResponseSpan.style.color = '';
  } else {
    message = `다음 차례: ${currentNumber} ~ ${currentNumber + playerCount - 1}`;
    aiResponseSpan.style.color = 'red';
  }
  aiResponseSpan.textContent = message;
  userInputs = [];
  if (inputTimeout) clearTimeout(inputTimeout);
  listenForUserInputs();
}

window.onload = () => {
  aiResponseSpan.textContent = '게임을 시작하려면 버튼을 누르세요.';
};

startBtn.addEventListener('click', async () => {
  aiResponseSpan.textContent = '게임 시작 중...';
  await new Promise(resolve => setTimeout(resolve, 500));
  currentNumber = 1;
  isFirstRound = true;
  gameOver = false;
  userInputs = [];
  awaitingAITurn = false;
  startUserInputPhase();
});

function splitKoreanNumbers(input) {
  // Support only sino-Korean numbers (일, 이, 삼...) and digits, including spaced variations
  // Removed all native Korean numbers to match the normalization dictionary
  return input.match(/구십\s*구|구십\s*팔|구십\s*칠|구십\s*육|구십\s*오|구십\s*사|구십\s*삼|구십\s*이|구십\s*일|구십|팔십\s*구|팔십\s*팔|팔십\s*칠|팔십\s*육|팔십\s*오|팔십\s*사|팔십\s*삼|팔십\s*이|팔십\s*일|팔십|칠십\s*구|칠십\s*팔|칠십\s*칠|칠십\s*육|칠십\s*오|칠십\s*사|칠십\s*삼|칠십\s*이|칠십\s*일|칠십|육십\s*구|육십\s*팔|육십\s*칠|육십\s*육|육십\s*오|육십\s*사|육십\s*삼|육십\s*이|육십\s*일|육십|오십\s*구|오십\s*팔|오십\s*칠|오십\s*육|오십\s*오|오십\s*사|오십\s*삼|오십\s*이|오십\s*일|오십|사십\s*구|사십\s*팔|사십\s*칠|사십\s*육|사십\s*오|사십\s*사|사십\s*삼|사십\s*이|사십\s*일|사십|삼십\s*구|삼십\s*팔|삼십\s*칠|삼십\s*육|삼십\s*오|삼십\s*사|삼십\s*삼|삼십\s*이|삼십\s*일|삼십|이십\s*구|이십\s*팔|이십\s*칠|이십\s*육|이십\s*오|이십\s*사|이십\s*삼|이십\s*이|이십\s*일|이십|십\s*구|십\s*팔|십\s*칠|십\s*육|십\s*오|십\s*사|십\s*삼|십\s*이|십\s*일|십|백|구|팔|칠|육|오|사|삼|이|일|영|공|코알라|[0-9]+/g) || [];
}

function handleUserInput(transcript) {
  if (gameOver) return;
  console.log('Voice input received:', transcript);
  const parts = splitKoreanNumbers(transcript);
  for (let part of parts) {
    userInputs.push(part);
  }
  if (inputTimeout) clearTimeout(inputTimeout);
  if (userInputs.length < playerCount) {
    // Not enough inputs yet, restart listening
    listenForUserInputs();
  } else {
    // Got enough inputs, process immediately
    processUserInputs();
  }
}

function normalizeInput(input) {
  // Map both native and sino-Korean numbers to digits, extended to 100
  input = input.trim();
  // Remove spaces from compound numbers (e.g., "열 하나" -> "열하나")
  input = input.replace(/\s+/g, '');
  input = input.replace(/(번|숫자|입니다|이에요|예요|에요)/g, '');
  
  const map = {
    // Sino-Korean numbers
    '일': '1', '이': '2', '삼': '3', '사': '4', '오': '5',
    '육': '6', '칠': '7', '팔': '8', '구': '9', '십': '10',
    '십일': '11', '십이': '12', '십삼': '13', '십사': '14', '십오': '15',
    '십육': '16', '십칠': '17', '십팔': '18', '십구': '19', '이십': '20',
    '이십일': '21', '이십이': '22', '이십삼': '23', '이십사': '24', '이십오': '25',
    '이십육': '26', '이십칠': '27', '이십팔': '28', '이십구': '29', '삼십': '30',
    '삼십일': '31', '삼십이': '32', '삼십삼': '33', '삼십사': '34', '삼십오': '35',
    '삼십육': '36', '삼십칠': '37', '삼십팔': '38', '삼십구': '39', '사십': '40',
    '사십일': '41', '사십이': '42', '사십삼': '43', '사십사': '44', '사십오': '45',
    '사십육': '46', '사십칠': '47', '사십팔': '48', '사십구': '49', '오십': '50',
    '오십일': '51', '오십이': '52', '오십삼': '53', '오십사': '54', '오십오': '55',
    '오십육': '56', '오십칠': '57', '오십팔': '58', '오십구': '59', '육십': '60',
    '육십일': '61', '육십이': '62', '육십삼': '63', '육십사': '64', '육십오': '65',
    '육십육': '66', '육십칠': '67', '육십팔': '68', '육십구': '69', '칠십': '70',
    '칠십일': '71', '칠십이': '72', '칠십삼': '73', '칠십사': '74', '칠십오': '75',
    '칠십육': '76', '칠십칠': '77', '칠십팔': '78', '칠십구': '79', '팔십': '80',
    '팔십일': '81', '팔십이': '82', '팔십삼': '83', '팔십사': '84', '팔십오': '85',
    '팔십육': '86', '팔십칠': '87', '팔십팔': '88', '팔십구': '89', '구십': '90',
    '구십일': '91', '구십이': '92', '구십삼': '93', '구십사': '94', '구십오': '95',
    '구십육': '96', '구십칠': '97', '구십팔': '98', '구십구': '99', '백': '100',
    
    // Special cases
    '영': '0', '공': '0', '코알라': '코알라'
  };
  
  if (map[input]) return map[input];
  if (/^[0-9]+$/.test(input)) return input; // Accept digits as valid input
  if (input === '코알라') return input;
  const digitMatch = input.match(/[0-9]+/);
  if (digitMatch) return digitMatch[0];
  return input;
}

function processUserInputs() {
  if (gameOver) return;
  if (userInputs.length === 0) {
    setTimeout(startUserInputPhase, 1000);
    return;
  }
  let expected = [];
  for (let i = 0; i < playerCount; i++) {
    let num = currentNumber + i;
    // 369 rule: only multiples of 3 should be "코알라"
    let expectedVal = (num % 3 === 0) ? '코알라' : num.toString();
    expected.push(expectedVal);
  }
  // If more numbers are spoken than the number of players, it's a loss
  if (userInputs.length > playerCount) {
    const message = `AI 승리! ${playerCount+1}번째 입력이 과도하게 감지되었습니다.`;
    aiResponseSpan.textContent = message;
    speakAiResponse(message); // Speak the message
    gameOver = true;
    return;
  }
  for (let i = 0; i < userInputs.length && i < playerCount; i++) {
    if (normalizeInput(userInputs[i]) !== expected[i]) {
      const message = `AI 승리! ${i+1}번째 플레이어가 틀렸어요. 정답은 '${expected[i]}'입니다.`;
      aiResponseSpan.textContent = message;
      speakAiResponse(message); // Speak the message
      gameOver = true;
      return;
    }
  }
  if (userInputs.length !== playerCount) {
    const message = `AI 승리! ${userInputs.length+1}번째 플레이어가 입력하지 않았어요.`;
    aiResponseSpan.textContent = message;
    speakAiResponse(message); // Speak the message
    gameOver = true;
    return;
  }
  currentNumber += playerCount;
  awaitingAITurn = true;
  setTimeout(aiTurn, 1000);
}

function aiTurn() {
  if (!awaitingAITurn || gameOver) return;
  // Apply same 369 rule for AI - only multiples of 3
  let say = (currentNumber % 3 === 0) ? '코알라' : currentNumber.toString();
  aiResponseSpan.textContent = `AI: ${say}`;
  aiResponseSpan.style.color = '';
  speakAiResponse(say); // Use the new helper function for AI's turn
  currentNumber++;
  awaitingAITurn = false;
  isFirstRound = false; // No longer first round after AI takes a turn
  setTimeout(startUserInputPhase, 1000);
}

// OpenAI Whisper Speech Recognition Setup with M Key Push-to-Talk
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let stream = null;
let speechCallback = null;

// M key push-to-talk functionality
document.addEventListener('keydown', async (event) => {
  if (event.code === 'KeyM' && !isRecording && speechCallback) {
    event.preventDefault();
    await startSpeechRecording();
  }
});

document.addEventListener('keyup', async (event) => {
  if (event.code === 'KeyM' && isRecording) {
    event.preventDefault();
    await stopSpeechRecording();
  }
});

async function startSpeechRecording() {
  try {
    isRecording = true;
    audioChunks = [];
    
    if (speechStatus) speechStatus.textContent = '🎙️ 녹음 중... (M키를 놓으면 인식 시작)';
    
    stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 44100,
        sampleSize: 16
      } 
    });
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.start();
    
  } catch (err) {
    console.error('Error starting recording:', err);
    if (speechStatus) speechStatus.textContent = '녹음 오류: ' + err.message;
    isRecording = false;
  }
}

async function stopSpeechRecording() {
  if (!isRecording || !mediaRecorder) return;
  
  isRecording = false;
  
  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      try {
        if (speechStatus) speechStatus.textContent = '음성 인식 중...';
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = window.electron.bufferFrom(new Uint8Array(arrayBuffer));
        
        const text = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
        
        if (speechStatus) speechStatus.textContent = '';
        if (inputTextSpan) inputTextSpan.textContent = text;
        
        if (speechCallback) {
          speechCallback(text.trim());
          speechCallback = null;
        }
        
      } catch (err) {
        console.error('Speech recognition error:', err);
        if (speechStatus) speechStatus.textContent = '음성 인식 오류: ' + err.message;
      } finally {
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

// Loading overlay helpers
function showLoading(message = '로딩 중...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(255,255,255,0.8)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 9999;
    overlay.style.fontSize = '2em';
    overlay.innerHTML = `<span id='loadingText'>${message}</span>`;
    document.body.appendChild(overlay);
  } else {
    overlay.style.display = 'flex';
    document.getElementById('loadingText').textContent = message;
  }
}
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}
