// fruitList.js
// List of all fruits (starter data)
const fruits = [
  { en: "Apple", ko: "사과" },
  { en: "Banana", ko: "바나나" },
  { en: "Orange", ko: "오렌지" },
  { en: "Grape", ko: "포도" },
  { en: "Strawberry", ko: "딸기" },
  { en: "Watermelon", ko: "수박" },
  { en: "Pineapple", ko: "파인애플" },
  { en: "Mango", ko: "망고" },
  { en: "Peach", ko: "복숭아" },
  { en: "Cherry", ko: "체리" },
  { en: "Blueberry", ko: "블루베리" },
  { en: "Raspberry", ko: "라즈베리" },
  { en: "Blackberry", ko: "블랙베리" },
  { en: "Pear", ko: "배" },
  { en: "Plum", ko: "자두" },
  { en: "Kiwi", ko: "키위" },
  { en: "Lemon", ko: "레몬" },
  { en: "Lime", ko: "라임" },
  { en: "Grapefruit", ko: "자몽" },
  { en: "Cantaloupe", ko: "칸탈루프 멜론" },
  { en: "Apricot", ko: "살구" },
  { en: "Fig", ko: "무화과" },
  { en: "Pomegranate", ko: "석류" },
  { en: "Guava", ko: "구아바" },
  { en: "Papaya", ko: "파파야" },
  { en: "Coconut", ko: "코코넛" },
  { en: "Avocado", ko: "아보카도" },
  { en: "Passionfruit", ko: "패션프루트" },
  { en: "Lychee", ko: "리치" },
  { en: "Persimmon", ko: "감" },
  { en: "Tangerine", ko: "귤" },
  { en: "Cranberry", ko: "크랜베리" },
  { en: "Date", ko: "대추야자" },
  { en: "Jackfruit", ko: "잭프루트" },
  { en: "Dragonfruit", ko: "용과" },
  { en: "Starfruit", ko: "스타프루트" },
  { en: "Durian", ko: "두리안" },
  { en: "Mulberry", ko: "오디" },
  { en: "Gooseberry", ko: "구스베리" },
  { en: "Quince", ko: "마르멜로" }
];

window.onload = async function() {
  const ul = document.getElementById('fruit-list');

  // Try to fetch fruit names from Wikidata SPARQL endpoint
  try {
    const endpoint = 'https://query.wikidata.org/sparql';
    const query = `SELECT ?fruit ?enLabel ?koLabel WHERE {\n  ?fruit wdt:P31 wd:Q3314483.\n  SERVICE wikibase:label { bd:serviceParam wikibase:language \"en,ko\". }\n}`;
    const url = endpoint + '?query=' + encodeURIComponent(query) + '&format=json';
    const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
    const data = await response.json();
    const results = data.results.bindings;
    if (results.length > 0) {
      results.forEach(item => {
        const ko = item.koLabel ? item.koLabel.value : '';
        if (ko) {
          const li = document.createElement('li');
          li.textContent = ko;
          ul.appendChild(li);
        }
      });
      return;
    }
  } catch (e) {
    // If fetch fails, fallback to local list
    console.warn('API fetch failed, using local list.', e);
  }

  // Fallback: use local fruits array (Korean only)
  fruits.forEach(fruit => {
    const li = document.createElement('li');
    li.textContent = fruit.ko;
    ul.appendChild(li);
  });
};

// --- 1v1 Fruit Naming Game ---
// Add UI for the game
window.addEventListener('DOMContentLoaded', () => {
  // Game container
  const gameDiv = document.createElement('div');
  gameDiv.id = 'fruit-game';
  gameDiv.className = 'game-container'; // Use CSS class for styling
  gameDiv.innerHTML = `
    <h2 class="game-title">1v1 과일 이름 대결 (사람 vs 컴퓨터)</h2>
    <div class="game-row">
      <span id="user-input" class="user-input">M 키를 눌러 과일 이름을 말하세요</span>
    </div>
    <div id="ai-answer" class="ai-answer"></div>
    <div id="game-status" class="game-status"></div>
    <div id="used-fruits" class="used-fruits"></div>
  `;
  document.body.appendChild(gameDiv);

  // Game state
  const fruitSet = new Set(fruits.map(f => f.ko)); // Use Korean names only
  const usedFruits = new Set();
  let gameOver = false;

  // OpenAI Whisper Speech Recognition Setup with M Key Push-to-Talk
  let isRecording = false;
  let mediaRecorder;
  let audioChunks = [];

  function setupSpeechRecognition() {
    // Remove redundant speech instructions (not needed for fruit game)
    
    // M key push-to-talk functionality
    document.addEventListener('keydown', function(event) {
      if (event.key === 'm' || event.key === 'M') {
        if (!isRecording && !gameOver) {
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
    if (isRecording || gameOver) return;
    
    try {
      isRecording = true;
      audioChunks = [];
      
      document.getElementById('user-input').textContent = '🎤 Recording... (Release M key to stop)';
      
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
      document.getElementById('user-input').textContent = 'Error: Could not access microphone';
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    isRecording = false;
    mediaRecorder.stop();
    document.getElementById('user-input').textContent = '🔄 Processing speech...';
  }

  async function processAudio(audioBlob) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = window.electron.bufferFrom(arrayBuffer);
      
      const transcript = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
      
      if (transcript && transcript.trim()) {
        document.getElementById('user-input').textContent = transcript.trim();
        handleUserInput(transcript.trim());
      } else {
        document.getElementById('user-input').textContent = '❌ No speech detected';
      }
    } catch (err) {
      console.error('Speech recognition error:', err);
      document.getElementById('user-input').textContent = '❌ Speech recognition failed';
    }
  }

  function handleUserInput(transcript) {
    if (gameOver) return;
    
    const fruitName = transcript;
    if (!fruitSet.has(fruitName)) {
      endGame('"' + transcript + '"는 과일 목록에 없습니다. 당신이 패배했습니다.');
      return;
    }
    if (usedFruits.has(fruitName)) {
      endGame('이미 사용된 과일입니다. 당신이 패배했습니다.');
      return;
    }
    usedFruits.add(fruitName);
    updateUsedFruits();
    setTimeout(aiTurn, 1000);
  }

  function updateUsedFruits() {
    document.getElementById('used-fruits').textContent =
      '사용된 과일: ' + Array.from(usedFruits).join(', ');
  }

  function endGame(msg) {
    document.getElementById('game-status').textContent = msg;
    gameOver = true;
  }

  function aiTurn() {
    // AI picks a random unused fruit (Korean)
    const available = Array.from(fruitSet).filter(fruit => !usedFruits.has(fruit));
    if (available.length === 0) {
      endGame('AI가 더 이상 생각나는 과일이 없습니다. 당신이 승리했습니다!');
      return;
    }
    const aiFruit = available[Math.floor(Math.random() * available.length)];
    usedFruits.add(aiFruit);
    document.getElementById('ai-answer').textContent = 'AI: ' + aiFruit;
    updateUsedFruits();
  }

  // Setup speech recognition
  setupSpeechRecognition();
});

