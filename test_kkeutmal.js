// Test script for Korean word chain game logic
// Run with: node test_kkeutmal.js

// Copy the key functions from lastWord.js to test them

function isValidKkeutmal(prev, curr) {
  // 두음법칙을 고려한 끝말잇기 검증
  const lastChar = prev[prev.length-1];
  const firstChar = curr[0];
  
  // 1. 직접 연결되는 경우 (가장 일반적)
  if (lastChar === firstChar) {
    return true;
  }
  
  // 2. 두음법칙 적용 케이스들
  
  // ㄹ -> ㅇ/없음 (예: 물 -> 일, 물 -> 얼음)
  const lastCharCode = lastChar.charCodeAt(0);
  if (lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3) {
    const syllableIndex = lastCharCode - 0xAC00;
    const finalConsonant = syllableIndex % 28;
    
    // ㄹ 받침 -> 이, 여, 연, 열, 영, 염, 예, 요, 야, 얘 등
    if (finalConsonant === 8) { // ㄹ
      if (firstChar === '이' || firstChar === '여' || firstChar === '연' || 
          firstChar === '열' || firstChar === '영' || firstChar === '염' ||
          firstChar === '예' || firstChar === '요' || firstChar === '야' || 
          firstChar === '얘' || firstChar === '입' || firstChar === '일' ||
          firstChar === '인' || firstChar === '임') {
        return true;
      }
    }
    
    // ㄴ 받침 -> 이, 여, 연, 열, 영, 염 등
    if (finalConsonant === 4) { // ㄴ
      if (firstChar === '이' || firstChar === '여' || firstChar === '연' || 
          firstChar === '열' || firstChar === '영' || firstChar === '염') {
        return true;
      }
    }
  }
  
  // 3. 받침 없는 경우의 두음법칙
  if (lastChar === '리' || lastChar === '름' || lastChar === '력' || lastChar === '록' || 
      lastChar === '론' || lastChar === '래' || lastChar === '로' || lastChar === '루' ||
      lastChar === '르' || lastChar === '를' || lastChar === '린' || lastChar === '렬') {
    if (firstChar === '이' || firstChar === '예' || firstChar === '여' || 
        firstChar === '요' || firstChar === '야' || firstChar === '얘' ||
        firstChar === '영' || firstChar === '엽' || firstChar === '염' ||
        firstChar === '연' || firstChar === '열' || firstChar === '입' ||
        firstChar === '일' || firstChar === '인' || firstChar === '임') {
      return true;
    }
  }
  
  if (lastChar === '니' || lastChar === '는' || lastChar === '늘' || lastChar === '남' ||
      lastChar === '날' || lastChar === '난' || lastChar === '널' || lastChar === '논') {
    if (firstChar === '이' || firstChar === '여' || firstChar === '연' || 
        firstChar === '열' || firstChar === '영' || firstChar === '염') {
      return true;
    }
  }
  
  return false;
}

function getPossibleStartChars(lastChar) {
  const chars = [lastChar]; // 기본적으로 마지막 글자와 같은 글자
  
  // 두음법칙 적용 가능한 경우들 추가
  
  // ㄹ로 끝나는 경우
  if (lastChar === '리' || lastChar === '름' || lastChar === '력' || lastChar === '록' || 
      lastChar === '론' || lastChar === '래' || lastChar === '로' || lastChar === '루' ||
      lastChar === '르' || lastChar === '를' || lastChar === '린' || lastChar === '렬') {
    chars.push('이', '예', '여', '요', '야', '얘', '영', '엽', '염', '연', '열', '입', '일', '인', '임');
  }
  
  // ㄴ으로 끝나는 경우
  if (lastChar === '니' || lastChar === '는' || lastChar === '늘' || lastChar === '남' ||
      lastChar === '날' || lastChar === '난' || lastChar === '널' || lastChar === '논') {
    chars.push('이', '여', '연', '열', '영', '염');
  }
  
  // 받침에 따른 두음법칙 처리 (ㄹ, ㄴ만 처리)
  const lastCharCode = lastChar.charCodeAt(0);
  if (lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3) {
    const syllableIndex = lastCharCode - 0xAC00;
    const finalConsonant = syllableIndex % 28;
    
    // ㄹ 받침 -> 이, 여, 연, 열, 영, 염, 예, 요, 야, 얘 등 (두음법칙)
    if (finalConsonant === 8) { // ㄹ
      chars.push('이', '여', '연', '열', '영', '염', '예', '요', '야', '얘', '입', '일', '인', '임');
    }
    
    // ㄴ 받침 -> 이, 여, 연, 열, 영, 염 등 (두음법칙)
    if (finalConsonant === 4) { // ㄴ
      chars.push('이', '여', '연', '열', '영', '염');
    }
  }
  
  // 중복 제거하고 반환
  return [...new Set(chars)];
}

// Test cases
console.log('Testing Korean word chain game logic:');
console.log('');

// Test 1: 일기장 (ends with 장 - has ㅇ 받침)
console.log('Test 1: 일기장 -> ?');
console.log('getPossibleStartChars("장"):', getPossibleStartChars('장'));
console.log('isValidKkeutmal("일기장", "장갑"):', isValidKkeutmal('일기장', '장갑'));
console.log('isValidKkeutmal("일기장", "규명하다"):', isValidKkeutmal('일기장', '규명하다'));
console.log('isValidKkeutmal("일기장", "고가교"):', isValidKkeutmal('일기장', '고가교'));
console.log('');

// Test 2: 물 (ends with 물 - has ㄹ 받침)
console.log('Test 2: 물 -> ?');
console.log('getPossibleStartChars("물"):', getPossibleStartChars('물'));
console.log('isValidKkeutmal("물", "물고기"):', isValidKkeutmal('물', '물고기'));
console.log('isValidKkeutmal("물", "일기"):', isValidKkeutmal('물', '일기'));
console.log('isValidKkeutmal("물", "사자"):', isValidKkeutmal('물', '사자'));
console.log('');

// Test 3: 강아지 (ends with 지 - no 받침)
console.log('Test 3: 강아지 -> ?');
console.log('getPossibleStartChars("지"):', getPossibleStartChars('지'));
console.log('isValidKkeutmal("강아지", "지구"):', isValidKkeutmal('강아지', '지구'));
console.log('isValidKkeutmal("강아지", "사자"):', isValidKkeutmal('강아지', '사자'));
console.log('');

// Test 4: 산 (ends with 산 - has ㄴ 받침)
console.log('Test 4: 산 -> ?');
console.log('getPossibleStartChars("산"):', getPossibleStartChars('산'));
console.log('isValidKkeutmal("산", "산책"):', isValidKkeutmal('산', '산책'));
console.log('isValidKkeutmal("산", "일기"):', isValidKkeutmal('산', '일기'));
console.log('isValidKkeutmal("산", "사자"):', isValidKkeutmal('산', '사자'));
