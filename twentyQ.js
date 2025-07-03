// twentyQ.js - 스무고개 (20 Questions) Game
// Uses secure API helper to protect API keys
let questionCount = 0;
let maxQuestions = 20;
let gameOver = false;
let aiWord = "";
let messages = [
  {
    role: "system",
    content: "너는 스무고개 게임의 AI 마스터야. 게임이 시작되면 반드시 초등학생(특히 3~6학년)이 잘 알고 쉽게 맞힐 수 있는 명사(사물, 동물, 음식, 캐릭터 등) 중에서 랜덤으로 하나를 선택해서 마음속으로 정해. 예를 들어: 사자, 코끼리, 고양이, 강아지, 토끼, 사과, 바나나, 딸기, 자동차, 비행기, 컴퓨터, 피아노, 축구공, 연필, 책, 피카츄, 도라에몽 등. 절대 돼지만 선택하지 말고 다양한 단어 중에서 무작위로 선택해. 너무 어렵거나 생소한 단어, 어른만 아는 단어, 외래어나 전문용어는 절대 고르지 마. 사용자가 예/아니오로 대답할 수 있는 질문을 하면 친절하게 '예' 또는 '아니오'로만 대답해. 만약 사용자가 예/아니오로 대답할 수 없는 질문(예: '이게 뭐야?', '색깔이 뭐야?', '크기가 어떻게 돼?')을 하면, '스무고개는 예 또는 아니오로 대답할 수 있는 질문만 할 수 있어! 다시 질문해줘.'라고 말해줘. 이런 경우 질문 횟수는 세지 않아. 20번 이내에 사용자가 정답을 맞히면 '정답이야! 축하해!'라고 하고, 20번이 지나면 '아쉽지만 정답은 [단어]였어!'라고 알려줘. 정답을 맞히기 전까지는 단어를 절대 직접 말하지 마. 모든 대화는 반말로 해줘."
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

  // Start the first game automatically
  messages.push({
    role: "user",
    content: "새로운 스무고개 게임을 시작하자! 새로운 단어를 하나 골라줘. 내가 질문할 준비가 됐어."
  });
  
  callOpenAI(messages, function(reply) {
    document.getElementById('aiAnswer').textContent = reply;
  });

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
        // Debug: log AI reply
        console.log('AI reply:', reply);
      } catch (error) {
        console.error('Error:', error);
        document.getElementById('aiAnswer').textContent = '오류가 발생했습니다. 다시 시도해주세요.';
        return;
      }
      
      // Check if it's an invalid question (AI reminds about yes/no rule)
      // Stricter invalid question check: only match exact phrases at start
      const invalidPhrases = [
        '스무고개는 예 또는 아니오로 대답할 수 있는 질문만 할 수 있어! 다시 질문해줘.',
        '예 또는 아니오로 대답할 수 있는 질문만 해줘!',
        '다시 질문해줘.'
      ];
      if (invalidPhrases.some(phrase => reply.trim().startsWith(phrase))) {
        // Don't increment question count for invalid questions
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
    messages = [messages[0]]; // Keep only the system message
    
    // Add a message to make AI pick a new word
    messages.push({
      role: "user",
      content: "새로운 스무고개 게임을 시작하자! 새로운 단어를 하나 골라줘. 내가 질문할 준비가 됐어."
    });
    
    // Get AI to acknowledge and pick a word
    callOpenAI(messages, function(reply) {
      document.getElementById('aiAnswer').textContent = reply;
    });
    
    document.getElementById('currentQuestion').textContent = questionCount;
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
