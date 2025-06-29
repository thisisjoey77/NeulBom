// imageGuess.js - 동물 그림 묘사 맞히기 게임

// 동물 후보
const animals = [
  { name: '얼룩말', img: 'images/얼룩말.png' },
  { name: '돼지', img: 'images/돼지.png' },
  { name: '소', img: 'images/소.png' },
  { name: '강아지', img: 'images/강아지.png' },
  { name: '고양이', img: 'images/고양이.png' },
  { name: '닭', img: 'images/닭.png' }
];

let answerAnimal = null;

function pickAnimal() {
  answerAnimal = animals[Math.floor(Math.random() * animals.length)];
  const imgArea = document.getElementById('imageArea');
  imgArea.innerHTML = `<img src="${answerAnimal.img}" alt="동물 그림" style="max-width:220px;max-height:180px;border-radius:12px;box-shadow:0 2px 16px rgba(33,150,243,0.12);">`;
}

window.onload = function() {
  pickAnimal();
  document.getElementById('aiGuess').textContent = '';
  document.getElementById('descForm').onsubmit = async function(e) {
    e.preventDefault();
    const desc = document.getElementById('descInput').value.trim();
    if (!desc) return;
    document.getElementById('aiGuess').textContent = 'AI가 생각 중...';
    // OpenAI API 프롬프트
    const messages = [
      {
        role: 'system',
        content: '너는 동물 그림을 맞히는 AI야. 학생이 그림을 묘사하면, 얼룩말, 돼지, 소, 강아지, 고양이, 닭 중에서 가장 알맞은 동물을 골라. 답변은 반드시 초등학생에게 친근하게, 한국어로, "내 생각엔 이 동물은 [동물명]인 것 같아!"처럼 짧고 귀엽게 해줘.'
      },
      { role: 'user', content: desc }
    ];
    try {
      const data = await callOpenAI(messages);
      let reply = data.choices[0].message.content.trim();
      document.getElementById('aiGuess').textContent = reply;
    } catch (error) {
      console.error('Error:', error);
      document.getElementById('aiGuess').textContent = '오류가 발생했습니다. 다시 시도해주세요.';
    }
    document.getElementById('descInput').value = '';
    document.getElementById('restartBtn').style.display = 'inline-block';
  };
  document.getElementById('restartBtn').onclick = function() {
    pickAnimal();
    document.getElementById('aiGuess').textContent = '';
    document.getElementById('descInput').value = '';
    document.getElementById('restartBtn').style.display = 'none';
  };
};
