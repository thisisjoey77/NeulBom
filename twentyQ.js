// twentyQ.js - 스무고개 (20 Questions) Game

// You should move OpenAI API calls to the backend for security in production!
const OPENAI_API_KEY = window.OPENAI_API_KEY;
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
      
      voiceBtn.textContent = '🎙️ 녹음 중... (M키를 놓으면 인식 시작)';
      voiceBtn.disabled = true;
      
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
      voiceBtn.textContent = '녹음 오류';
      voiceBtn.disabled = false;
      isRecording = false;
    }
  }

  async function stopSpeechRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    isRecording = false;
    
    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        try {
          voiceBtn.textContent = '음성 인식 중...';
          
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const buffer = window.electron.bufferFrom(new Uint8Array(arrayBuffer));
          
          const text = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
          
          voiceBtn.textContent = '🎤 M키를 눌러서 질문';
          voiceBtn.disabled = false;
          
          if (speechCallback) {
            speechCallback(text.trim());
            speechCallback = null;
          }
          
        } catch (err) {
          console.error('Speech recognition error:', err);
          voiceBtn.textContent = '🎤 M키를 눌러서 질문';
          voiceBtn.disabled = false;
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

  // Remove the text input and button if present
  const questionForm = document.getElementById('questionForm');
  questionForm.innerHTML = '';

  // Add the voice input button
  const voiceBtn = document.createElement('button');
  voiceBtn.type = 'button';
  voiceBtn.textContent = '🎤 M키를 눌러서 질문';
  voiceBtn.style.margin = '12px 0 0 0';
  voiceBtn.style.fontSize = '1.1em';
  voiceBtn.disabled = true; // Initially disabled until user presses M
  questionForm.appendChild(voiceBtn);

  // Add transcript display
  const transcriptDisplay = document.createElement('div');
  transcriptDisplay.id = 'voiceInputDisplay';
  transcriptDisplay.style = 'font-size:1.1em;color:#1976d2;margin:12px 0 0 0;min-height:28px;';
  transcriptDisplay.textContent = 'M 키를 누르고 있는 동안 질문하세요';
  questionForm.appendChild(transcriptDisplay);

  // Set up speech callback for questions
  function setupSpeechInput() {
    speechCallback = (transcript) => {
      transcriptDisplay.textContent = `질문: ${transcript}`;
      processQuestion(transcript);
    };
  }

  // Initialize speech input
  setupSpeechInput();

  async function processQuestion(transcript) {
    transcriptDisplay.textContent = '입력: ' + transcript;
    
    if (gameOver) return;
    
    // First, send to AI without incrementing question count
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
        document.getElementById('finalResult').textContent = '20개 질문이 모두 끝났습니다! 정답을 맞혀보세요!';
        endGame();
      }
      
      // Reset for next question
      setupSpeechInput();
      
    } catch (err) {
      console.error('Error processing question:', err);
      document.getElementById('aiAnswer').textContent = '오류가 발생했습니다: ' + err.message;
    }
  }

  document.getElementById('questionForm').onsubmit = function(e) {
    e.preventDefault();
    // Disable text input submission
    return false;
  };
  
  document.getElementById('restartBtn').onclick = function() {
    questionCount = 0;
    gameOver = false;
    messages = [messages[0]];
    document.getElementById('currentQuestion').textContent = questionCount;
    document.getElementById('aiAnswer').textContent = '';
    document.getElementById('finalResult').textContent = '';
    transcriptDisplay.textContent = 'M 키를 누르고 있는 동안 질문하세요';
    document.getElementById('restartBtn').style.display = 'none';
    setupSpeechInput();
  };
};

function endGame() {
  gameOver = true;
  speechCallback = null; // Disable speech input
  document.getElementById('restartBtn').style.display = 'inline-block';
}
