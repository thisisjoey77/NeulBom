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
  // 두음법칙을 고려한 끝말잇기 검증
  const lastChar = prev[prev.length-1];
  const firstChar = curr[0];
  
  // 1. 직접 연결되는 경우
  if (lastChar === firstChar) {
    return true;
  }
  
  // 2. 두음법칙 적용 - ㄹ이 ㅇ이나 없어지는 경우
  if (lastChar === '리' || lastChar === '름' || lastChar === '력' || lastChar === '록' || 
      lastChar === '론' || lastChar === '래' || lastChar === '로' || lastChar === '루' ||
      lastChar === '르' || lastChar === '를' || lastChar === '린' || lastChar === '렬') {
    // ㄹ로 끝나는 단어 뒤에 이, 예, 여, 요, 야, 얘 등으로 시작하는 단어
    if (firstChar === '이' || firstChar === '예' || firstChar === '여' || 
        firstChar === '요' || firstChar === '야' || firstChar === '얘' ||
        firstChar === '영' || firstChar === '엽' || firstChar === '염' ||
        firstChar === '연' || firstChar === '열' || firstChar === '입' ||
        firstChar === '일' || firstChar === '인' || firstChar === '임') {
      return true;
    }
  }
  
  // 3. ㄴ이 두음법칙으로 변하는 경우
  if (lastChar === '니' || lastChar === '는' || lastChar === '늘' || lastChar === '남' ||
      lastChar === '날' || lastChar === '난' || lastChar === '널' || lastChar === '논') {
    // ㄴ으로 끝나는 단어 뒤에 이, 여 등으로 시작하는 단어
    if (firstChar === '이' || firstChar === '여' || firstChar === '연' || 
        firstChar === '열' || firstChar === '영' || firstChar === '염') {
      return true;
    }
  }
  
  // 4. 받침 ㄱ, ㅋ, ㄲ의 경우
  const lastCharCode = lastChar.charCodeAt(0);
  const syllableIndex = lastCharCode - 0xAC00;
  const finalConsonant = syllableIndex % 28;
  
  // 받침이 ㄱ(1), ㅋ(21), ㄲ(2)인 경우
  if (finalConsonant === 1 || finalConsonant === 21 || finalConsonant === 2) {
    const expectedInitial = String.fromCharCode(0xAC00 + (7 * 588)); // '가'
    if (firstChar === '가' || firstChar === '고' || firstChar === '구' || 
        firstChar === '그' || firstChar === '기' || firstChar === '개' ||
        firstChar === '게' || firstChar === '갸' || firstChar === '겨' ||
        firstChar === '교' || firstChar === '규' || firstChar === '긔') {
      return true;
    }
  }
  
  // 5. 받침 ㄷ, ㅌ, ㅅ, ㅆ, ㅈ, ㅊ, ㅎ의 경우 -> ㄷ 음
  if (finalConsonant === 7 || finalConsonant === 16 || finalConsonant === 19 || 
      finalConsonant === 20 || finalConsonant === 17 || finalConsonant === 18 || 
      finalConsonant === 27) {
    if (firstChar === '다' || firstChar === '도' || firstChar === '두' || 
        firstChar === '드' || firstChar === '디' || firstChar === '대' ||
        firstChar === '데' || firstChar === '댜' || firstChar === '더' ||
        firstChar === '덕' || firstChar === '던' || firstChar === '들') {
      return true;
    }
  }
  
  // 6. 받침 ㅂ, ㅍ의 경우 -> ㅂ 음
  if (finalConsonant === 8 || finalConsonant === 17) {
    if (firstChar === '바' || firstChar === '보' || firstChar === '부' || 
        firstChar === '브' || firstChar === '비' || firstChar === '배' ||
        firstChar === '베' || firstChar === '뱌' || firstChar === '버' ||
        firstChar === '별' || firstChar === '병' || firstChar === '본') {
      return true;
    }
  }
  
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
    const url = `https://ko.wiktionary.org/w/api.php?action=query&list=allpages&apnamespace=0&aplimit=20&apprefix=${encodeURIComponent(char)}&format=json&origin=*`;
    return fetch(url)
      .then(res => res.json())
      .then(data => {
        const pages = data.query.allpages || [];
        return pages
          .map(p => p.title)
          .filter(w => {
            // Only single words (no spaces), length > 1, not used, starts with correct char
            return w.length > 1 && 
                   !w.includes(' ') && 
                   !w.includes(':') && 
                   !usedWords.includes(w) && 
                   w[0] === char &&
                   /^[가-힣]+$/.test(w); // Only Korean characters
          });
      })
      .catch(() => []);
  });
  
  return Promise.all(promises)
    .then(results => {
      // 모든 결과를 합치기
      const allCandidates = results.flat();
      if (allCandidates.length === 0) return null;
      // 랜덤 선택
      return allCandidates[Math.floor(Math.random() * allCandidates.length)];
    })
    .catch(() => null);
}

function getPossibleStartChars(lastChar) {
  const chars = [lastChar]; // 기본적으로 마지막 글자와 같은 글자
  
  // 두음법칙 적용 가능한 경우들 추가
  
  // ㄹ로 끝나는 경우
  if (lastChar === '리' || lastChar === '름' || lastChar === '력' || lastChar === '록' || 
      lastChar === '론' || lastChar === '래' || lastChar === '로' || lastChar === '루' ||
      lastChar === '르' || lastChar === '를' || lastChar === '린' || lastChar === '렬') {
    chars.push('이', '예', '여', '요', '야', '얘', '영', '엽', '염', '연', '열', '입', '일', '인', '임');
  }
  
  // ㄴ으로 끝나는 경우
  if (lastChar === '니' || lastChar === '는' || lastChar === '늘' || lastChar === '남' ||
      lastChar === '날' || lastChar === '난' || lastChar === '널' || lastChar === '논') {
    chars.push('이', '여', '연', '열', '영', '염');
  }
  
  // 받침에 따른 처리
  const lastCharCode = lastChar.charCodeAt(0);
  if (lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3) {
    const syllableIndex = lastCharCode - 0xAC00;
    const finalConsonant = syllableIndex % 28;
    
    // 받침이 ㄱ, ㅋ, ㄲ인 경우
    if (finalConsonant === 1 || finalConsonant === 21 || finalConsonant === 2) {
      chars.push('가', '고', '구', '그', '기', '개', '게', '갸', '겨', '교', '규', '긔');
    }
    
    // 받침이 ㄷ, ㅌ, ㅅ, ㅆ, ㅈ, ㅊ, ㅎ인 경우
    if (finalConsonant === 7 || finalConsonant === 16 || finalConsonant === 19 || 
        finalConsonant === 20 || finalConsonant === 17 || finalConsonant === 18 || 
        finalConsonant === 27) {
      chars.push('다', '도', '두', '드', '디', '대', '데', '댜', '더', '덕', '던', '들');
    }
    
    // 받침이 ㅂ, ㅍ인 경우
    if (finalConsonant === 8 || finalConsonant === 17) {
      chars.push('바', '보', '부', '브', '비', '배', '베', '뱌', '버', '별', '병', '본');
    }
  }
  
  // 중복 제거하고 반환
  return [...new Set(chars)];
}

// To start the game, call startKkeutmalGame();
