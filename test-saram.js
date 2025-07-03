// Check "사람" character breakdown
const word = "사람";
const lastChar = word[word.length-1];
console.log(`Word: ${word}`);
console.log(`Last character: ${lastChar}`);

const lastCharCode = lastChar.charCodeAt(0);
console.log(`Character code: ${lastCharCode}`);

if (lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3) {
  const syllableIndex = lastCharCode - 0xAC00;
  const initialConsonant = Math.floor(syllableIndex / 588);
  const medialVowel = Math.floor((syllableIndex % 588) / 28);
  const finalConsonant = syllableIndex % 28;
  
  console.log(`Initial consonant index: ${initialConsonant}`);
  console.log(`Medial vowel index: ${medialVowel}`);
  console.log(`Final consonant index: ${finalConsonant}`);
  
  if (finalConsonant === 0) {
    console.log('No 받침');
  } else {
    console.log(`Has 받침 at index ${finalConsonant}`);
  }
}
