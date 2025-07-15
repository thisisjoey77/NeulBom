// --- 끝말잇기 Game Logic ---
let wordHistory = [];
let playerCount = 0;
let currentTurn = 0; // 0 ~ (playerCount-1) for players, playerCount for computer
let lastWord = '';
let gameActive = false;
let timeoutHandle = null;
const TURN_TIMEOUT = 3000; // 3 seconds per turn

function pollPeopleCount() {
  fetch('http://localhost:5001/people_count')
    .then(res => res.json())
    .then(data => {
      playerCount = data.people;
      // Optionally update UI
    });
}
setInterval(pollPeopleCount, 2000);


// UI elements
const kkeutmalStatus = document.getElementById('kkeutmalStatus');
const kkeutmalBtn = document.getElementById('kkeutmalBtn');
const wordHistoryDiv = document.getElementById('wordHistory');

if (kkeutmalBtn) {
  kkeutmalBtn.addEventListener('click', startKkeutmalGame);
}

function startKkeutmalGame() {
  wordHistory = [];
  lastWord = '';
  currentTurn = 0;
  gameActive = false;
  if (kkeutmalStatus) kkeutmalStatus.textContent = '플레이어 수를 감지 중...';
  waitForPlayersAndStart();
}

function waitForPlayersAndStart() {
  let checkCount = 0;
  function checkPlayers() {
    pollPeopleCount();
    if (playerCount > 0) {
      gameActive = true;
      if (kkeutmalStatus) kkeutmalStatus.textContent = `${playerCount}명의 플레이어가 감지되었습니다. 곧 게임이 시작됩니다.`;
      setTimeout(startUserInputPhase, 1500);
    } else {
      checkCount++;
      if (checkCount < 10) {
        setTimeout(checkPlayers, 2000);
      } else {
        if (kkeutmalStatus) kkeutmalStatus.textContent = '카메라에 사람이 감지되지 않았습니다.';
      }
    }
  }
  checkPlayers();
}

function startUserInputPhase() {
  if (!gameActive) return;
  if (playerCount === 0) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = '카메라에 사람이 감지될 때까지 대기 중...';
    setTimeout(startUserInputPhase, 1000);
    return;
  }
  let message;
  if (currentTurn === 0 && wordHistory.length === 0) {
    message = `게임 시작! ${playerCount}명의 플레이어가 차례로 단어를 말하세요.`;
  } else {
    message = `플레이어 ${((currentTurn % playerCount) + 1)} 차례입니다. 마이크에 대고 단어를 말하세요.`;
  }
  if (kkeutmalStatus) kkeutmalStatus.textContent = message;
  updateWordHistoryUI();
  promptPlayerWord(currentTurn % playerCount);
}

function nextTurn() {
  if (!gameActive) return;
  if (playerCount === 0) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = '카메라에 사람이 감지될 때까지 대기 중...';
    setTimeout(nextTurn, 2000);
    return;
  }
  if ((currentTurn % (playerCount + 1)) < playerCount) {
    // Player's turn
    startUserInputPhase();
  } else {
    // Computer's turn
    computerTurn();
  }
}

// --- OpenAI Whisper Speech Recognition Setup with M Key Push-to-Talk ---
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let stream = null;
let speechCallback = null;
let speechPrompt = '';

// M key push-to-talk functionality
document.addEventListener('keydown', async (event) => {
  // Only trigger on M key and if not already recording
  if (event.code === 'KeyM' && !isRecording && speechCallback) {
    event.preventDefault();
    await startSpeechRecording();
  }
});

document.addEventListener('keyup', async (event) => {
  // Only trigger on M key release and if currently recording
  if (event.code === 'KeyM' && isRecording) {
    event.preventDefault();
    await stopSpeechRecording();
  }
});

async function startSpeechRecording() {
  try {
    isRecording = true;
    audioChunks = [];
    if (kkeutmalStatus) kkeutmalStatus.textContent = '🎙️ 녹음 중... (M키를 놓으면 인식 시작)';
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
    if (kkeutmalStatus) kkeutmalStatus.textContent = '녹음 시작 오류: ' + err.message;
    isRecording = false;
  }
}

async function stopSpeechRecording() {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;
  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      try {
        if (kkeutmalStatus) kkeutmalStatus.textContent = '음성 인식 중...';
        // Convert recorded audio to buffer
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = window.electron.bufferFrom(new Uint8Array(arrayBuffer));
        const text = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
        if (kkeutmalStatus) kkeutmalStatus.textContent = '';
        // Call the speech callback with the recognized text
        if (speechCallback) {
          speechCallback(text.trim());
          speechCallback = null;
        }
      } catch (err) {
        console.error('Speech recognition error:', err);
        if (kkeutmalStatus) kkeutmalStatus.textContent = '음성 인식 오류: ' + err.message;
        setTimeout(() => { if (kkeutmalStatus) kkeutmalStatus.textContent = ''; }, 2000);
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

let lastSpeechTime = null;
let speechTimeout = null;

function promptPlayerWord(playerIdx) {
  if (speechTimeout) clearTimeout(speechTimeout);
  // Set up the speech callback
  speechCallback = (transcript) => {
    lastSpeechTime = Date.now();
    // Show the recognized word to the user
    if (wordHistoryDiv) {
      wordHistoryDiv.innerHTML = `<b>입력된 단어:</b> ${transcript}`;
    }
    validateAndProceed(transcript, playerIdx);
  };
  if (kkeutmalStatus) kkeutmalStatus.textContent = 'M키를 누르고 말하세요...';
  updateWordHistoryUI();
  // No timeout while waiting for M key release (push-to-talk)
  // If you want a max waiting time for the player to start speaking, you can add a separate timer here if needed.
}

// Remove showLoading and hideLoading functions
// ...existing code...

function validateAndProceed(word, playerIdx) {
  // Clean up the input - remove extra spaces and get first word only
  word = word.trim();
  // Show the recognized word in the UI
  if (wordHistoryDiv) {
    wordHistoryDiv.innerHTML = `<b>입력된 단어:</b> ${word}`;
  }
  // Check if input contains multiple words
  const words = word.split(/\s+/);
  if (words.length > 1) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = `한 단어만 말해주세요! 플레이어 ${playerIdx+1} 다시 시도하세요.`;
    setTimeout(() => startUserInputPhase(), 1000);
    return;
  }
  word = words[0]; // Use the first (and only) word
  // Check if word is too short
  if (word.length < 2) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = `너무 짧은 단어입니다. 플레이어 ${playerIdx+1} 다시 시도하세요.`;
    setTimeout(() => startUserInputPhase(), 1000);
    return;
  }
  // 1. Check if word is repeated
  if (wordHistory.includes(word)) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = `이미 사용된 단어입니다. 플레이어 ${playerIdx+1} 탈락!`;
    gameActive = false;
    updateWordHistoryUI();
    return;
  }
  // 2. Check if word matches last character (if not first turn)
  if (lastWord && !isValidKkeutmal(lastWord, word)) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = `끝말잇기 규칙 위반! 플레이어 ${playerIdx+1} 탈락!`;
    gameActive = false;
    updateWordHistoryUI();
    return;
  }
  // 3. Check if word exists in Korean (API)
  checkKoreanWord(word).then(isValid => {
    if (!isValid) {
      if (kkeutmalStatus) kkeutmalStatus.textContent = `존재하지 않는 단어입니다. 플레이어 ${playerIdx+1} 탈락!`;
      gameActive = false;
      updateWordHistoryUI();
      return;
    }
    // All checks passed
    wordHistory.push(word);
    lastWord = word;
    updateWordHistoryUI();
    currentTurn++;
    nextTurn();
  });
}
// --- Update Word History UI ---
function updateWordHistoryUI() {
  if (!wordHistoryDiv) return;
  let html = '<b>단어 목록:</b> ';
  if (wordHistory.length === 0) {
    html += '아직 단어가 없습니다.';
  } else {
    html += wordHistory.map((w, i) => `${i % (playerCount+1) === playerCount ? '🤖' : '👤'} ${w}`).join(' → ');
  }
  wordHistoryDiv.innerHTML = html;
}

function isValidKkeutmal(prev, curr) {
  // 끝말잇기: 반드시 이전 단어의 마지막 "글자"(음절)와 새 단어의 첫 "글자"(음절)가 같아야 함
  // 즉, 일기장 -> 장난 (O), 일기장 -> 갸름 (X)
  const lastSyllable = prev[prev.length - 1];
  const firstSyllable = curr[0];
  return lastSyllable === firstSyllable;
}

function checkKoreanWord(word) {
  // Use Wiktionary API to check if word exists
  const url = `https://ko.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&format=json&origin=*`;
  return fetch(url)
    .then(res => res.json())
    .then(data => {
      const pages = data.query.pages;
      return Object.keys(pages)[0] !== '-1';
    })
    .catch(() => false);
}

// --- TTS Helper (Google Korean Voice preferred) ---
let koreanVoice = null;
function loadKoreanVoice() {
  const voices = speechSynthesis.getVoices();
  koreanVoice = voices.find(v => v.lang === 'ko-KR' && v.name.includes('Google'));
  if (!koreanVoice) {
    koreanVoice = voices.find(v => v.lang === 'ko-KR');
  }
}
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadKoreanVoice;
  if (speechSynthesis.getVoices().length > 0) {
    loadKoreanVoice();
  }
}
function speakAiResponse(text) {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  if (koreanVoice) utterance.voice = koreanVoice;
  speechSynthesis.speak(utterance);
}

function computerTurn() {
  // Find a valid word that starts with lastWord's last char and hasn't been used
  getValidKoreanWord(lastWord[lastWord.length-1], wordHistory).then(word => {
    if (!word) {
      if (kkeutmalStatus) kkeutmalStatus.textContent = '컴퓨터가 더 이상 단어를 찾지 못해 플레이어 승리!';
      speakAiResponse('컴퓨터가 더 이상 단어를 찾지 못해 플레이어 승리!');
      gameActive = false;
      return;
    }
    wordHistory.push(word);
    lastWord = word;
    updateWordHistoryUI();
    if (kkeutmalStatus) kkeutmalStatus.textContent = `컴퓨터: ${word}`;
    speakAiResponse(word);
    currentTurn = 0;
    setTimeout(nextTurn, 1200);
  });
}

function getValidKoreanWord(startChar, usedWords) {
  // 끝말잇기는 반드시 마지막 "글자"(음절)로 시작해야 함. 두음법칙 등 무시.
  const startSyllable = startChar;
  const url = `https://ko.wiktionary.org/w/api.php?action=query&list=allpages&apnamespace=0&aplimit=20&apprefix=${encodeURIComponent(startSyllable)}&format=json&origin=*`;
  return fetch(url)
    .then(res => res.json())
    .then(data => {
      const pages = data.query.allpages || [];
      const candidates = pages
        .map(p => p.title)
        .filter(w => {
          // Only single words (no spaces), length > 1, not used, starts with correct char
          return w.length > 1 &&
                 !w.includes(' ') &&
                 !w.includes(':') &&
                 !usedWords.includes(w) &&
                 w[0] === startSyllable &&
                 /^[가-힣]+$/.test(w);
        });
      if (candidates.length === 0) return null;
      return candidates[Math.floor(Math.random() * candidates.length)];
    })
    .catch(() => null);
}

function getPossibleStartChars(lastChar) {
  // 더 이상 두음법칙 등 변형 없이 마지막 글자만 반환
  return [lastChar];
}

// To start the game, call startKkeutmalGame();
