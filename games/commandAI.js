// commandAI.js - 코알라 명령어 이동 게임 (p5.js)
let gridSize = 5;
let cellSize = 80;
let koalaImg;
let koalaX = 0, koalaY = 4; // bottom left
let koalaDir = 0; // 0: right, 1: down, 2: left, 3: up (clockwise)
let flagX = gridSize-1, flagY = 0; // top right
let gameOver = false;
let obstacles = [];
let koalaPath = [];
const OBSTACLE_EMOJIS = ['🌳', '🪨'];
const OBSTACLE_COUNT = 4; // number of obstacles per round
let hardMode = false;
let hideObstacles = false;
let speakCount = 0;
let bestRecord = localStorage.getItem('koalaBestRecord') ? parseInt(localStorage.getItem('koalaBestRecord')) : null;
let transcriptLog = [];

function preload() {
  koalaImg = loadImage('coalanew.png');
}

function setup() {
  let canvas = createCanvas(cellSize * gridSize, cellSize * gridSize);
  canvas.parent('p5-holder');
  randomObstacles();
  drawBoard();
}

function draw() {
  // Only draw on demand
}

function randomObstacles() {
  obstacles = [];
  let used = new Set();
  // Don't block start or goal
  used.add('0,' + (gridSize-1));
  used.add((gridSize-1) + ',0');
  // 장애물 개수: (gridSize-2) * 2 (최소 2개, 최대 16개)
  let obsCount = Math.max(2, Math.min((gridSize-2)*2, (gridSize*gridSize)-2));
  for (let i=0; i<1000 && obstacles.length < obsCount; i++) {
    let x = Math.floor(Math.random() * gridSize);
    let y = Math.floor(Math.random() * gridSize);
    let key = x + ',' + y;
    if (!used.has(key)) {
      obstacles.push({x, y, emoji: OBSTACLE_EMOJIS[Math.floor(Math.random()*OBSTACLE_EMOJIS.length)]});
      used.add(key);
    }
  }
}

function isObstacle(x, y) {
  return obstacles.some(o => o.x === x && o.y === y);
}

function drawBoard() {
  clear();
  // Fix: always use solid background
  background(245);
  stroke(180);
  for (let i = 0; i <= gridSize; i++) {
    line(i * cellSize, 0, i * cellSize, gridSize * cellSize);
    line(0, i * cellSize, gridSize * cellSize, i * cellSize);
  }
  // Draw path
  let pathColor = (gameOver && koalaX === flagX && koalaY === flagY) ? 'rgba(56,200,80,0.55)' : 'rgba(255,0,0,0.38)';
  for (let p of koalaPath) {
    fill(pathColor);
    noStroke();
    rect(p.x * cellSize, p.y * cellSize, cellSize, cellSize, 8);
  }
  // Draw obstacles (hide if hardMode and hideObstacles)
  if (!(hardMode && hideObstacles)) {
    textSize(38);
    textAlign(CENTER, CENTER);
    for (let o of obstacles) {
      text(o.emoji, o.x * cellSize + cellSize/2, o.y * cellSize + cellSize/2);
    }
  }
  // Draw flag
  textSize(48);
  textAlign(CENTER, CENTER);
  text('🏁', (gridSize-1) * cellSize + cellSize/2, cellSize/2);
  // Draw koala
  if (koalaImg) {
    push();
    translate(koalaX * cellSize + cellSize/2, koalaY * cellSize + cellSize/2);
    rotate(HALF_PI * koalaDir);
    imageMode(CENTER);
    image(koalaImg, 0, 0, cellSize * 0.8, cellSize * 0.8);
    // Draw direction arrow
    fill('#1976d2');
    noStroke();
    triangle(cellSize*0.18,0, cellSize*0.08,-cellSize*0.12, cellSize*0.08,cellSize*0.12);
    pop();
  }
}

function updateRecordDisplay() {
  let rec = `시도 횟수: <b>${speakCount}</b>`;
  if (bestRecord) rec += ` / 최고기록: <b style='color:#43a047;'>${bestRecord}</b>`;
  if (transcriptLog.length > 0) rec += `<br>마지막 음성: <span style='color:#1976d2;'>${transcriptLog[transcriptLog.length-1]}</span>`;
  document.getElementById('recordDiv').innerHTML = rec;
}

function resetGame() {
  koalaX = 0; koalaY = gridSize-1; koalaDir = 0; gameOver = false;
  koalaPath = [{x: koalaX, y: koalaY}];
  randomObstacles();
  hideObstacles = false;
  speakCount = 0;
  window._koala_last_input_id = 0;
  transcriptLog = [];
  updateRecordDisplay();
  document.getElementById('cmdResult').textContent = '';
  document.getElementById('restartBtn').style.display = 'none';
  drawBoard();
}

// OpenAI Whisper Speech Recognition Setup with M Key Push-to-Talk
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

function startVoiceInput() {
  if (hardMode && !hideObstacles) {
    hideObstacles = true;
    drawBoard();
  }
  alert('음성 입력을 사용하려면 M 키를 눌러서 말하세요. 키를 떼면 인식이 시작됩니다.');
}

function setupSpeechRecognition() {
  // Show speech instructions on page load
  const instructionsDiv = document.createElement('div');
  instructionsDiv.innerHTML = `
    <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 0.95em; color: #1976d2;">
      <strong>음성 입력:</strong> M 키를 누르고 있는 동안 말하세요. 키를 떼면 음성이 인식됩니다.
    </div>
  `;
  document.querySelector('.twentyq-container').insertBefore(instructionsDiv, document.getElementById('p5-holder'));

  let isKeyPressed = false;

  // M key push-to-talk functionality with improved event handling
  document.addEventListener('keydown', function(event) {
    // Check for M key (both lowercase and uppercase)
    if ((event.key === 'm' || event.key === 'M' || event.code === 'KeyM') && !isKeyPressed) {
      event.preventDefault();
      isKeyPressed = true;
      if (!isRecording) {
        console.log('CommandAI: Starting recording on M key press');
        startRecording();
      }
    }
  });

  document.addEventListener('keyup', function(event) {
    // Check for M key (both lowercase and uppercase)
    if ((event.key === 'm' || event.key === 'M' || event.code === 'KeyM') && isKeyPressed) {
      event.preventDefault();
      isKeyPressed = false;
      if (isRecording) {
        console.log('CommandAI: Stopping recording on M key release');
        stopRecording();
      }
    }
  });

  // Handle window focus/blur to reset key state
  window.addEventListener('blur', function() {
    if (isRecording && isKeyPressed) {
      console.log('CommandAI: Window lost focus, stopping recording');
      isKeyPressed = false;
      stopRecording();
    }
  });
}

async function startRecording() {
  if (isRecording) {
    console.log('CommandAI: Already recording, ignoring start request');
    return;
  }
  
  try {
    console.log('CommandAI: Starting recording...');
    isRecording = true;
    audioChunks = [];
    
    // Request microphone access with enhanced settings
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        sampleSize: 16,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Initialize MediaRecorder with appropriate format
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }
    }
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000
    });
    
    mediaRecorder.ondataavailable = function(event) {
      console.log('CommandAI: Audio data available, size:', event.data.size);
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async function() {
      console.log('CommandAI: MediaRecorder stopped, processing audio...');
      if (audioChunks.length > 0) {
        await processAudio();
      } else {
        console.warn('CommandAI: No audio chunks to process');
        updateSpeechStatus('❌ No audio recorded', '#ff9800');
      }
      
      // Stop all tracks to release microphone
      stream.getTracks().forEach(track => {
        console.log('CommandAI: Stopping track:', track.kind);
        track.stop();
      });
    };
    
    mediaRecorder.onerror = function(event) {
      console.error('CommandAI: MediaRecorder error:', event.error);
      isRecording = false;
      updateSpeechStatus('❌ Recording error: ' + event.error.message, '#f44336');
    };
    
    mediaRecorder.start();
    console.log('CommandAI: MediaRecorder started');
    updateSpeechStatus('🎤 Recording... (Release M key to stop)', '#ff5722');
    
  } catch (err) {
    console.error('CommandAI: Error starting recording:', err);
    isRecording = false;
    
    let errorMessage = 'Could not access microphone';
    if (err.name === 'NotAllowedError') {
      errorMessage = 'Microphone permission denied. Please allow microphone access.';
    } else if (err.name === 'NotFoundError') {
      errorMessage = 'No microphone found. Please connect a microphone.';
    } else {
      errorMessage = err.message || errorMessage;
    }
    
    updateSpeechStatus('❌ Error: ' + errorMessage, '#f44336');
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) {
    console.log('CommandAI: Not recording or no recorder, ignoring stop request');
    return;
  }
  
  console.log('CommandAI: Stopping recording...');
  isRecording = false;
  updateSpeechStatus('🔄 Processing speech...', '#2196f3');
  
  try {
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      console.warn('CommandAI: MediaRecorder not in recording state:', mediaRecorder.state);
    }
  } catch (err) {
    console.error('CommandAI: Error stopping recording:', err);
    updateSpeechStatus('❌ Error stopping recording', '#f44336');
  }
}

async function processAudio() {
  try {
    console.log('CommandAI: Processing audio, chunks:', audioChunks.length);
    
    if (audioChunks.length === 0) {
      console.error('CommandAI: No audio data to process');
      updateSpeechStatus('❌ No audio recorded', '#ff9800');
      return;
    }
    
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    console.log('CommandAI: Audio blob created, size:', audioBlob.size);
    
    if (audioBlob.size < 1000) {
      console.warn('CommandAI: Audio blob too small, likely no speech');
      updateSpeechStatus('⚠️ Audio too short, please speak longer', '#ff9800');
      return;
    }

    // Try Electron IPC first, fallback to OpenAI API
    // Convert audio blob to array buffer for Electron IPC
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = new Uint8Array(arrayBuffer);
    
    // Use Electron IPC to send audio to backend for transcription
    if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
      try {
        const transcript = await window.electron.ipcRenderer.invoke('recognize-audio', audioBuffer);
        
        if (transcript && transcript.trim()) {
          document.getElementById('cmdInput').value = transcript.trim();
          transcriptLog.push(transcript.trim());
          speakCount++;
          updateRecordDisplay();
          updateSpeechStatus('✅ Speech recognized successfully', '#4caf50');
          
          // Auto-submit the form
          setTimeout(() => {
            const form = document.getElementById('cmdForm');
            if (form) {
              const event = new Event('submit', { bubbles: true, cancelable: true });
              form.dispatchEvent(event);
            }
          }, 500);
          return; // Success, exit early
        } else {
          updateSpeechStatus('❌ No speech detected', '#ff9800');
          return;
        }
      } catch (ipcError) {
        console.warn('Electron IPC failed, trying fallback:', ipcError);
      }
    }
    
    // Fallback: try direct API call to OpenAI
    console.warn('Using OpenAI API fallback method');
      
      // Convert blob to base64 for HTTP request
      const base64Audio = await blobToBase64(audioBlob);    // Try to get OpenAI API key
    let apiKey = null;
    try {
      apiKey = await window.electron.ipcRenderer.invoke('get-openai-key');
    } catch (err) {
      console.error('Could not get API key:', err);
      updateSpeechStatus('❌ API key not available', '#f44336');
      return;
    }
    
    if (!apiKey) {
      updateSpeechStatus('❌ OpenAI API key not configured', '#f44336');
      return;
    }
    
    // Make direct API call to OpenAI Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const transcript = data.text;
    
    if (transcript && transcript.trim()) {
      document.getElementById('cmdInput').value = transcript.trim();
      transcriptLog.push(transcript.trim());
      speakCount++;
      updateRecordDisplay();
      updateSpeechStatus('✅ Speech recognized successfully', '#4caf50');
      
      // Auto-submit the form
      setTimeout(() => {
        const form = document.getElementById('cmdForm');
        if (form) {
          const event = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(event);
        }
      }, 500);
    } else {
      updateSpeechStatus('❌ No speech detected', '#ff9800');
    }
  } catch (err) {
    console.error('Speech recognition error:', err);
    updateSpeechStatus('❌ Speech recognition failed: ' + err.message, '#f44336');
  }
}

// Helper function to convert blob to base64
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

function updateSpeechStatus(message, color) {
  let statusDiv = document.getElementById('speechStatus');
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'speechStatus';
    statusDiv.style.cssText = 'margin: 10px 0; padding: 8px; border-radius: 4px; font-size: 0.9em; text-align: center; transition: all 0.3s ease;';
    const cmdForm = document.getElementById('cmdForm');
    cmdForm.parentNode.insertBefore(statusDiv, cmdForm.nextSibling);
  }
  
  statusDiv.textContent = message;
  statusDiv.style.color = color;
  statusDiv.style.backgroundColor = color + '20';
  statusDiv.style.border = `1px solid ${color}40`;
  
  // Clear status after delay for success/error messages
  if (message.includes('✅') || message.includes('❌')) {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.style.backgroundColor = 'transparent';
      statusDiv.style.border = 'none';
    }, 3000);
  }
}

window.onload = function() {
  // Setup speech recognition
  setupSpeechRecognition();
  
  // 하드모드 버튼 추가
  const hardBtn = document.createElement('button');
  hardBtn.textContent = '하드모드';
  hardBtn.style.margin = '10px 0 0 0';
  hardBtn.style.background = '#d32f2f';
  hardBtn.style.color = '#fff';
  hardBtn.style.borderRadius = '8px';
  hardBtn.style.padding = '7px 18px';
  hardBtn.style.fontWeight = 'bold';
  hardBtn.onclick = function() {
    hardMode = !hardMode;
    hideObstacles = false;
    hardBtn.textContent = hardMode ? '하드모드 ON' : '하드모드';
    resetGame();
  };
  document.querySelector('.twentyq-container, .game-container')?.appendChild(hardBtn);

  // 음성 입력 버튼을 제거하고 설명 텍스트로 교체
  const voiceInstructions = document.createElement('div');
  voiceInstructions.innerHTML = '<div style="margin: 10px 0; padding: 8px; background: #e3f2fd; border-radius: 4px; color: #1976d2; font-size: 0.9em; text-align: center;">M 키를 눌러 명령어를 말하세요</div>';
  document.querySelector('.twentyq-container, .game-container')?.appendChild(voiceInstructions);

  // 기록 표시
  const recordDiv = document.createElement('div');
  recordDiv.id = 'recordDiv';
  recordDiv.style.margin = '10px 0 0 0';
  recordDiv.style.fontSize = '1.08em';
  document.querySelector('.twentyq-container, .game-container')?.appendChild(recordDiv);
  updateRecordDisplay();

  // 보드 크기 선택 UI 추가
  const sizeDiv = document.createElement('div');
  sizeDiv.style.margin = '10px 0 0 0';
  sizeDiv.style.fontSize = '1.08em';
  sizeDiv.innerHTML = '보드 크기: <select id="boardSizeSelect"></select>';
  document.querySelector('.twentyq-container, .game-container')?.prepend(sizeDiv);
  const sizeSel = document.getElementById('boardSizeSelect');
  for (let s = 3; s <= 10; s++) {
    let opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s + ' x ' + s;
    if (s === gridSize) opt.selected = true;
    sizeSel.appendChild(opt);
  }
  sizeSel.onchange = function() {
    gridSize = parseInt(this.value);
    cellSize = Math.max(40, 400 / gridSize); // 자동 cell 크기 조정
    resetGame();
    resizeCanvas(cellSize * gridSize, cellSize * gridSize);
    drawBoard();
  };

  document.getElementById('cmdResult').textContent = '';
  document.getElementById('cmdForm').onsubmit = function(e) {
    e.preventDefault();
    if (gameOver) return;
    if (hardMode) hideObstacles = true;
    let input = document.getElementById('cmdInput').value.trim();
    if (input) transcriptLog.push(input);
    // speakCount는 음성 입력/엔터 1회당 1 증가 (moveInputs 개수와 무관)
    if (!window._koala_last_input_id) window._koala_last_input_id = 0;
    window._koala_last_input_id++;
    speakCount = window._koala_last_input_id;
    updateRecordDisplay();
    // '다음'으로 명령 분리
    let moveInputs = input.split(/\s*다음\s*/g).map(s => s.trim()).filter(Boolean);
    let log = [];
    for (let move of moveInputs) {
      let tokens = move.split(/\s+/);
      let i = 0;
      while (i < tokens.length) {
        let cmd = tokens[i];
        let count = 1;
        let matched = false;
        let numMap = { '한번':1, '두번':2, '세번':3, '네번':4, '다섯번':5, '여섯번':6, '일곱번':7, '여덟번':8, '아홉번':9, '열번':10 };
        // 앞으로/돌아 명령어 위치 유연하게 파싱
        // (띄어쓰기, 붙여쓰기, 숫자/한글 모두 허용)
        // ex: '앞으로세번가', '앞으로 세번가', '앞으로 세 번 가', '앞으로 3번가', '앞으로 3 번 가' 등
        // 1. 붙여쓴 토큰을 분리
        let merged = cmd + (tokens[i+1]||'') + (tokens[i+2]||'') + (tokens[i+3]||'');
        let match = merged.match(/^(앞으로|앞으로가|앞으로가기|앞으로_가|앞으로-가|앞으로가요|앞으로 가)?\s*(\d+|한|두|세|네|다섯|여섯|일곱|여섯|일곱|여덟|아홉|열)?\s*번?\s*(가|가기)?$/);
        if (match && match[1]) {
          // 숫자/한글 변환
          let numMap2 = { '한':1, '두':2, '세':3, '네':4, '다섯':5, '여섯':6, '일곱':7, '여덟':8, '아홉':9, '열':10 };
          if (match[2]) count = /^[0-9]+$/.test(match[2]) ? parseInt(match[2]) : numMap2[match[2]] || 1;
          i += Math.max(1, (tokens[i+1]?1:0)+(tokens[i+2]?1:0)+(tokens[i+3]?1:0));
          matched = true;
        } 
        // 붙여쓰기/띄어쓰기 모두 허용: '회전세번', '회전 세 번', '회전3번', '회전 3 번', '회전 세번', ...
        let mergedTurn = cmd + (tokens[i+1]||'') + (tokens[i+2]||'') + (tokens[i+3]||'');
        let matchTurn = mergedTurn.match(/^(회전)\s*(\d+|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)?\s*번?$/);
        if (matchTurn && matchTurn[1]) {
          let numMap2 = { '한':1, '두':2, '세':3, '네':4, '다섯':5, '여섯':6, '일곱':7, '여덟':8, '아홉':9, '열':10 };
          if (matchTurn[2]) count = /^[0-9]+$/.test(matchTurn[2]) ? parseInt(matchTurn[2]) : numMap2[matchTurn[2]] || 1;
          i += Math.max(1, (tokens[i+1]?1:0)+(tokens[i+2]?1:0)+(tokens[i+3]?1:0));
          matched = true;
        } else if (
          cmd.startsWith('앞으로') || cmd === '앞으로' || cmd === '앞으로가' || cmd === '앞으로_가' || cmd === '앞으로-가' || cmd === '앞으로가요' || cmd === '앞으로가기' || cmd === '앞으로 가'
        ) {
          // ...existing code...
        } else if (cmd === '회전' || cmd.startsWith('회전')) {
          let next1 = tokens[i+1] || '';
          let next2 = tokens[i+2] || '';
          // 회전 N번
          if ((/^[0-9]+번$/.test(next1) || numMap[next1]) && (next2 === '가' || next2 === '하기' || next2 === '')) {
            count = /^[0-9]+번$/.test(next1) ? parseInt(next1) : numMap[next1];
            i += (next2 === '가' || next2 === '하기') ? 3 : 2;
            matched = true;
          }
          // 회전 가 N번
          else if ((next1 === '가' || next1 === '하기') && ( /^[0-9]+번$/.test(next2) || numMap[next2])) {
            count = /^[0-9]+번$/.test(next2) ? parseInt(next2) : numMap[next2];
            i += 3;
            matched = true;
          }
          // 회전 N번
          else if (/^[0-9]+번$/.test(next1) || numMap[next1]) {
            count = /^[0-9]+번$/.test(next1) ? parseInt(next1) : numMap[next1];
            i += 2;
            matched = true;
          }
          // 회전 가
          else if (next1 === '가' || next1 === '하기') {
            i += 2;
            matched = true;
          }
          // 회전
          else {
            i++;
            matched = true;
          }
        }
        if (!matched) {
          log.push('알 수 없는 명령어: ' + cmd);
          i++;
          continue;
        }
        // 명령 실행
        if (cmd.startsWith('앞으로')) {
          // 미리 이동 경로 체크 (장애물 포함)
          let valid = true;
          let tx = koalaX, ty = koalaY;
          let pathPreview = [{x: tx, y: ty}];
          for (let j=0;j<count;j++) {
            let nx = tx, ny = ty;
            if (koalaDir === 0) nx++;
            else if (koalaDir === 1) ny++;
            else if (koalaDir === 2) nx--;
            else if (koalaDir === 3) ny--;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !isObstacle(nx, ny)) {
              tx = nx; ty = ny;
              pathPreview.push({x: tx, y: ty});
            } else {
              valid = false;
              break;
            }
          }
          if (!valid) {
            log.push('이동 명령이 격자를 벗어나거나 장애물을 통과할 수 없어 실행할 수 없어요!');
          } else {
            for (let j=0;j<count;j++) {
              if (koalaDir === 0) koalaX++;
              else if (koalaDir === 1) koalaY++;
              else if (koalaDir === 2) koalaX--;
              else if (koalaDir === 3) koalaY--;
              koalaPath.push({x: koalaX, y: koalaY});
              log.push('앞으로 이동!');
            }
          }
        } else if (cmd === '회전' || cmd.startsWith('회전')) {
          for (let j=0;j<count;j++) {
            koalaDir = (koalaDir + 1) % 4;
            log.push('코알라가 회전해요!');
          }
        }
      }
    }
    drawBoard();
    document.getElementById('cmdInput').value = '';
    if (koalaX === flagX && koalaY === flagY) {
      document.getElementById('cmdResult').textContent = '축하해! 코알라가 목적지에 도착했어!';
      gameOver = true;
      if (!bestRecord || speakCount < bestRecord) {
        bestRecord = speakCount;
        localStorage.setItem('koalaBestRecord', bestRecord);
      }
      updateRecordDisplay();
      document.getElementById('restartBtn').style.display = 'inline-block';
    } else {
      document.getElementById('cmdResult').textContent = log.join(' ');
    }
  };
  document.getElementById('restartBtn').onclick = function() {
    resetGame();
    document.getElementById('cmdInput').value = '';
  };
};
