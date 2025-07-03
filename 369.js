// 369.js - 369 Game with local API server
// API key is now stored securely in .env file and accessed through local server

const startBtn = document.getElementById('start');
const inputTextSpan = document.getElementById('inputText');
const aiResponseSpan = document.getElementById('aiResponse');
   // #const video = document.getElementById('talkingVideo');

let playerCount = 0;
let currentNumber = 1;
let isFirstRound = true;
let awaitingAITurn = false;
let awaitingUserInput = false; // Add this flag to track input state
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
  fetch('http://localhost:5000/people_count')
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
  if (isListening || !awaitingUserInput) {
    return; // Already listening or not supposed to listen
  }
  
  showLoading('플레이어 입력 대기 중... (말해주세요)');
  
  try {
    recognition.start();
    isListening = true;
    
    // Set a timeout to force end after some time if no speech is detected
    if (inputTimeout) clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
      if (isListening && awaitingUserInput) {
        recognition.stop();
        hideLoading();
        awaitingUserInput = false;
        if (userInputs.length === 0) {
          aiResponseSpan.textContent = '입력이 없어서 게임을 종료합니다.';
          gameOver = true;
        } else {
          processUserInputs();
        }
      }
    }, 8000); // 8 seconds total timeout
  } catch (error) {
    console.error('Failed to start speech recognition:', error);
    hideLoading();
    awaitingUserInput = false;
    aiResponseSpan.textContent = '음성 인식을 시작할 수 없습니다. 브라우저가 마이크를 지원하는지 확인해주세요.';
  }
}

function startUserInputPhase() {
  if (gameOver || awaitingUserInput) return;
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
  awaitingUserInput = true; // Set this flag before starting to listen
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
  awaitingUserInput = false; // Reset this flag
  startUserInputPhase();
});

function splitKoreanNumbers(input) {
  // Support only sino-Korean numbers (일, 이, 삼...) and digits, including spaced variations
  // Removed all native Korean numbers to match the normalization dictionary
  return input.match(/구십\s*구|구십\s*팔|구십\s*칠|구십\s*육|구십\s*오|구십\s*사|구십\s*삼|구십\s*이|구십\s*일|구십|팔십\s*구|팔십\s*팔|팔십\s*칠|팔십\s*육|팔십\s*오|팔십\s*사|팔십\s*삼|팔십\s*이|팔십\s*일|팔십|칠십\s*구|칠십\s*팔|칠십\s*칠|칠십\s*육|칠십\s*오|칠십\s*사|칠십\s*삼|칠십\s*이|칠십\s*일|칠십|육십\s*구|육십\s*팔|육십\s*칠|육십\s*육|육십\s*오|육십\s*사|육십\s*삼|육십\s*이|육십\s*일|육십|오십\s*구|오십\s*팔|오십\s*칠|오십\s*육|오십\s*오|오십\s*사|오십\s*삼|오십\s*이|오십\s*일|오십|사십\s*구|사십\s*팔|사십\s*칠|사십\s*육|사십\s*오|사십\s*사|사십\s*삼|사십\s*이|사십\s*일|사십|삼십\s*구|삼십\s*팔|삼십\s*칠|삼십\s*육|삼십\s*오|삼십\s*사|삼십\s*삼|삼십\s*이|삼십\s*일|삼십|이십\s*구|이십\s*팔|이십\s*칠|이십\s*육|이십\s*오|이십\s*사|이십\s*삼|이십\s*이|이십\s*일|이십|십\s*구|십\s*팔|십\s*칠|십\s*육|십\s*오|십\s*사|십\s*삼|십\s*이|십\s*일|십|백|구|팔|칠|육|오|사|삼|이|일|영|공|코알라|[0-9]+/g) || [];
}

function handleUserInput(transcript) {
  if (gameOver || awaitingAITurn || !awaitingUserInput) return;
  
  console.log('Voice input received:', transcript);
  hideLoading();
  
  // Stop listening immediately
  awaitingUserInput = false;
  if (isListening) {
    recognition.stop();
    isListening = false;
  }
  
  const parts = splitKoreanNumbers(transcript);
  for (let part of parts) {
    userInputs.push(part);
  }
  
  if (inputTimeout) clearTimeout(inputTimeout);
  
  // Process inputs immediately
  console.log('Processing inputs:', userInputs);
  processUserInputs();
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

// Speech recognition setup
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ko-KR';
recognition.interimResults = true; // Enable interim results for better feedback
recognition.continuous = false; // Don't keep listening continuously
recognition.maxAlternatives = 1; // Just get the best result

let isListening = false;
let recognitionTimeout = null;

recognition.onstart = () => {
  console.log('Speech recognition started');
  isListening = true;
};

recognition.onresult = (event) => {
  let interimTranscript = '';
  let finalTranscript = '';
  
  for (let i = event.resultIndex; i < event.results.length; ++i) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      finalTranscript += transcript;
    } else {
      interimTranscript += transcript;
    }
  }
  
  // Show interim results for better user feedback
  if (inputTextSpan) {
    inputTextSpan.textContent = finalTranscript || interimTranscript;
  }
  
  // Process final results immediately and stop recognition
  if (finalTranscript && awaitingUserInput) {
    console.log('Final transcript:', finalTranscript);
    hideLoading();
    if (isListening) {
      recognition.stop();
      isListening = false;
    }
    if (recognitionTimeout) {
      clearTimeout(recognitionTimeout);
    }
    handleUserInput(finalTranscript);
  }
};

recognition.onend = () => {
  console.log('Speech recognition ended');
  isListening = false;
  if (recognitionTimeout) {
    clearTimeout(recognitionTimeout);
  }
  // Don't automatically restart - let the game logic decide when to restart
};

recognition.onerror = (e) => {
  console.log('Speech recognition error:', e.error);
  isListening = false;
  if (recognitionTimeout) {
    clearTimeout(recognitionTimeout);
  }
  
  // Handle different error types
  switch (e.error) {
    case 'no-speech':
      console.log('No speech detected');
      break;
    case 'audio-capture':
      console.log('Audio capture failed');
      break;
    case 'not-allowed':
      console.log('Microphone access denied');
      aiResponseSpan.textContent = '마이크 접근이 거부되었습니다. 브라우저 설정에서 마이크를 허용해주세요.';
      return;
    case 'network':
      console.log('Network error');
      break;
    default:
      console.log('Other error:', e.error);
  }
  
  // Restart listening after error (except for permission errors)
  if (e.error !== 'not-allowed' && !awaitingAITurn && playerCount > 0 && !gameOver) {
    setTimeout(() => {
      if (!isListening) {
        listenForUserInputs();
      }
    }, 1000);
  }
};

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
