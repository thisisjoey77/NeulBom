// firstSoundGame.js - 초성게임 (First Sound Game)
// Now uses local API server for secure API key management

// Example Korean words (add more as needed)
const words = [
  "사과", "바나나", "포도", "컴퓨터", "학교", "자동차", "강아지", "고양이", "커피", "우유", "치킨", "비행기", "의자", "책상", "연필", "노트북", "텔레비전", "냉장고", "전화기", "시계"
];

// 초성 추출 함수
function getChosung(word) {
  const CHOSUNG_LIST = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
  ];
  let result = "";
  for (let i = 0; i < word.length; i++) {
    const code = word.charCodeAt(i) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      result += CHOSUNG_LIST[Math.floor(code / 588)];
    } else {
      result += word[i];
    }
  }
  return result;
}

let answer = "";
let tries = 5;

function newGame() {
  answer = words[Math.floor(Math.random() * words.length)];
  tries = 5;
  document.getElementById('chosungDisplay').textContent = getChosung(answer);
  document.getElementById('resultDisplay').textContent = '';
  document.getElementById('triesLeft').textContent = tries;
  document.getElementById('userGuess').value = '';
  document.getElementById('userGuess').disabled = false;
  document.getElementById('restartBtn').style.display = 'none';
}

window.onload = function() {
  newGame();
  document.getElementById('guessForm').onsubmit = async function(e) {
    e.preventDefault();
    if (tries <= 0) return;
    const guess = document.getElementById('userGuess').value.trim();
    if (!guess) return;
    if (guess === answer) {
      document.getElementById('resultDisplay').textContent = '정답! 단어: ' + answer;
      document.getElementById('userGuess').disabled = true;
      document.getElementById('restartBtn').style.display = 'inline-block';
      document.getElementById('hintDisplay').textContent = '';
    } else {
      tries--;
      if (tries > 0) {
        document.getElementById('resultDisplay').textContent = '틀렸습니다! 다시 시도하세요.';
        document.getElementById('triesLeft').textContent = tries;
        // AI 힌트 요청
        document.getElementById('hintDisplay').textContent = '힌트 생성 중...';
        const prompt = `초성게임에서 사용자가 "${guess}"라고 추측했어. 정답은 "${answer}"인데, 절대로 이 단어를 직접 말하지 마. 대신 이 단어의 특징이나 용도, 색깔, 크기, 어디서 볼 수 있는지 등을 설명해서 힌트를 줘. 한 문장으로, 초등학생이 이해할 수 있게 반말로 말해줘. 정답 단어나 그 단어의 일부를 절대 포함하지 마.`;
        try {
          const data = await callOpenAI([
            {role: "system", content: `너는 초등학생을 위한 초성게임 힌트 선생님이야. 힌트를 줄 때 절대 지켜야 할 규칙들: 1) 정답 단어를 직접 말하지 마, 2) 정답 단어의 일부분도 말하지 마, 3) 정답 단어와 비슷한 소리의 단어도 피해, 4) 대신 그 사물의 특징, 용도, 모양, 색깔, 크기, 위치 등을 설명해, 5) 항상 반말로 한 문장으로만 답해. 예시: "사과"라면 "빨간 색이고 달콤한 과일이야" 같은 식으로.`},
            {role: "user", content: prompt}
          ], "gpt-3.5-turbo");
          
          let hint = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content.trim() : '';
          
          // Double-check that the hint doesn't contain the answer
          if (hint.includes(answer)) {
            hint = '이것은 일상에서 자주 볼 수 있는 것이야!';
          }
          
          document.getElementById('hintDisplay').textContent = hint;
        } catch (err) {
          document.getElementById('hintDisplay').textContent = '힌트 생성 실패';
        }
      } else {
        document.getElementById('resultDisplay').textContent = '실패! 정답은: ' + answer;
        document.getElementById('triesLeft').textContent = 0;
        document.getElementById('userGuess').disabled = true;
        document.getElementById('restartBtn').style.display = 'inline-block';
        document.getElementById('hintDisplay').textContent = '';
      }
    }
    document.getElementById('userGuess').value = '';
  };
  document.getElementById('restartBtn').onclick = newGame;
};
