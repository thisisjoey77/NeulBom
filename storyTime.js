// storyTime.js - Voice-based Story Time Activity with OpenAI API
const OPENAI_API_KEY = window.OPENAI_API_KEY;

const storyMessages = [
  { role: "system", content: "너는 초등학생을 위한 창의적인 이야기 선생님이야. 사용자가 이어서 쓸 수 있도록 재미있고 짧은 이야기의 첫 문단을 만들어줘. 사용자가 이어서 쓴 문장을 받으면, 그 다음 문단을 이어서 써줘. 모든 대화는 한국어로 진행해. 중요한 규칙들: 1) 모든 문장은 존댓말로 써줘 (예: ~했어요, ~됩니다, ~세요 등). 2) 등장인물들에게는 구체적인 이름을 지어줘 (예: 민수, 지혜, 할머니, 강아지 뽀미 등). 절대 '사용자'라고 부르지 마. 3) 이야기는 항상 따뜻하고 교육적이며 상상력이 풍부하게 만들어줘." }
];

// OpenAI Whisper Speech Recognition Setup with M Key Push-to-Talk
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

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

// Function for AI speech
function speakAiResponse(text) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis API not supported.");
    return;
  }

  // If a speech is already in progress, stop it
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';

  // Use the globally set Korean voice
  if (koreanVoice) {
    utterance.voice = koreanVoice;
  } else {
    console.warn("Korean voice not yet loaded for speech. Speaking with default voice.");
    loadKoreanVoice();
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }
  }

  speechSynthesis.speak(utterance);
}

let isListening = false;

window.onload = function() {
  setupSpeechRecognition();
  
  const startBtn = document.getElementById('startStoryBtn');
  const storyDisplay = document.getElementById('storyDisplay');
  const continueBtn = document.getElementById('continueBtn');
  const aiStoryDisplay = document.getElementById('aiStoryDisplay');
  const statusDisplay = document.getElementById('statusDisplay');

  // Hide continue button initially
  if (continueBtn) continueBtn.style.display = 'none';

  startBtn.onclick = async function() {
    startBtn.disabled = true;
    storyDisplay.textContent = 'AI가 이야기를 만드는 중...';
    aiStoryDisplay.textContent = '';
    if (statusDisplay) statusDisplay.textContent = '';
    storyMessages.length = 1; // Reset to system prompt only
    
    try {
      // AI에게 첫 문단 요청
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: storyMessages
        })
      });
      const data = await response.json();
      const firstParagraph = data.choices[0].message.content.trim();
      storyDisplay.textContent = firstParagraph;
      
      // Speak the first paragraph
      speakAiResponse(firstParagraph);
      
      storyMessages.push({role:'assistant', content: firstParagraph});
      
      // Show continue button and enable voice input
      if (continueBtn) {
        continueBtn.style.display = 'block';
        continueBtn.disabled = false;
      }
      
      if (statusDisplay) statusDisplay.textContent = '계속하기 버튼을 눌러 음성으로 이야기를 이어가세요!';
      
    } catch (error) {
      console.error('Error:', error);
      storyDisplay.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
      startBtn.disabled = false;
    }
  };

  // Voice input handling
  if (continueBtn) {
    continueBtn.onclick = function() {
      if (!isListening) {
        startListening();
      }
    };
  }

  function setupSpeechRecognition() {
    // Show speech instructions
    const instructionsDiv = document.createElement('div');
    instructionsDiv.innerHTML = `
      <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin: 15px 0; font-size: 0.95em; color: #1976d2;">
        <strong>음성 입력:</strong> M 키를 누르고 있는 동안 말하세요. 키를 떼면 음성이 인식됩니다.
      </div>
    `;
    const container = document.querySelector('.twentyq-container, .game-container');
    if (container) {
      container.insertBefore(instructionsDiv, container.children[1]);
    }

    // M key push-to-talk functionality
    document.addEventListener('keydown', function(event) {
      if (event.key === 'm' || event.key === 'M') {
        if (!isRecording && !isListening) {
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
    if (isRecording) return;
    
    try {
      isRecording = true;
      isListening = true;
      audioChunks = [];
      
      if (continueBtn) continueBtn.disabled = true;
      updateSpeechStatus('🎤 Recording... (Release M key to stop)', '#ff5722');
      
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
      isListening = false;
      if (continueBtn) continueBtn.disabled = false;
      updateSpeechStatus('Error: Could not access microphone', '#f44336');
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    
    isRecording = false;
    mediaRecorder.stop();
    updateSpeechStatus('🔄 Processing speech...', '#2196f3');
  }

  async function processAudio(audioBlob) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = window.electron.bufferFrom(arrayBuffer);
      
      const transcript = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
      
      if (transcript && transcript.trim()) {
        updateSpeechStatus(`들은 내용: "${transcript.trim()}"`, '#4caf50');
        
        // Display user input in text
        const userInputDisplay = document.getElementById('userInputDisplay');
        if (userInputDisplay) {
          userInputDisplay.textContent = `학생: ${transcript.trim()}`;
          userInputDisplay.style.display = 'block';
        }
        
        await handleUserVoiceInput(transcript.trim());
      } else {
        updateSpeechStatus('❌ No speech detected', '#ff9800');
      }
    } catch (err) {
      console.error('Speech recognition error:', err);
      updateSpeechStatus('❌ Speech recognition failed', '#f44336');
    } finally {
      isListening = false;
      if (continueBtn) continueBtn.disabled = false;
    }
  }

  function updateSpeechStatus(message, color) {
    const statusDisplay = document.getElementById('statusDisplay');
    if (statusDisplay) {
      statusDisplay.textContent = message;
      statusDisplay.style.color = color;
      
      // Clear status after delay for success/error messages
      if (message.includes('✅') || message.includes('❌')) {
        setTimeout(() => {
          statusDisplay.textContent = '';
        }, 3000);
      }
    }
  }

  function startListening() {
    // This function is now just for backwards compatibility
    // The actual recording is handled by M key press
    updateSpeechStatus('음성 입력을 사용하려면 M 키를 눌러서 말하세요. 키를 떼면 인식이 시작됩니다.', '#2196f3');
  }

  async function handleUserVoiceInput(userText) {
    if (!userText.trim()) return;
    
    if (statusDisplay) statusDisplay.textContent = 'AI가 이어서 쓰는 중...';
    aiStoryDisplay.textContent = '';
    
    storyMessages.push({role:'user', content: userText});
    
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: storyMessages
        })
      });
      const data = await response.json();
      const aiParagraph = data.choices[0].message.content.trim();
      aiStoryDisplay.textContent = aiParagraph;
      
      // Speak the AI response
      speakAiResponse(aiParagraph);
      
      storyMessages.push({role:'assistant', content: aiParagraph});
      
      if (statusDisplay) statusDisplay.textContent = '계속하기 버튼을 눌러 음성으로 이야기를 이어가세요!';
      
    } catch (error) {
      console.error('Error:', error);
      aiStoryDisplay.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
      if (statusDisplay) statusDisplay.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
    }
  }
};
