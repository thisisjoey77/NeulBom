// guessPerson.js - 인물 맞히기 (Guess the Person) Game

// You should move OpenAI API calls to the backend for security in production!
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
let maxQuestions = 6;
let gameOver = false;
let personName = "";
let revealedHints = [];
let messages = [
  {
    role: "system",
    content: `너는 인물 맞히기 게임의 AI 마스터야. 먼저 네가 생각한 인물은 반드시 유치원생과 초등학생들이 모두 잘 아는 매우 쉬운 인물이어야 해. 예를 들어: 뽀로로, 라이언, 둘리, 도라에몽, 피카츄, 헬로키티, 뽀빠이, 미키마우스, 백설공주, 신데렐라, 곰돌이 푸, 토마스 기차, 디즈니 공주들, 슈퍼맨, 스파이더맨 같은 인물들. 한국 어린이들이 TV나 책에서 자주 보는 캐릭터나 동화 속 인물을 골라야 해. 너무 어렵거나 생소한 인물은 절대 고르지 마. 사용자가 질문을 하면 짧고 간단하게 대답하고, 그 다음 반드시 별도의 힌트를 \"힌트: ...\" 형식으로 제공해. 이 힌트는 학생들이 아직 질문하지 않은, 인물에 대한 새로운 정보여야 해. 이미 학생이 질문한 내용이나 알게 된 정보는 힌트로 주지 마. 사용자가 정답을 맞히면 '정답이야! 축하해!'라고 하고, 6번 안에 못 맞히면 '아쉽지만 정답은 [인물]이었어!'라고 알려줘. 정답을 맞히기 전까지는 인물 이름을 절대 직접 말하지 마. 모든 대화는 반말로 해줘.`
  }
];

window.onload = function() {
  document.getElementById('gpQuestionForm').onsubmit = async function(e) {
    e.preventDefault();
    if (gameOver || questionCount >= maxQuestions) return;
    
    if (!OPENAI_API_KEY) {
      document.getElementById('gpAiAnswer').textContent = 'API 키가 로드되지 않았습니다. 다시 시도해주세요.';
      return;
    }
    
    const userQuestion = document.getElementById('gpUserQuestion').value.trim();
    if (!userQuestion) return;
    questionCount++;
    document.getElementById('gpCurrentQuestion').textContent = questionCount;
    messages.push({ role: 'user', content: userQuestion });
    document.getElementById('gpAiAnswer').textContent = 'AI가 생각 중...';
    
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages
      })
    });
    const data = await response.json();
    let reply = data.choices[0].message.content.trim();
    // Split response and hint
    let answerText = reply;
    let hint = '';
    if (reply.includes('힌트:')) {
      [answerText, hint] = reply.split('힌트:');
      answerText = answerText.trim();
      hint = hint.trim();
    }
    document.getElementById('gpAiAnswer').textContent = answerText;
    messages.push({ role: 'assistant', content: reply });
    if (hint && !revealedHints.includes(hint)) {
      revealedHints.push(hint);
      document.getElementById('gpHint').textContent = '힌트: ' + hint;
    }
    if (questionCount >= maxQuestions && !gameOver) {
      endGame('lose');
    }
    document.getElementById('gpUserQuestion').value = '';
    } catch (error) {
      console.error('Error:', error);
      document.getElementById('gpAiAnswer').textContent = '오류가 발생했습니다. 다시 시도해주세요.';
    }
  };
  document.getElementById('gpRestartBtn').onclick = function() {
    questionCount = 0;
    gameOver = false;
    revealedHints = [];
    messages = [messages[0]];
    document.getElementById('gpCurrentQuestion').textContent = questionCount;
    document.getElementById('gpAiAnswer').textContent = '';
    document.getElementById('gpHint').textContent = '';
    document.getElementById('gpFinalResult').textContent = '';
    document.getElementById('gpRestartBtn').style.display = 'none';
    document.getElementById('gpUserQuestion').disabled = false;
    document.querySelector('#gpQuestionForm button').disabled = false;
  };
};

function endGame(result) {
  gameOver = true;
  document.getElementById('gpRestartBtn').style.display = 'inline-block';
  document.getElementById('gpUserQuestion').disabled = true;
  document.querySelector('#gpQuestionForm button').disabled = true;
  if (result === 'win') {
    document.getElementById('gpFinalResult').textContent = '🎉 정답! 축하해! 게임을 다시 시작하려면 아래 버튼을 눌러줘.';
  } else {
    // Try to extract the answer from the AI's reply
    let lastReply = messages[messages.length-1].content;
    let match = lastReply.match(/정답은 ([^ ]+)이었어/);
    let answer = match ? match[1] : '알 수 없음';
    document.getElementById('gpFinalResult').textContent = `😢 6번이 지났어. 정답은 "${answer}"였어!`;
  }
}
