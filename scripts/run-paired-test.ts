import { getBestMove } from "../lib/solver";
import { applyMove } from "../lib/merge";
import { Board } from "../types";

class PRNG {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) % 4294967296;
    return this.s / 4294967296;
  }
}

function spawnTile(board: Board, rng: PRNG, isLate: boolean): boolean {
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return false;
  const [r, c] = empty[Math.floor(rng.next() * empty.length)];
  
  const roll = rng.next();
  let val = 1;
  if (!isLate) {
    if (roll < 0.719) val = 1;
    else if (roll < 0.719 + 0.214) val = 2;
    else if (roll < 0.719 + 0.214 + 0.049) val = 3;
    else val = 4;
  } else {
    if (roll < 0.13) val = 1;
    else if (roll < 0.13 + 0.67) val = 2;
    else if (roll < 0.13 + 0.67 + 0.10) val = 3;
    else if (roll < 0.13 + 0.67 + 0.10 + 0.05) val = 4;
    else val = 5;
  }
  board[r][c] = val as any;
  return true;
}

function runGame(seed: number) {
  const rng = new PRNG(seed);
  const board: Board = [
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 0],
  ];

  let moves = 0;
  let reached11 = false;
  let hasReached10 = false;

  while (moves < 1200) {
    if (board.some(row => row.includes(10))) hasReached10 = true;

    const res = getBestMove(board, hasReached10);
    if (!res.bestMove || res.isGameOver) break;

    const moveRes = applyMove(board, res.bestMove);
    if (moveRes.reached11) {
      reached11 = true;
      break;
    }
    if (!moveRes.changed) break;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) board[r][c] = moveRes.newBoard[r][c];
    }
    moves++;

    if (!spawnTile(board, rng, hasReached10)) break;
  }

  const maxTile = Math.max(...board.flat());
  return { reached11, moves, maxTile };
}

async function main() {
  const seeds = Array.from({ length: 40 }, (_, i) => 2001 + i);
  let wins = 0;

  console.log("Running solver benchmark on 40 seeds...\n");

  for (const seed of seeds) {
    const res = runGame(seed);
    if (res.reached11) wins++;

    console.log(`Seed ${seed}: ${res.reached11 ? "WIN (11)" : `Max ${res.maxTile}`} (${res.moves} moves)`);
  }

  console.log("\n=================================");
  console.log(`Solver Score: ${wins}/40 wins (${((wins / 40) * 100).toFixed(1)}%)`);
  console.log("=================================");
}

main();