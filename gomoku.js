// gomoku.js
// Simple p5.js Gomoku board (player vs. player, no AI yet)
let board;
let currentPlayer;
const SIZE = 15;
const CELL = 40;
const MARGIN = 40;
let gameOver = false;

function setup() {
  let canvas = createCanvas(SIZE * CELL + MARGIN * 2, SIZE * CELL + MARGIN * 2);
  canvas.parent('gomokuBoard');
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  currentPlayer = 1; // 1: black, 2: white
  gameOver = false;
  updateStatus();
}

function draw() {
  background(240);
  drawBoard();
  drawStones();
}

function mousePressed() {
  if (gameOver) return;
  const x = Math.round((mouseX - MARGIN) / CELL);
  const y = Math.round((mouseY - MARGIN) / CELL);
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE && board[y][x] === 0) {
    // For black, check forbidden (33) rule
    if (currentPlayer === 1 && isForbidden33(x, y)) {
      // Optionally, show a message or sound
      return;
    }
    board[y][x] = currentPlayer;
    if (checkWin(x, y, currentPlayer)) {
      gameOver = true;
      document.getElementById('gomokuStatus').textContent = (currentPlayer === 1 ? '흑돌(●)' : '백돌(○)') + ' 승리!';
    } else {
      currentPlayer = 3 - currentPlayer;
      updateStatus();
      if (currentPlayer === 2 && !gameOver) {
        computerRandomMove();
      }
    }
  }
}

function isForbidden33(x, y) {
  // Simulate placing black stone at (x, y)
  board[y][x] = 1;
  let openThrees = countOpenThrees(x, y, 1);
  board[y][x] = 0;
  return openThrees >= 2;
}

function countOpenThrees(x, y, player) {
  // Count the number of open three patterns created by placing at (x, y)
  let count = 0;
  const dirs = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  for (let [dx, dy] of dirs) {
    if (isOpenThree(x, y, dx, dy, player)) count++;
    if (isOpenThree(x, y, -dx, -dy, player)) count++;
  }
  return count;
}

function isOpenThree(x, y, dx, dy, player) {
  // Check for open three in one direction
  let line = '';
  for (let i = -4; i <= 4; i++) {
    let nx = x + dx * i, ny = y + dy * i;
    if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) {
      line += '2'; // treat out of bounds as opponent
    } else if (board[ny][nx] === player) {
      line += '1';
    } else if (board[ny][nx] === 0 && !(nx === x && ny === y)) {
      line += '0';
    } else {
      line += '2';
    }
  }
  // Open three pattern: 010110, 011010, 0100110, etc.
  // We'll use regex to match open three patterns
  return /010110|011010|0100110|0110010|0101010/.test(line);
}

function computerRandomMove() {
  // 1. Try to win if possible (4 in a row for computer)
  let winMove = findCriticalMove(2, 4);
  if (winMove) {
    placeComputerStone(winMove.x, winMove.y);
    return;
  }
  // 2. Block if player is about to win (4 in a row)
  let blockMove = findCriticalMove(1, 4);
  if (blockMove) {
    placeComputerStone(blockMove.x, blockMove.y);
    return;
  }
  // 3. Try to create open threes (offensive)
  let openThreeMove = findOpenThreeMove(2);
  if (openThreeMove) {
    placeComputerStone(openThreeMove.x, openThreeMove.y);
    return;
  }
  // 4. Otherwise, pick a random empty cell
  let empty = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === 0) empty.push({x, y});
    }
  }
  if (empty.length === 0) return;
  let idx = Math.floor(Math.random() * empty.length);
  let {x, y} = empty[idx];
  placeComputerStone(x, y);
}

function findOpenThreeMove(player) {
  // Look for a move that creates an open three for 'player'
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== 0) continue;
      board[y][x] = player;
      if (countOpenThrees(x, y, player) > 0) {
        board[y][x] = 0;
        return {x, y};
      }
      board[y][x] = 0;
    }
  }
  return null;
}

function findCriticalMove(player, n) {
  // Look for a move that creates n in a row for 'player' (block or win)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== 0) continue;
      board[y][x] = player;
      if (countInRow(x, y, player) >= n) {
        board[y][x] = 0;
        return {x, y};
      }
      board[y][x] = 0;
    }
  }
  return null;
}

function countInRow(x, y, player) {
  // Check all 4 directions for max consecutive stones including (x, y)
  const dirs = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  let maxCount = 1;
  for (let [dx, dy] of dirs) {
    let count = 1;
    for (let d = 1; d < 5; d++) {
      let nx = x + dx * d, ny = y + dy * d;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || board[ny][nx] !== player) break;
      count++;
    }
    for (let d = 1; d < 5; d++) {
      let nx = x - dx * d, ny = y - dy * d;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || board[ny][nx] !== player) break;
      count++;
    }
    if (count > maxCount) maxCount = count;
  }
  return maxCount;
}

function placeComputerStone(x, y) {
  board[y][x] = 2;
  if (checkWin(x, y, 2)) {
    gameOver = true;
    document.getElementById('gomokuStatus').textContent = '백돌(○) 승리!';
  } else {
    currentPlayer = 1;
    updateStatus();
  }
}

// Minimax and evaluation helpers
function minimax(board, depth, isMax, alpha, beta) {
  let winner = getWinner(board);
  if (winner === 2) return 100000 + depth;
  if (winner === 1) return -100000 - depth;
  if (depth === 0 || isFull(board)) return evaluate(board);

  if (isMax) {
    let maxEval = -Infinity;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (board[y][x] === 0) {
          board[y][x] = 2;
          let evalScore = minimax(board, depth - 1, false, alpha, beta);
          board[y][x] = 0;
          maxEval = Math.max(maxEval, evalScore);
          alpha = Math.max(alpha, evalScore);
          if (beta <= alpha) break;
        }
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (board[y][x] === 0) {
          board[y][x] = 1;
          let evalScore = minimax(board, depth - 1, true, alpha, beta);
          board[y][x] = 0;
          minEval = Math.min(minEval, evalScore);
          beta = Math.min(beta, evalScore);
          if (beta <= alpha) break;
        }
      }
    }
    return minEval;
  }
}

function getWinner(board) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== 0 && checkWin(x, y, board[y][x])) {
        return board[y][x];
      }
    }
  }
  return 0;
}

function isFull(board) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === 0) return false;
    }
  }
  return true;
}

function evaluate(board) {
  // Simple evaluation: count open 2, 3, 4 for both players
  let score = 0;
  score += countOpen(board, 2, 2) * 100;
  score += countOpen(board, 2, 3) * 1000;
  score += countOpen(board, 2, 4) * 10000;
  score -= countOpen(board, 1, 2) * 100;
  score -= countOpen(board, 1, 3) * 1000;
  score -= countOpen(board, 1, 4) * 10000;
  return score;
}

function countOpen(board, player, n) {
  let count = 0;
  const dirs = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== player) continue;
      for (let [dx, dy] of dirs) {
        let ok = true;
        for (let k = 1; k < n; k++) {
          let nx = x + dx * k, ny = y + dy * k;
          if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || board[ny][nx] !== player) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        // Check open ends
        let px = x - dx, py = y - dy;
        let qx = x + dx * n, qy = y + dy * n;
        if (
          px >= 0 && px < SIZE && py >= 0 && py < SIZE && board[py][px] === 0 &&
          qx >= 0 && qx < SIZE && qy >= 0 && qy < SIZE && board[qy][qx] === 0
        ) {
          count++;
        }
      }
    }
  }
  return count;
}

function drawBoard() {
  stroke(0);
  for (let i = 0; i < SIZE; i++) {
    line(MARGIN, MARGIN + i * CELL, MARGIN + (SIZE - 1) * CELL, MARGIN + i * CELL);
    line(MARGIN + i * CELL, MARGIN, MARGIN + i * CELL, MARGIN + (SIZE - 1) * CELL);
  }
  // Highlight forbidden (33) spots for black
  if (!gameOver && currentPlayer === 1) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (board[y][x] === 0 && isForbidden33(x, y)) {
          noFill();
          stroke(255,0,0);
          strokeWeight(3);
          rect(MARGIN + x * CELL - CELL*0.4, MARGIN + y * CELL - CELL*0.4, CELL*0.8, CELL*0.8);
          strokeWeight(1);
        }
      }
    }
    stroke(0);
  }
}

function drawStones() {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== 0) {
        fill(board[y][x] === 1 ? 0 : 255);
        stroke(0);
        ellipse(MARGIN + x * CELL, MARGIN + y * CELL, CELL * 0.8);
      }
    }
  }
}

function updateStatus() {
  document.getElementById('gomokuStatus').textContent = '플레이어: ' + (currentPlayer === 1 ? '흑돌(●)' : '백돌(○)') + ' 차례';
}

function checkWin(x, y, player) {
  const dirs = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  for (let [dx, dy] of dirs) {
    let count = 1;
    for (let d = 1; d < 5; d++) {
      let nx = x + dx * d, ny = y + dy * d;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || board[ny][nx] !== player) break;
      count++;
    }
    for (let d = 1; d < 5; d++) {
      let nx = x - dx * d, ny = y - dy * d;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || board[ny][nx] !== player) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}
