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

function startVoiceInput() {
  if (hardMode && !hideObstacles) {
    hideObstacles = true;
    drawBoard();
  }
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('이 브라우저는 음성 인식을 지원하지 않습니다. 크롬을 사용해 주세요.');
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript.trim();
    document.getElementById('cmdInput').value = transcript;
    transcriptLog.push(transcript);
    speakCount++;
    updateRecordDisplay();
    document.getElementById('cmdForm').requestSubmit();
  };
  recognition.onerror = function(event) {
    alert('음성 인식 오류: ' + event.error);
  };
  recognition.start();
}

window.onload = function() {
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

  // 음성 입력 버튼 추가
  const voiceBtn = document.createElement('button');
  voiceBtn.textContent = '🎤 음성 입력';
  voiceBtn.style.margin = '10px 0 0 10px';
  voiceBtn.style.background = '#1976d2';
  voiceBtn.style.color = '#fff';
  voiceBtn.style.borderRadius = '8px';
  voiceBtn.style.padding = '7px 18px';
  voiceBtn.style.fontWeight = 'bold';
  voiceBtn.onclick = function() {
    startVoiceInput();
  };
  document.querySelector('.twentyq-container, .game-container')?.appendChild(voiceBtn);

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
