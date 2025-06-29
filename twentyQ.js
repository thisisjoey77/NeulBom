// twentyQ.js - 스무고개 (20 Questions) Game
// Uses secure API helper to protect API keys
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
  // Voice recognition setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
  }

  // Remove the text input and button if present
  const questionForm = document.getElementById('questionForm');
  questionForm.innerHTML = '';

  // Add the voice input button
  const voiceBtn = document.createElement('button');
  voiceBtn.type = 'button';
  voiceBtn.textContent = '🎤 음성으로 질문';
  voiceBtn.style.margin = '12px 0 0 0';
  voiceBtn.style.fontSize = '1.1em';
  questionForm.appendChild(voiceBtn);

  // Add transcript display
  const transcriptDisplay = document.createElement('div');
  transcriptDisplay.id = 'voiceInputDisplay';
  transcriptDisplay.style = 'font-size:1.1em;color:#1976d2;margin:12px 0 0 0;min-height:28px;';
  questionForm.appendChild(transcriptDisplay);

  voiceBtn.onclick = function() {
    if (!recognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }
    voiceBtn.disabled = true;
    voiceBtn.textContent = '듣는 중...';
    recognition.start();
  };

  if (recognition) {
    recognition.onresult = async function(event) {
      const transcript = event.results[0][0].transcript;
      transcriptDisplay.textContent = '입력: ' + transcript;
      voiceBtn.textContent = '🎤 음성으로 질문';
      voiceBtn.disabled = false;
      if (gameOver) return;
      
      // First, send to AI without incrementing question count
      messages.push({ role: 'user', content: transcript });
      document.getElementById('aiAnswer').textContent = 'AI가 생각 중...';
      
      try {
        const data = await callOpenAI(messages);
        let reply = data.choices[0].message.content.trim();
        document.getElementById('aiAnswer').textContent = reply;
        messages.push({ role: 'assistant', content: reply });
      } catch (error) {
        console.error('Error:', error);
        document.getElementById('aiAnswer').textContent = '오류가 발생했습니다. 다시 시도해주세요.';
        return;
      }
      
      // Check if it's an invalid question (AI reminds about yes/no rule)
      if (reply.includes('예 또는 아니오로 대답할 수 있는 질문만') || 
          reply.includes('다시 질문해줘') ||
          reply.includes('스무고개는')) {
        // Don't increment question count for invalid questions
        // Remove the last user message and AI response from messages array
        messages.pop(); // Remove AI response
        messages.pop(); // Remove user question
        return; // Don't check for win/lose, just let them try again
      }
      
      // Only increment question count for valid yes/no questions
      questionCount++;
      document.getElementById('currentQuestion').textContent = questionCount;
      
      // Check for win/lose
      if (reply.includes('정답이야') || reply.includes('축하해')) {
        document.getElementById('finalResult').textContent = '🎉 정답! 게임을 다시 시작하려면 아래 버튼을 눌러줘.';
        endGame();
      } else if (questionCount >= maxQuestions) {
        // Try to extract the answer from the AI's reply
        let match = reply.match(/정답은 ([^ ]+)였어/);
        let answer = match ? match[1] : '알 수 없음';
        document.getElementById('finalResult').textContent = `😢 20번이 지났어. 정답은 "${answer}"였어!`;
        endGame();
      }
    };
    recognition.onerror = function() {
      voiceBtn.textContent = '🎤 음성으로 질문';
      voiceBtn.disabled = false;
      alert('음성 인식에 실패했습니다. 다시 시도해주세요.');
    };
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
    transcriptDisplay.textContent = '';
    document.getElementById('restartBtn').style.display = 'none';
    voiceBtn.disabled = false;
    voiceBtn.textContent = '🎤 음성으로 질문';
  };
};

function endGame() {
  gameOver = true;
  document.getElementById('restartBtn').style.display = 'inline-block';
  document.getElementById('userQuestion').disabled = true;
  document.querySelector('#questionForm button').disabled = true;
}
