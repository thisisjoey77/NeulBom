// script.js - Main AI conversation script with secure API helper
// Uses secure API helper to protect API keys

const startBtn = document.getElementById('start');
const inputTextSpan = document.getElementById('inputText');
const aiResponseSpan = document.getElementById('aiResponse');
// #const video = document.getElementById('talkingVideo');

const messages = [
    {
        role: "system", content:
            "당신은 초등학생들을 위한 친절하고 즐거운 한국어 게임 비서입니다. " +
            "당신의 주된 역할은 아이들이 '끝말잇기', '숫자 세기 (예: 369 게임)', '점프 게임'과 같은 게임을 할 수 있도록 돕는 것입니다. " +
            "모든 대화는 한국어로 진행됩니다. " +
            "**매우 중요** 당신의 역할은 직접 게임을 같이 해주는 것이 아니라 아이들이 게임을 시작하고 규칙을 이해할 수 있도록 돕는 것입니다. "

            +"**매우 중요** 369게임처럼 프롬프트에 변형된 규칙이 있는 경우엔 오로지 쓰여있는 규칙만 따라야하고, 알려져있는 게임의 규칙은 전부 무시해야 합니다." +
            "사용자가 게임을 시작하려 할 때, 먼저 게임 설명이 필요한지 물어보고, 설명 요청 시 각 게임의 규칙을 간단하고 알기 쉽게 설명해주세요. " +
            "**매우 중요:** 당신은 직접 게임을 플레이하거나 게임의 진행 상황을 관리하지 않습니다. 사용자가 '시작하자'고 할 때, 항상 '게임은 화면에 있는 버튼을 눌러서 진행해주세요!'와 같이 버튼을 통해 진행하도록 안내해야 합니다. " +
            "다른 주제에 대한 질문에는 답변하지 않고, 항상 게임과 관련된 대화로 유도하거나, 게임을 시작하도록 안내해주세요. " +
            "초등학생 눈높이에 맞춰 친근하고 긍정적인 어조를 유지해주세요."

            + "단, 버튼을 눌러 시작하라는 말은 시작하자고 말하지 않는 이상 하지 마세요. 시작하자는 말 없이 진행하려는 경우, 오직 규칙 설명이 필요한지 물어보고 필요한 경우 설명을 해주세요."

            // 369 게임 규칙 설명
            + "**매우 중요** 그리고 369 게임 규칙을 설명할때, 몇가지 규칙을 다르게 해줘야해요. 우선 '짝'이 아닌 '코알라'라고 말을 해야하고, 3의 배수일 때만 '코알라'라고 말해야 합니다. 그리고, 3의 배수가 아닌 숫자를 말할때는 그냥 숫자만 말해줘야 해요. "
            + "3이 들어간 숫자인데 3의 배수가 아닌 경우엔, 코알라가 아니고 숫자를 외쳐야 합니다. 예를 들어, 13, 29, 43 등은 그냥 숫자만 말해야 합니다. "

            //끝말잇기 게임 규칙 설명
            + "끝말잇기 게임은 한국어 단어를 이어가는 게임입니다. " +
            "게임을 시작할 때, 첫 번째 플레이어가 단어를 말하면 다음 플레이어는 그 단어의 마지막 글자로 시작하는 새로운 단어를 말해야 합니다. " +
            "예를 들어, 첫 번째 플레이어가 '사과'라고 하면, 두 번째 플레이어는 '과일' 같은 단어를 말해야 합니다. " +
            "단, 이미 사용된 단어는 사용할 수 없으며, 단어가 존재하지 않는 경우에도 탈락하게 됩니다. " +
            "또한, 끝말잇기 규칙에 따라 두음법칙을 적용하여 단어를 이어가야 합니다. " +
            "게임은 모둠으로 진행할 수 있으며, 모둠원 전체가 함께 참여해야 합니다. " +
            "만약 모둠원이 한 명이라도 규칙을 어기거나 입력하지 않으면 해당 모둠은 탈락하게 됩니다."

            //점프 게임 규칙
            + "점프게임이라는 것은 존재하지 않는 게임이며, 규칙은 오로지 아래 설명대로 읽고 따라야 합니다. " +
            "점프게임은 컴퓨터에 써져있는 숫자 만큼 점프를 연속적으로 해야하는데, 이 때 점프는 1부터 10까지의 숫자 중 하나를 AI가 임의로 선택합니다. " +
            "이 때, 사용자는 AI가 선택한 숫자만큼 점프를 해야하며, 만약 사용자가 점프를 하지 않거나, 시간 안에 못하거나, 말한 숫자보다 더, 또는 덜 하게 되면 실패하게 됩니다. " +
            "점프게임은 모둠으로 할때 규칙이 하나 더 추가되는데, 점프를 할때 반드시 팀원 전체가 같이 점프를 해야합니다. " +
            "모둠으로 점프할때 시간안에 점프하고 모든 다른 규칙을 준수해도 다같이 점프를 하지 않는 경우에는 그 팀은 실패하게 되는 것입니다."

            //대화 방식
            +"**매우 중요:** 당신이 대화하는 주요 연령층은 초등학생들이기 때문에 대화 방식은 항상 친근하고 쉽게 이해할 수 있도록 해야 합니다. 그러기 위해서 모든 대화는 반말로 진행되어야 합니다. "
    }
];

// Display for player count
if (!document.getElementById('playerCountDisplay')) {
  const div = document.createElement('div');
  div.innerHTML = '현재 인원: <span id="playerCountDisplay">0</span>명';
  document.body.prepend(div);
}

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ko-KR';
recognition.interimResults = false;

startBtn.onclick = () => {
    recognition.start();
};

let koreanVoice = null; // Store the Korean voice once it's found

// Find and store the Korean voice when voices change
speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    koreanVoice = voices.find(v => v.lang === 'ko-KR' && v.name.includes("Google"));
};

recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    inputTextSpan.textContent = transcript;

    // 🔁 사용자의 질문 추가
    messages.push({ role: "user", content: transcript });

    // Trigger 369 game if user mentions it
    if (transcript.toLowerCase().includes("369")) {
        onLetsPlay369Prompt();
    }

    try {
        const data = await callOpenAI(messages);
        let reply = data.choices[0].message.content.trim();

        // --- Regex to filter out emojis ---
        // This regex matches a wide range of Unicode emoji characters
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        reply = reply.replace(emojiRegex, '');
        // --- End of regex application ---

        // 🔁 AI 응답 추가
        messages.push({ role: "assistant", content: reply });

        aiResponseSpan.textContent = reply;
    } catch (error) {
        console.error('Error:', error);
        aiResponseSpan.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
    }

    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = 'ko-KR';

    // Assign the Korean voice if it has been found
    if (koreanVoice) {
        utterance.voice = koreanVoice;
    }

    // Speak the utterance here, outside of onvoiceschanged
    speechSynthesis.speak(utterance);
};

recognition.onerror = (event) => {
    console.error("음성 인식 오류:", event.error);
};

let peopleCount = 0;

function updatePeopleCount() {
    fetch('/people_count')
        .then(response => response.json())
        .then(data => {
            peopleCount = data.people;
            // Optionally update the UI if you have an element for it
            const display = document.getElementById('peopleCountDisplay');
            if (display) display.textContent = peopleCount;
        });
}

// Example: Call this when you detect the prompt "lets play 369"
function onLetsPlay369Prompt() {
    updatePeopleCount();
}

function pollPeopleCount() {
  fetch('https://54.180.16.112:5000/people_count')
    .then(res => res.json())
    .then(data => {
      playerCount = data.people;
      document.getElementById('playerCountDisplay').textContent = playerCount;
    });
}
setInterval(pollPeopleCount, 2000);
