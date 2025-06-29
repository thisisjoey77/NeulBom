// telephoneGame.js - Telephone Game with OpenAI API for answer checking
// Uses secure API helper to protect API keys
// Example action prompts in Korean (반말)
const prompts = [
  "앉아", "일어나", "점프해", "박수쳐", "손 흔들어", "돌아", "발끝 만져", "손 들어", "끄덕여", "고개 저어", "달려", "걸어", "한 발로 뛰어", "웃어", "하품해", "눈 깜빡여", "기지개 켜", "가리켜", "기침해", "웃어봐"
];

const messages = [
  {
    role: "system",
    content: "너는 어린이 초등학생을 위한 제시어 게임의 채점 도우미야. 사용자가 단어 두개를 제시할거야. 첫 단어는 원래 제시어. 아이가 쓴 답이 두번째 단어야. 아이의 답이 원래 제시어와 의미가 비슷하거나, 동사/명사 변형(예: '박수쳐'와 '박수', '일어나'와 '일어남', '웃어'와 '웃음')처럼 형태가 달라도 의미가 같으면 '정답이야!', 아니면 '틀렸어!'만 한국어로 대답해. 띄어쓰기, 조사, 어미, 맞춤법이 달라도 의미가 같으면 정답으로 인정해."
  }
];

const oppositeMessages = [
  {
    role: "system", 
    content: "너는 어린이 초등학생을 위한 '반대말 게임'의 채점 도우미야. 사용자가 단어 두개를 제시할거야. 첫 단어는 원래 제시어. 아이가 쓴 답이 두번째 단어야. 아이의 답이 원래 제시어의 반대 의미이거나 반대 행동이면 '정답이야!', 아니면 '틀렸어!'만 한국어로 대답해. 예시: '앉아'의 반대는 '일어나/서/일어서기/일어서다/자리에서 일어나', '웃어'의 반대는 '울어/울기/운다', '들어'의 반대는 '나가/밖으로/나가기', '위로'의 반대는 '아래로/밑으로' 등. 띄어쓰기, 조사, 어미, 맞춤법이 달라도 반대 의미가 맞으면 정답으로 인정해. 또한 동사/명사 변형(예: '일어나'와 '일어남', '일어서기', '일어서다')처럼 형태가 달라도 반대 의미가 같으면 정답으로 인정해."
  }
];

let currentPrompt = "";

function isOppositeMode() {
  return document.getElementById('oppositeMode').checked;
}

function pickPrompt() {
  currentPrompt = prompts[Math.floor(Math.random() * prompts.length)];
}

function showPrompt() {
  const promptDisplay = document.getElementById('promptDisplay');
  if (isOppositeMode()) {
    promptDisplay.textContent = currentPrompt + "의 반대";
    promptDisplay.style.color = '#d32f2f'; // Red color for opposite mode
  } else {
    promptDisplay.textContent = currentPrompt;
    promptDisplay.style.color = '#1976d2'; // Original blue color
  }
  promptDisplay.style.display = 'block';
  setTimeout(() => {
    promptDisplay.style.display = 'none';
    document.getElementById('showPromptBtn').style.display = 'none';
    document.getElementById('userAnswer')?.disabled && (document.getElementById('userAnswer').disabled = false);
    document.querySelector('#answerForm button')?.disabled && (document.querySelector('#answerForm button').disabled = false);
    document.getElementById('userAnswer')?.focus();
  }, 5000);
}

window.onload = function() {
  pickPrompt();
  document.getElementById('showPromptBtn').onclick = showPrompt;

  // Add event listener for opposite mode toggle
  document.getElementById('oppositeMode').onchange = function() {
    // Reset the game when mode changes
    pickPrompt();
    document.getElementById('promptDisplay').style.display = 'none';
    document.getElementById('showPromptBtn').style.display = 'inline-block';
    document.getElementById('voiceInputDisplay').textContent = '';
    document.getElementById('resultDisplay').textContent = '';
  };

  // Voice recognition setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
  }

  const voiceBtn = document.getElementById('voiceBtn');
  const voiceInputDisplay = document.getElementById('voiceInputDisplay');

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
      voiceInputDisplay.textContent = '입력: ' + transcript;
      voiceBtn.textContent = '🎤 음성으로 답변';
      voiceBtn.disabled = false;
      // 자동으로 정답 채점
      document.getElementById('resultDisplay').textContent = '채점 중...';
      
      // Choose the appropriate message system based on mode
      const currentMessages = isOppositeMode() ? [...oppositeMessages] : [...messages];
      
      if (isOppositeMode()) {
        currentMessages.push({
          role: 'user', 
          content: '원래 제시어는: ' + currentPrompt + '. 아이가 쓴 반대말 답은: ' + transcript
        });
      } else {
        currentMessages.push({
          role: 'user',
          content: '원래 제시어는: ' + currentPrompt + '. 아이가 쓴 답은 ' + transcript
        });
      }
      
      try {
        const data = await callOpenAI(currentMessages);
        let reply = data.choices[0].message.content.trim();
        document.getElementById('resultDisplay').textContent = reply;
      } catch (error) {
        console.error('Error:', error);
        document.getElementById('resultDisplay').textContent = '채점에 실패했습니다. 다시 시도해주세요.';
      }
    };
    recognition.onerror = function() {
      voiceBtn.textContent = '🎤 음성으로 답변';
      voiceBtn.disabled = false;
      alert('음성 인식에 실패했습니다. 다시 시도해주세요.');
    };
  }
};
