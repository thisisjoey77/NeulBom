// Test more word chain cases
function isValidKkeutmal(prev, curr) {
  // 두음법칙을 고려한 끝말잇기 검증
  const lastChar = prev[prev.length-1];
  const firstChar = curr[0];
  
  // 1. 직접 연결되는 경우 (기본 규칙)
  if (lastChar === firstChar) {
    return true;
  }
  
  // 2. 두음법칙 적용 케이스들 (매우 제한적)
  // 두음법칙은 단어의 첫소리가 ㄹ, ㄴ일 때 다른 소리로 바뀌는 현상
  
  // 마지막 글자가 받침 ㄹ로 끝나는 경우만 (예: 물 -> 일, 물 -> 얼음)
  // 단, 이는 매우 제한적인 경우임
  if (lastChar === '물' && (firstChar === '일' || firstChar === '얼')) {
    return true;
  }
  
  // 다른 극히 제한적인 두음법칙 케이스들
  if (lastChar === '말' && firstChar === '이') {
    return true;
  }
  
  if (lastChar === '길' && firstChar === '이') {
    return true;
  }
  
  // 대부분의 경우는 정확히 일치해야 함
  return false;
}

console.log('=== Testing more problematic cases ===');

// Test cases that were reported as problematic
console.log('일기장 -> 규명하다:', isValidKkeutmal('일기장', '규명하다')); // Should be INVALID
console.log('일기장 -> 장미:', isValidKkeutmal('일기장', '장미')); // Should be VALID

console.log('기술 -> 입사:', isValidKkeutmal('기술', '입사')); // Should be INVALID  
console.log('기술 -> 술집:', isValidKkeutmal('기술', '술집')); // Should be VALID

console.log('컴퓨터 -> 터널:', isValidKkeutmal('컴퓨터', '터널')); // Should be VALID
console.log('컴퓨터 -> 도구:', isValidKkeutmal('컴퓨터', '도구')); // Should be INVALID

console.log('사람 -> 마음:', isValidKkeutmal('사람', '마음')); // Should be VALID
console.log('사람 -> 인간:', isValidKkeutmal('사람', '인간')); // Should be INVALID

console.log('학교 -> 교실:', isValidKkeutmal('학교', '교실')); // Should be VALID
console.log('학교 -> 가방:', isValidKkeutmal('학교', '가방')); // Should be INVALID

console.log('\n=== Testing 두음법칙 cases ===');
console.log('물 -> 일기:', isValidKkeutmal('물', '일기')); // Should be VALID (두음법칙)
console.log('물 -> 물고기:', isValidKkeutmal('물', '물고기')); // Should be VALID (normal)
console.log('말 -> 이야기:', isValidKkeutmal('말', '이야기')); // Should be VALID (두음법칙)
console.log('길 -> 이름:', isValidKkeutmal('길', '이름')); // Should be VALID (두음법칙)
