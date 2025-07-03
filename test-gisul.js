// Test specific case: 기술 -> 입사
function isValidKkeutmal(prev, curr) {
  // 끝말잇기 검증: 다음 단어는 이전 단어의 마지막 글자로 시작해야 함
  const lastChar = prev[prev.length-1];
  const firstChar = curr[0];
  
  // 기본 규칙: 마지막 글자와 첫 글자가 정확히 일치해야 함
  if (lastChar === firstChar) {
    return true;
  }
  
  // 끝말잇기에서는 두음법칙을 적용하지 않음
  // 예: "물" -> "물고기" (O), "물" -> "일기" (X)
  // 예: "기술" -> "술집" (O), "기술" -> "입사" (X)
  
  return false;
}

function testSpecificCase() {
  const prev = '기술';
  const curr = '입사';
  
  console.log(`Testing: ${prev} -> ${curr}`);
  
  const lastChar = prev[prev.length-1];
  const firstChar = curr[0];
  
  console.log(`Last character: ${lastChar}`);
  console.log(`First character: ${firstChar}`);
  console.log(`Expected: Next word should start with "${lastChar}"`);
  
  const result = isValidKkeutmal(prev, curr);
  console.log(`Result: ${result ? 'VALID' : 'INVALID'}`);
  
  if (!result) {
    console.log(`✓ Correct! "${prev}" should connect to words starting with "${lastChar}", not "${firstChar}"`);
  } else {
    console.log(`✗ Error! "${prev}" -> "${curr}" should be invalid`);
  }
  
  return result;
}

console.log('=== Testing 기술 -> 입사 ===');
testSpecificCase();

console.log('\n=== Testing some cases ===');
console.log('기술 -> 술잔:', isValidKkeutmal('기술', '술잔')); // Should be VALID
console.log('물 -> 일기:', isValidKkeutmal('물', '일기')); // Should be INVALID
console.log('물 -> 얼음:', isValidKkeutmal('물', '얼음')); // Should be INVALID  
console.log('물 -> 물고기:', isValidKkeutmal('물', '물고기')); // Should be VALID
console.log('사과 -> 과일:', isValidKkeutmal('사과', '과일')); // Should be VALID
