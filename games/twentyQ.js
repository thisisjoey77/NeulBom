// twentyQ.js - 스무고개 (20 Questions) Game

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

let questionCount = 0;
let maxQuestions = 20;
let gameOver = false;
let aiWord = "";
let messages = [
  {
    role: "system",
    content: "너는 스무고개 게임의 AI 마스터야. 반드시 초등학생(특히 3~6학년)이 잘 알고 쉽게 맞힐 수 있는 명사(사물, 동물, 음식, 캐릭터 등)만 생각해. 너무 어렵거나 생소한 단어, 어른만 아는 단어, 외래어나 전문용어는 절대 고르지 마. 사용자가 예/아니오로 대답할 수 있는 질문을 하면 친절하게 '예' 또는 '아니오'로만 대답해. 만약 사용자가 예/아니오로 대답할 수 없는 질문(예: '이게 뭐야?', '색깔이 뭐야?', '크기가 어떻게 돼?')을 하면, '스무고개는 예 또는 아니오로 대답할 수 있는 질문만 할 수 있어! 다시 질문해줘.'라고 말해줘. 이런 경우 질문 횟수는 세지 않아. 20번 이내에 사용자가 정답을 맞히면 '정답이야! 축하해!'라고 하고, 20번이 지나면 '아쉽지만 정답은 [단어]였어!'라고 알려줘. 정답을 맞히기 전까지는 단어를 절대 직접 말하지 마. 모든 대화는 반말로 해줘."
  }
];

window.onload = function() {
  // OpenAI Whisper Speech Recognition Setup with M Key Push-to-Talk
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let stream = null;
  let speechCallback = null;

  // Add transcript display to show mic status and instructions
  const transcriptDisplay = document.createElement('div');
  transcriptDisplay.id = 'voiceInputDisplay';
  transcriptDisplay.style = 'font-size:1.2em;color:#2196F3;margin:16px 0;padding:12px;background:#f5f5f5;border-radius:8px;min-height:40px;font-weight:bold;text-align:center;';
  transcriptDisplay.innerHTML = '🎤 <strong>M 키를 누르고 있는 동안 질문하세요</strong><br><small>M 키를 놓으면 음성 인식이 시작됩니다</small>';
  
  // Add to the container after questionCount
  const questionCountElement = document.getElementById('questionCount');
  questionCountElement.parentNode.insertBefore(transcriptDisplay, questionCountElement.nextSibling);

  // M key push-to-talk functionality
  document.addEventListener('keydown', async (event) => {
    if (event.code === 'KeyM' && !isRecording && speechCallback && !gameOver) {
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
      
      transcriptDisplay.innerHTML = '🎙️ <strong>녹음 중...</strong><br><small>M키를 놓으면 인식 시작</small>';
      transcriptDisplay.style.color = '#f44336';
      
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
      transcriptDisplay.innerHTML = '❌ <strong>녹음 오류</strong><br><small>' + err.message + '</small>';
      transcriptDisplay.style.color = '#f44336';
      isRecording = false;
    }
  }

  async function stopSpeechRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    isRecording = false;
    
    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        try {
          transcriptDisplay.innerHTML = '🔄 <strong>음성 인식 중...</strong><br><small>잠시만 기다려주세요</small>';
          transcriptDisplay.style.color = '#ff9800';
          
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const buffer = window.electron.bufferFrom(new Uint8Array(arrayBuffer));
          
          const text = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
          
          transcriptDisplay.innerHTML = '🎤 <strong>M 키를 누르고 있는 동안 질문하세요</strong><br><small>M 키를 놓으면 음성 인식이 시작됩니다</small>';
          transcriptDisplay.style.color = '#2196F3';
          
          if (speechCallback && text.trim()) {
            speechCallback(text.trim());
          }
          
        } catch (err) {
          console.error('Speech recognition error:', err);
          transcriptDisplay.innerHTML = '❌ <strong>음성 인식 오류</strong><br><small>' + err.message + '</small>';
          transcriptDisplay.style.color = '#f44336';
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

  // Set up speech callback for questions
  function setupSpeechInput() {
    if (gameOver) return;
    
    speechCallback = (transcript) => {
      transcriptDisplay.innerHTML = `💬 <strong>질문:</strong> ${transcript}<br><small>AI가 답변을 준비하고 있습니다...</small>`;
      transcriptDisplay.style.color = '#4CAF50';
      processQuestion(transcript);
    };
  }

  // Initialize speech input
  setupSpeechInput();

  async function processQuestion(transcript) {
    if (gameOver) return;
    
    // Add user question to messages
    messages.push({ role: 'user', content: transcript });
    document.getElementById('aiAnswer').textContent = 'AI가 생각 중...';
    
    try {
      // Get API key via IPC
      const apiKey = await window.electron.ipcRenderer.invoke('get-openai-key');
      if (!apiKey) {
        throw new Error('OpenAI API key not available');
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: messages
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      let reply = data.choices[0].message.content.trim();
      
      // Remove emojis
      const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
      reply = reply.replace(emojiRegex, '');
      
      messages.push({ role: 'assistant', content: reply });
      document.getElementById('aiAnswer').textContent = reply;
      
      // Increment question count
      questionCount++;
      document.getElementById('currentQuestion').textContent = questionCount;
      
      // Check for game end conditions
      if (questionCount >= 20) {
        document.getElementById('finalResult').textContent = '20개 질문이 모두 끝났습니다!';
        endGame();
      } else {
        // Reset for next question
        setupSpeechInput();
      }
      
    } catch (err) {
      console.error('Error processing question:', err);
      document.getElementById('aiAnswer').textContent = '오류가 발생했습니다: ' + err.message;
      transcriptDisplay.innerHTML = '❌ <strong>오류 발생</strong><br><small>다시 시도해주세요</small>';
      transcriptDisplay.style.color = '#f44336';
      // Reset for retry
      setupSpeechInput();
    }
  }

  // Restart button functionality
  document.getElementById('restartBtn').onclick = function() {
    questionCount = 0;
    gameOver = false;
    messages = [messages[0]]; // Keep only the system message
    document.getElementById('currentQuestion').textContent = questionCount;
    document.getElementById('aiAnswer').textContent = '';
    document.getElementById('finalResult').textContent = '';
    transcriptDisplay.innerHTML = '🎤 <strong>M 키를 누르고 있는 동안 질문하세요</strong><br><small>M 키를 놓으면 음성 인식이 시작됩니다</small>';
    transcriptDisplay.style.color = '#2196F3';
    document.getElementById('restartBtn').style.display = 'none';
    setupSpeechInput();
  };

  function endGame() {
    gameOver = true;
    speechCallback = null; // Disable speech input
    transcriptDisplay.innerHTML = '🎯 <strong>게임 종료</strong><br><small>다시 시작하려면 아래 버튼을 클릭하세요</small>';
    transcriptDisplay.style.color = '#9c27b0';
    document.getElementById('restartBtn').style.display = 'inline-block';
  }
};
