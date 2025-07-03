// --- 끝말잇기 Game Logic ---
let wordHistory = [];
let playerCount = 0;
let currentTurn = 0; // 0 ~ (playerCount-1) for players, playerCount for computer
let lastWord = '';
let gameActive = false;
let timeoutHandle = null;
const TURN_TIMEOUT = 3000; // 3 seconds per turn

function pollPeopleCount() {
  fetch('http://localhost:5000/people_count')
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

// --- Speech Recognition Setup ---
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ko-KR';
recognition.interimResults = false;
recognition.continuous = false;
let lastSpeechTime = null;
let speechTimeout = null;

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

function promptPlayerWord(playerIdx) {
  if (speechTimeout) clearTimeout(speechTimeout);
  let transcript = '';
  let inputReceived = false;
  showLoading('플레이어 입력 대기 중...');
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal && !inputReceived) {
        transcript += event.results[i][0].transcript;
        lastSpeechTime = Date.now();
        inputReceived = true;
        hideLoading();
        showLoading('음성 인식 중...');
        recognition.stop(); // Stop immediately on first input
        setTimeout(() => {
          hideLoading();
          validateAndProceed(transcript.trim(), playerIdx);
        }, 500); // Short delay for UX
        return;
      }
    }
  };
  recognition.onend = () => {
    if (!inputReceived) {
      hideLoading();
      alert(`플레이어 ${playerIdx+1}가 입력하지 않아 탈락!`);
      gameActive = false;
    }
  };
  recognition.onerror = (e) => {
    hideLoading();
    if (e.error === 'no-speech') {
      if (kkeutmalStatus) kkeutmalStatus.textContent = '음성이 감지되지 않았습니다. 다시 시도 중...';
      recognition.start();
      return;
    }
    alert('음성 인식 오류: ' + e.error);
    gameActive = false;
  };
  lastSpeechTime = Date.now();
  recognition.start();
  // Set a timeout to force end after 5 seconds
  speechTimeout = setTimeout(() => {
    if (!inputReceived) {
      hideLoading();
      recognition.stop();
    }
  }, 5000);
}

function updateWordHistoryUI() {
  const wordHistoryDiv = document.getElementById('wordHistory');
  if (wordHistoryDiv) {
    wordHistoryDiv.textContent = '지금까지 나온 단어: ' + (wordHistory.length ? wordHistory.join(', ') : '없음');
  }
}

function validateAndProceed(word, playerIdx) {
  // Clean up the input - remove extra spaces and get first word only
  word = word.trim();
  
  // Check if input contains multiple words
  const words = word.split(/\s+/);
  if (words.length > 1) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = `한 단어만 말해주세요! 플레이어 ${playerIdx+1} 다시 시도하세요.`;
    // Don't end game, just restart this player's turn
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
    return;
  }
  // 2. Check if word matches last character (if not first turn)
  if (lastWord && !isValidKkeutmal(lastWord, word)) {
    if (kkeutmalStatus) kkeutmalStatus.textContent = `끝말잇기 규칙 위반! 플레이어 ${playerIdx+1} 탈락!`;
    gameActive = false;
    return;
  }
  // 3. Check if word exists in Korean (API)
  checkKoreanWord(word).then(isValid => {
    if (!isValid) {
      if (kkeutmalStatus) kkeutmalStatus.textContent = `존재하지 않는 단어입니다. 플레이어 ${playerIdx+1} 탈락!`;
      gameActive = false;
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

function isValidKkeutmal(prev, curr) {
  // 끝말잇기 검증: 다음 단어는 이전 단어의 마지막 글자로 시작해야 함
  const lastChar = prev[prev.length-1];
  const firstChar = curr[0];
  
  // 기본 규칙: 마지막 글자와 첫 글자가 정확히 일치해야 함
  if (lastChar === firstChar) {
    return true;
  }
  
  // 끝말잇기에서는 두음법칙을 적용하지 않음
  // 예: "물" -> "물고기" (O), "물" -> "일기" (X)
  // 예: "기술" -> "술집" (O), "기술" -> "입사" (X)
  
  return false;
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
  // 두음법칙을 고려해서 가능한 시작 글자들을 모두 찾기
  const possibleStartChars = getPossibleStartChars(startChar);

  // 모든 가능한 시작 글자에 대해 단어 검색
  const promises = possibleStartChars.map(char => {
    const url = `https://ko.wiktionary.org/w/api.php?action=query&list=allpages&apnamespace=0&aplimit=50&apprefix=${encodeURIComponent(char)}&format=json&origin=*`;
    return fetch(url)
      .then(res => res.json())
      .then(data => {
        const pages = data.query.allpages || [];
        return pages
          .map(p => p.title)
          .filter(w => {
            // Only single words (no spaces), length > 1, not used, first char is in possibleStartChars, and second char is NOT in possibleStartChars
            return w.length > 1 &&
                   !w.includes(' ') &&
                   !w.includes(':') &&
                   !usedWords.includes(w) &&
                   possibleStartChars.includes(w[0]) &&
                   // Prevent multi-syllable prefix matches (e.g., '고가교' for '고')
                   (w.length < 2 || !possibleStartChars.includes(w[1])) &&
                   /^[가-힣]+$/.test(w);
          });
      })
      .catch(() => []);
  });

  return Promise.all(promises)
    .then(results => {
      // 모든 결과를 합치기
      const allCandidates = results.flat();
      // 추가: 끝말잇기 규칙(두음법칙 포함)으로 필터링
      const validCandidates = allCandidates.filter(candidate => {
        // lastWord가 비어있으면(첫 턴) 무조건 허용
        if (!lastWord) return true;
        // 반드시 첫 글자가 두음법칙을 고려한 올바른 글자인지 확인
        const prev = lastWord;
        const curr = candidate;
        return isValidKkeutmal(prev, curr);
      });
      if (validCandidates.length === 0) return null;
      // 랜덤 선택
      return validCandidates[Math.floor(Math.random() * validCandidates.length)];
    })
    .catch(() => null);
}

function getPossibleStartChars(lastChar) {
  // 끝말잇기에서는 마지막 글자와 정확히 같은 글자로만 시작해야 함
  return [lastChar];
}

// To start the game, call startKkeutmalGame();
