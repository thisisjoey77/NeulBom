// br31.js - p5.js implementation of 베스킨라빈스 31 (BR31) 2-player game
let br31Current = 0;
let br31GameOver = false;
let br31CurrentPlayer = 1; // 1 or 2
let br31LastMove = 0;

// Array to track which player claimed each number (0: unclaimed, 1: P1, 2: P2)
let br31Owners = Array(31).fill(0);

function setup() {
  // Attach p5.js canvas to the static #p5-holder div and center it
  let cnv = createCanvas(650, 400);
  let holder = select('#p5-holder');
  cnv.parent(holder);
  holder.style('display', 'flex');
  holder.style('justify-content', 'center');
  holder.style('align-items', 'center');

  // Initialize game state
  br31Current = 0;
  br31GameOver = false;
  br31CurrentPlayer = 1; // 1: person, 2: computer
  br31LastMove = 0;
  br31Owners = Array(31).fill(0); // Reset ownership

  // Start polling for jump detection
  window.jumpPollingActive = false;
}

// Poll jump count from backend and handle move
let lastJumpCount = 0;
let lastJumpTime = 0;
let jumpTimeout = null;

function pollJumpCount() {
  if (!window.jumpPollingActive || br31GameOver || br31CurrentPlayer !== 1) return;
  fetch('http://localhost:5000/jump_count')
    .then(res => res.json())
    .then(data => {
      const jumpCount = data.count || 0;
      // If jump count increases, update lastJumpTime
      if (jumpCount > 0) {
        if (jumpCount !== lastJumpCount) {
          lastJumpTime = Date.now();
          select('#br31-jumpstatus').html('점프 감지: ' + jumpCount + '회');
        }
      } else {
        select('#br31-jumpstatus').html('');
      }
      // If jump count is nonzero and hasn't changed for 2 seconds, apply the move
      if (jumpCount > 0 && Date.now() - lastJumpTime > 2000) {
        let add = Math.min(jumpCount, 3);
        for (let i = br31Current; i < br31Current + add; i++) {
          br31Owners[i] = 1;
        }
        br31Current += add;
        br31LastMove = add;
        if (br31Current === 31) {
          br31GameOver = true;
        } else {
          br31CurrentPlayer = 2;
          setTimeout(computerMove, 700);
        }
        // Reset jump count on backend
        fetch('http://localhost:5000/reset_jump_count', { method: 'POST' });
        lastJumpCount = 0;
        select('#br31-jumpstatus').html('');
      } else {
        lastJumpCount = jumpCount;
      }
    });
}

function draw() {
  background(240);
  // Center the label using textAlign and bold font
  textAlign(CENTER, TOP);
  textSize(32);
  textStyle(BOLD);
  fill('#333');
  text('AI와 대결하는 BR31 게임!', width/2, 20);

  // Show whose turn it is, centered below the title
  textSize(22);
  textStyle(NORMAL);
  fill('#555');
  if (!br31GameOver) {
    let turnText = br31CurrentPlayer === 1 ? '당신의 차례입니다! (Jump to play)' : 'AI의 차례입니다...';
    text(turnText, width/2, 60);
  } else {
    text('', width/2, 60);
  }

  // Draw 31 boxes
  let startX = 40, startY = 90, boxW = 44, boxH = 44, gap = 14;
  for (let i = 0; i < 31; i++) {
    let x = startX + (i % 10) * (boxW + gap);
    let y = startY + Math.floor(i / 10) * (boxH + gap);
    if (br31Owners[i] === 1) {
      fill('red');
    } else if (br31Owners[i] === 2) {
      fill('blue');
    } else {
      noFill();
    }
    stroke(0);
    rect(x, y, boxW, boxH);
    // Center the number in the box, less bold
    fill(0);
    textSize(18);
    textStyle(NORMAL);
    textAlign(CENTER, CENTER);
    text(i+1, x + boxW/2, y + boxH/2);
  }

  // Update info in HTML instead of drawing with p5.js
  if (!br31GameOver) {
    select('#br31-current').html('Current: ' + br31Current);
    select('#br31-player').html('Player ' + br31CurrentPlayer + ' turn');
    select('#br31-addinfo').html('Press 1, 2, or 3 to add');
    if (br31LastMove > 0) {
      select('#br31-lastmove').html('Last move: +' + br31LastMove);
    } else {
      select('#br31-lastmove').html('');
    }
    select('#br31-winner').html('');
  } else {
    select('#br31-current').html('Current: ' + br31Current);
    select('#br31-player').html('');
    select('#br31-addinfo').html('');
    select('#br31-lastmove').html('');
    select('#br31-winner').html('Player ' + (3-br31CurrentPlayer) + ' wins! Press R to restart');
  }

  // Start polling for jumps if it's the user's turn
  if (!window.jumpPollingActive && !br31GameOver && br31CurrentPlayer === 1) {
    window.jumpPollingActive = true;
    setInterval(pollJumpCount, 300);
  }
}

function br31Owner(idx) {
  // Returns 1 if Player 1, 2 if Player 2 for the idx-th number (0-based)
  let n = 0, turn = 1;
  for (let i = 0; i < br31MoveHistory[0].length + br31MoveHistory[1].length; i++) {
    let move = br31MoveHistory[turn-1][i] || 0;
    for (let j = 0; j < move; j++) {
      if (n === idx) return turn;
      n++;
      if (n > idx) break;
    }
    turn = 3 - turn;
    if (n > idx) break;
  }
  // Fallback: alternate by move
  return (idx % 2) + 1;
}

function computerMove() {
  if (br31GameOver) return;
  // 10% chance to make a random (but valid) move
  let bestMove = 1;
  let r = Math.random();
  let maxAdd = Math.min(3, 31 - br31Current);
  if (r < 0.1) {
    // Random valid move
    bestMove = Math.floor(Math.random() * maxAdd) + 1;
  } else {
    // Game theory: always leave a multiple of 4 to the opponent
    let target = ((Math.floor((br31Current) / 4) + 1) * 4);
    let move = target - br31Current;
    if (move < 1 || move > 3 || br31Current + move > 31) {
      // If not possible, pick max possible (but valid)
      bestMove = maxAdd;
    } else {
      bestMove = move;
    }
  }
  // Mark ownership for each number claimed in this move
  for (let i = br31Current; i < br31Current + bestMove; i++) {
    br31Owners[i] = 2;
  }
  br31Current += bestMove;
  br31LastMove = bestMove;
  if (br31Current === 31) {
    br31GameOver = true;
  } else {
    br31CurrentPlayer = 1;
  }
}

// Remove keyPressed for moves, only allow restart
function keyPressed() {
  if (br31GameOver && (key === 'r' || key === 'R')) {
    setup();
    return;
  }
}
