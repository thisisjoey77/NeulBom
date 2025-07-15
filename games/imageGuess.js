// imageGuess.js - 동물 그림 묘사 맞히기 게임 (Voice Input Version)

// 동물 후보 - 로컬 images 폴더의 모든 동물 이미지 사용
const animals = [
  { name: '강아지', img: '강아지.png' },
  { name: '고양이', img: '고양이.png' },
  { name: '나비', img: '나비.jpg' },
  { name: '다람쥐', img: '다람쥐.png' },
  { name: '닭', img: '닭.png' },
  { name: '돼지', img: '돼지.png' },
  { name: '소', img: '소.png' },
  { name: '얼룩말', img: '얼룩말.png' },
  { name: '코끼리', img: '코끼리.png' }
];

let answerAnimal = null;

// Voice recording variables
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let isListening = false;

async function pickAnimal() {
  answerAnimal = animals[Math.floor(Math.random() * animals.length)];
  const imgArea = document.getElementById('imageArea');
  
  try {
    // Get the correct image path for both development and built app
    let imagePath;
    if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
      console.log('Requesting image path for:', answerAnimal.img);
      imagePath = await window.electron.ipcRenderer.invoke('get-image-path', answerAnimal.img);
      console.log('Received image path:', imagePath);
    } else {
      // Fallback for browser testing
      imagePath = `images/${answerAnimal.img}`;
      console.log('Using fallback image path:', imagePath);
    }
    
    if (imagePath) {
      // Create the image element and handle load/error events
      const img = document.createElement('img');
      img.style.cssText = 'max-width:220px;max-height:180px;border-radius:12px;box-shadow:0 2px 16px rgba(33,150,243,0.12);';
      img.alt = '동물 그림';
      
      img.onload = function() {
        console.log('Image loaded successfully:', imagePath);
        imgArea.innerHTML = '';
        imgArea.appendChild(img);
      };
      
      img.onerror = function() {
        console.error('Failed to load image:', imagePath);
        imgArea.innerHTML = `<div style="max-width:220px;max-height:180px;border-radius:12px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#666;">이미지 로드 실패: ${answerAnimal.name}</div>`;
      };
      
      img.src = imagePath;
      
      // Show loading state while image loads
      imgArea.innerHTML = `<div style="max-width:220px;max-height:180px;border-radius:12px;background:#f9f9f9;display:flex;align-items:center;justify-content:center;color:#999;">이미지 로딩 중...</div>`;
      
    } else {
      console.error('No image path returned for:', answerAnimal.img);
      imgArea.innerHTML = `<div style="max-width:220px;max-height:180px;border-radius:12px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#666;">이미지를 로드할 수 없습니다</div>`;
    }
  } catch (error) {
    console.error('Error loading image:', error);
    imgArea.innerHTML = `<div style="max-width:220px;max-height:180px;border-radius:12px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#666;">이미지 로드 오류</div>`;
  }
}

function updateVoiceStatus(message, color = '#666') {
  const voiceStatus = document.getElementById('voiceStatus');
  if (voiceStatus) {
    voiceStatus.textContent = message;
    voiceStatus.style.color = color;
    
    // Clear status after delay for success/error messages
    if (message.includes('✅') || message.includes('❌')) {
      setTimeout(() => {
        voiceStatus.textContent = '';
      }, 3000);
    }
  }
}

async function processDescription(description) {
  if (!description.trim()) return;
  
  document.getElementById('aiGuess').textContent = 'AI가 생각 중...';
  
  // OpenAI API 프롬프트
  const messages = [
    {
      role: 'system',
      content: '너는 동물 그림을 맞히는 AI야. 학생이 그림을 묘사하면, 강아지, 고양이, 나비, 다람쥐, 닭, 돼지, 소, 얼룩말, 코끼리 중에서 가장 알맞은 동물을 골라. 답변은 반드시 초등학생에게 친근하게, 한국어로, "내 생각엔 이 동물은 [동물명]인 것 같아!"처럼 짧고 귀엽게 해줘.'
    },
    { role: 'user', content: description }
  ];
  
  try {
    // Get API key via IPC
    let apiKey;
    if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
      apiKey = await window.electron.ipcRenderer.invoke('get-openai-key');
    } else {
      console.error('Electron IPC not available - running in browser?');
    }
    
    if (!apiKey) {
      document.getElementById('aiGuess').textContent = 'API 키가 설정되지 않았습니다.';
      return;
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

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    document.getElementById('aiGuess').textContent = aiResponse;
    
    // Check if AI guessed correctly
    const guessedAnimal = aiResponse.toLowerCase();
    const correctAnswer = answerAnimal.name.toLowerCase();
    
    if (guessedAnimal.includes(correctAnswer)) {
      document.getElementById('aiGuess').style.color = '#4caf50';
      updateVoiceStatus('✅ 정답입니다!', '#4caf50');
    } else {
      document.getElementById('aiGuess').style.color = '#ffe082';
      updateVoiceStatus(`정답은 "${answerAnimal.name}"입니다. 다시 설명해보세요!`, '#ff9800');
    }
    
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('aiGuess').textContent = '오류가 발생했습니다. 다시 시도해주세요.';
  }
}

window.onload = async function() {
  await pickAnimal();
  document.getElementById('aiGuess').textContent = 'M키를 눌러서 동물을 설명해보세요!';
  
  // Set up voice input
  setupVoiceInput();
  
  // Restart button functionality
  document.getElementById('restartBtn').onclick = async function() {
    await pickAnimal();
    document.getElementById('aiGuess').textContent = 'M키를 눌러서 동물을 설명해보세요!';
    document.getElementById('aiGuess').style.color = '#ffe082';
    updateVoiceStatus('');
  };
};

function setupVoiceInput() {
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
    
    updateVoiceStatus('🎤 녹음 중... (M키를 떼면 인식 시작)', '#ff5722');
    
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
    updateVoiceStatus('오류: 마이크에 접근할 수 없습니다', '#f44336');
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  
  isRecording = false;
  mediaRecorder.stop();
  updateVoiceStatus('🔄 음성 처리 중...', '#2196f3');
}

async function processAudio(audioBlob) {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = window.electron.bufferFrom(arrayBuffer);
    
    const transcript = await window.electron.ipcRenderer.invoke('recognize-audio', buffer);
    
    if (transcript && transcript.trim()) {
      updateVoiceStatus(`들은 내용: "${transcript.trim()}"`, '#4caf50');
      
      // Process the transcribed description
      await processDescription(transcript.trim());
    } else {
      updateVoiceStatus('❌ 음성이 인식되지 않았습니다', '#ff9800');
    }
  } catch (err) {
    console.error('Speech recognition error:', err);
    updateVoiceStatus('❌ 음성 인식에 실패했습니다', '#f44336');
  } finally {
    isListening = false;
  }
}
