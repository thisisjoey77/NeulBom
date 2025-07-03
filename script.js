// script.js - Main AI conversation script with secure API helper
// Uses secure API helper to protect API keys

// Dynamic backend URL based on environment
const getBackendUrl = () => {
  if (window.location.protocol === 'https:') {
    return 'https://54.180.16.112:5000';
  }
  return 'http://54.180.16.112:5000';
};

// Initialize camera
async function initCamera() {
  try {
    const video = document.getElementById('cam');
    if (!video) {
      console.error('Video element not found');
      return;
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });
    
    video.srcObject = stream;
    console.log('Camera initialized successfully');
    
    // Update camera status
    const statusElement = document.getElementById('cameraStatus');
    if (statusElement) {
      statusElement.textContent = 'Camera status: Active';
    }
  } catch (error) {
    console.error('Error accessing camera:', error);
    const statusElement = document.getElementById('cameraStatus');
    if (statusElement) {
      statusElement.textContent = 'Camera status: Error - ' + error.message;
    }
  }
}

// Initialize camera when page loads
document.addEventListener('DOMContentLoaded', initCamera);

const startBtn = document.getElementById('start');
const inputTextSpan = document.getElementById('inputText');
const aiResponseSpan = document.getElementById('aiResponse');
// #const video = document.getElementById('talkingVideo');

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

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ko-KR';
recognition.interimResults = false;

startBtn.onclick = () => {
    recognition.start();
};

let koreanVoice = null; // Store the Korean voice once it's found

// Find and store the Korean voice when voices change
speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    koreanVoice = voices.find(v => v.lang === 'ko-KR' && v.name.includes("Google"));
};

recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    inputTextSpan.textContent = transcript;

    // 🔁 사용자의 질문 추가
    messages.push({ role: "user", content: transcript });

    // Trigger 369 game if user mentions it
    if (transcript.toLowerCase().includes("369")) {
        onLetsPlay369Prompt();
    }

    try {
        const data = await callOpenAI(messages);
        let reply = data.choices[0].message.content.trim();

        // --- Regex to filter out emojis ---
        // This regex matches a wide range of Unicode emoji characters
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        reply = reply.replace(emojiRegex, '');
        // --- End of regex application ---

        // 🔁 AI 응답 추가
        messages.push({ role: "assistant", content: reply });

        aiResponseSpan.textContent = reply;
    } catch (error) {
        console.error('Error:', error);
        aiResponseSpan.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
    }

    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = 'ko-KR';

    // Assign the Korean voice if it has been found
    if (koreanVoice) {
        utterance.voice = koreanVoice;
    }

    // Speak the utterance here, outside of onvoiceschanged
    speechSynthesis.speak(utterance);
};

recognition.onerror = (event) => {
    console.error("음성 인식 오류:", event.error);
};

let peopleCount = 0;

// Helper: capture a frame from the webcam video element as a Blob
async function captureFrameBlob() {
  const video = document.getElementById('cam') || document.getElementById('video');
  if (!video || video.readyState < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
}

// POST a frame to /people_count and update the UI
async function updatePeopleCount() {
  const blob = await captureFrameBlob();
  if (!blob) {
    console.log('No frame captured - camera may not be ready');
    return;
  }
  
  const formData = new FormData();
  formData.append('frame', blob, 'frame.jpg');
  const backendUrl = getBackendUrl() + '/people_count';
  
  console.log('Sending request to:', backendUrl);
  
  try {
    const response = await fetch(backendUrl, { 
      method: 'POST', 
      body: formData,
      headers: {
        // Don't set Content-Type header - let browser set it for multipart/form-data
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Network error:', response.status, text);
      
      // Update detection results
      const detectionElement = document.getElementById('detectionResults');
      if (detectionElement) {
        detectionElement.textContent = `Detection results: Error ${response.status}`;
      }
      return;
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Response is not JSON:', text);
      
      // Update detection results
      const detectionElement = document.getElementById('detectionResults');
      if (detectionElement) {
        detectionElement.textContent = 'Detection results: Backend returned non-JSON response';
      }
      return;
    }
    
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      const text = await response.text();
      console.error('JSON parse error:', jsonErr, 'Response text:', text);
      
      // Update detection results
      const detectionElement = document.getElementById('detectionResults');
      if (detectionElement) {
        detectionElement.textContent = 'Detection results: JSON parse error';
      }
      return;
    }
    
    console.log('Received data:', data);
    
    playerCount = data.people || 0;
    const display = document.getElementById('playerCountDisplay');
    if (display) display.textContent = playerCount;
    
    // Update detection results
    const detectionElement = document.getElementById('detectionResults');
    if (detectionElement) {
      detectionElement.textContent = `Detection results: ${playerCount} people detected`;
    }
    
  } catch (e) {
    console.error('Failed to fetch people count:', e);
    
    // Update detection results
    const detectionElement = document.getElementById('detectionResults');
    if (detectionElement) {
      detectionElement.textContent = 'Detection results: Network error - ' + e.message;
    }
  }
}

setInterval(updatePeopleCount, 2000);

// --- 369 Game Alternating Mic Logic ---
let currentNumber = 1;
let isFirstRound = true;
let awaitingAITurn = false;
let userInputs = [];
let inputTimeout = null;
let gameOver = false;

function speakAiResponse(text) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis API not supported.");
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  if (koreanVoice) {
    utterance.voice = koreanVoice;
  } else {
    loadKoreanVoice && loadKoreanVoice();
    if (koreanVoice) utterance.voice = koreanVoice;
  }
  speechSynthesis.speak(utterance);
}

function listenForUserInputs() {
  showLoading('플레이어 입력 대기 중...');
  let transcript = '';
  let inputReceived = false;
  let lastSpeechTime = Date.now();
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal && !inputReceived) {
        transcript += event.results[i][0].transcript;
        lastSpeechTime = Date.now();
        inputReceived = true;
        hideLoading();
        showLoading('음성 인식 중...');
        recognition.stop();
        setTimeout(() => {
          hideLoading();
          handleUserInput(transcript.trim());
        }, 500);
        return;
      }
    }
  };
  recognition.onend = () => {
    if (!inputReceived) {
      hideLoading();
      processUserInputs();
    }
  };
  recognition.onerror = (e) => {
    hideLoading();
    console.log('Speech recognition error:', e);
    listenForUserInputs();
  };
  recognition.start();
  // Set a timeout to force end after WINDOW ms since last input
  const WINDOW = 3000; // 3 seconds
  if (inputTimeout) clearTimeout(inputTimeout);
  inputTimeout = setTimeout(() => {
    if (!inputReceived) {
      hideLoading();
      recognition.stop();
    }
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

function splitKoreanNumbers(input) {
  return input.match(/구십\s*구|구십\s*팔|구십\s*칠|구십\s*육|구십\s*오|구십\s*사|구십\s*삼|구십\s*이|구십\s*일|구십|팔십\s*구|팔십\s*팔|팔십\s*칠|팔십\s*육|팔십\s*오|팔십\s*사|팔십\s*삼|팔십\s*이|팔십\s*일|팔십|칠십\s*구|칠십\s*팔|칠십\s*칠|칠십\s*육|칠십\s*오|칠십\s*사|칠십\s*삼|칠십\s*이|칠십\s*일|칠십|육십\s*구|육십\s*팔|육십\s*칠|육십\s*육|육십\s*오|육십\s*사|육십\s*삼|육십\s*이|육십\s*일|육십|오십\s*구|오십\s*팔|오십\s*칠|오십\s*육|오십\s*오|오십\s*사|오십\s*삼|오십\s*이|오십\s*일|오십|사십\s*구|사십\s*팔|사십\s*칠|사십\s*육|사십\s*오|사십\s*사|사십\s*삼|사십\s*이|사십\s*일|사십|삼십\s*구|삼십\s*팔|삼십\s*칠|삼십\s*육|삼십\s*오|삼십\s*사|삼십\s*삼|삼십\s*이|삼십\s*일|삼십|이십\s*구|이십\s*팔|이십\s*칠|이십\s*육|이십\s*오|이십\s*사|이십\s*삼|이십\s*이|이십\s*일|이십|십\s*구|십\s*팔|십\s*칠|십\s*육|십\s*오|십\s*사|십\s*삼|십\s*이|십\s*일|십|백|구|팔|칠|육|오|사|삼|이|일|영|공|코알라|[0-9]+/g) || [];
}

function handleUserInput(transcript) {
  if (gameOver) return;
  const parts = splitKoreanNumbers(transcript);
  console.log('[369] handleUserInput transcript:', transcript, 'split:', parts, 'userInputs before:', userInputs);
  for (let part of parts) {
    userInputs.push(part);
  }
  console.log('[369] userInputs after:', userInputs, 'playerCount:', playerCount);
  if (inputTimeout) clearTimeout(inputTimeout);
  if (userInputs.length < playerCount) {
    console.log('[369] Not enough inputs yet, restarting listening');
    listenForUserInputs();
  } else {
    console.log('[369] Got enough inputs, calling processUserInputs');
    processUserInputs();
  }
}

function normalizeInput(input) {
  input = input.trim();
  input = input.replace(/\s+/g, '');
  input = input.replace(/(번|숫자|입니다|이에요|예요|에요)/g, '');
  const map = {
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
    '영': '0', '공': '0', '코알라': '코알라'
  };
  if (map[input]) return map[input];
  if (/^[0-9]+$/.test(input)) return input;
  if (input === '코알라') return input;
  const digitMatch = input.match(/[0-9]+/);
  if (digitMatch) return digitMatch[0];
  return input;
}

function processUserInputs() {
  if (gameOver) return;
  console.log('[369] processUserInputs userInputs:', userInputs, 'playerCount:', playerCount);
  if (userInputs.length === 0) {
    setTimeout(startUserInputPhase, 1000);
    return;
  }
  let expected = [];
  for (let i = 0; i < playerCount; i++) {
    let num = currentNumber + i;
    let expectedVal = (num % 3 === 0) ? '코알라' : num.toString();
    expected.push(expectedVal);
  }
  if (userInputs.length > playerCount) {
    const message = `AI 승리! ${playerCount+1}번째 입력이 과도하게 감지되었습니다.`;
    aiResponseSpan.textContent = message;
    speakAiResponse(message);
    gameOver = true;
    return;
  }
  for (let i = 0; i < userInputs.length && i < playerCount; i++) {
    if (normalizeInput(userInputs[i]) !== expected[i]) {
      const message = `AI 승리! ${i+1}번째 플레이어가 틀렸어요. 정답은 '${expected[i]}'입니다.`;
      aiResponseSpan.textContent = message;
      speakAiResponse(message);
      gameOver = true;
      return;
    }
  }
  if (userInputs.length !== playerCount) {
    const message = `AI 승리! ${userInputs.length+1}번째 플레이어가 입력하지 않았어요.`;
    aiResponseSpan.textContent = message;
    speakAiResponse(message);
    gameOver = true;
    return;
  }
  console.log('[369] All player inputs valid, AI turn next. currentNumber before:', currentNumber);
  currentNumber += playerCount;
  awaitingAITurn = true;
  setTimeout(aiTurn, 1000);
}

function aiTurn() {
  if (!awaitingAITurn || gameOver) return;
  let say = (currentNumber % 3 === 0) ? '코알라' : currentNumber.toString();
  aiResponseSpan.textContent = `AI: ${say}`;
  aiResponseSpan.style.color = '';
  speakAiResponse(say);
  currentNumber++;
  awaitingAITurn = false;
  isFirstRound = false;
  setTimeout(startUserInputPhase, 1000);
}

// --- End 369 Alternating Mic Logic ---
