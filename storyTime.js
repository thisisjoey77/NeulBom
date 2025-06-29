// storyTime.js - Voice-based Story Time Activity with OpenAI API
// Uses secure API helper to protect API keys

const storyMessages = [
  { role: "system", content: "너는 초등학생을 위한 창의적인 이야기 선생님이야. 사용자가 이어서 쓸 수 있도록 재미있고 짧은 이야기의 첫 문단을 만들어줘. 사용자가 이어서 쓴 문장을 받으면, 그 다음 문단을 이어서 써줘. 모든 대화는 한국어로 진행해. 중요한 규칙들: 1) 모든 문장은 존댓말로 써줘 (예: ~했어요, ~됩니다, ~세요 등). 2) 등장인물들에게는 구체적인 이름을 지어줘 (예: 민수, 지혜, 할머니, 강아지 뽀미 등). 절대 '사용자'라고 부르지 마. 3) 이야기는 항상 따뜻하고 교육적이며 상상력이 풍부하게 만들어줘." }
];

// Speech Recognition setup
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ko-KR';
recognition.interimResults = false;
recognition.continuous = false;

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
      const data = await callOpenAI(storyMessages);
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

  function startListening() {
    if (isListening) return;
    
    isListening = true;
    if (continueBtn) continueBtn.disabled = true;
    if (statusDisplay) statusDisplay.textContent = '음성을 듣고 있습니다... 말씀해 주세요!';
    
    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      if (statusDisplay) statusDisplay.textContent = `들은 내용: "${transcript}"`;
      
      // Display user input in text
      const userInputDisplay = document.getElementById('userInputDisplay');
      if (userInputDisplay) {
        userInputDisplay.textContent = `학생: ${transcript}`;
        userInputDisplay.style.display = 'block';
      }
      
      handleUserVoiceInput(transcript);
    };
    
    recognition.onerror = function(event) {
      console.error('Speech recognition error:', event.error);
      if (statusDisplay) statusDisplay.textContent = '음성 인식 오류가 발생했습니다. 다시 시도해주세요.';
      isListening = false;
      if (continueBtn) continueBtn.disabled = false;
    };
    
    recognition.onend = function() {
      isListening = false;
      if (continueBtn) continueBtn.disabled = false;
    };
    
    recognition.start();
  }

  async function handleUserVoiceInput(userText) {
    if (!userText.trim()) return;
    
    if (statusDisplay) statusDisplay.textContent = 'AI가 이어서 쓰는 중...';
    aiStoryDisplay.textContent = '';
    
    storyMessages.push({role:'user', content: userText});
    
    try {
      const data = await callOpenAI(storyMessages);
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
