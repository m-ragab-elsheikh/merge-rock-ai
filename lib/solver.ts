import { Board, Direction, SolverResult, DIRECTIONS, SpawnValue } from "@/types";
import { applyMove } from "./merge";
import { isGameOver } from "./gameover";
import { getEmptyCells } from "./board";

const SPAWN_VALUES: Array<{ value: SpawnValue; probability: number }> = [
  { value: 1, probability: 0.2 },
  { value: 2, probability: 0.2 },
  { value: 3, probability: 0.2 },
  { value: 4, probability: 0.2 },
  { value: 5, probability: 0.2 },
];

const WIN_SCORE = 1_000_000_000;
const GAME_OVER_SCORE = -1_000_000_000;
const WEIGHT_MATRIX = [
  [15, 14, 13, 12],
  [8, 9, 10, 11],
  [7, 6, 5, 4],
  [0, 1, 2, 3],
];

let memo = new Map<string, number>();

function getBoardHash(board: Board): string {
  return board.map((row) => row.join(",")).join("|");
}

function evaluateLeaf(board: Board): number {
  if (isGameOver(board)) return GAME_OVER_SCORE;

  let positional = 0;
  let smoothness = 0;
  let mergePotential = 0;
  let tenCount = 0;
  let maxTile = 0;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const value = board[row][col];
      if (value === 0) continue;

      maxTile = Math.max(maxTile, value);
      positional += value * WEIGHT_MATRIX[row][col] * 200;
      if (value === 10) tenCount += 1;

      if (col < 3 && board[row][col + 1] !== 0) {
        const neighbor = board[row][col + 1];
        smoothness -= Math.abs(value - neighbor) * 1_500;
        if (value === neighbor) mergePotential += value * 25_000;
      }

      if (row < 3 && board[row + 1][col] !== 0) {
        const neighbor = board[row + 1][col];
        smoothness -= Math.abs(value - neighbor) * 1_500;
        if (value === neighbor) mergePotential += value * 25_000;
      }
    }
  }

  const emptyBonus = getEmptyCells(board).length * 35_000;
  const tenBonus = tenCount * 180_000;
  const maxTileBonus = maxTile * maxTile * 12_000;

  return positional + smoothness + mergePotential + emptyBonus + tenBonus + maxTileBonus;
}

function searchDepth(emptyCount: number): number {
  if (emptyCount <= 2) return 5;
  if (emptyCount <= 5) return 4;
  return 3;
}

function expectimax(board: Board, depth: number, maximizing: boolean): number {
  const hash = `${getBoardHash(board)}|${depth}|${maximizing ? "MAX" : "CHANCE"}`;
  const cached = memo.get(hash);
  if (cached !== undefined) return cached;

  if (depth === 0) {
    const score = evaluateLeaf(board);
    memo.set(hash, score);
    return score;
  }

  if (maximizing) {
    let best = GAME_OVER_SCORE;

    for (const direction of DIRECTIONS) {
      const result = applyMove(board, direction);

      if (result.reached11) {
        best = Math.max(best, WIN_SCORE);
        continue;
      }

      // The assistant should never recommend a direction that does not change
      // the board. Failed moves are valid user actions and still consume a turn
      // in the real game, but they are not candidates for the recommended move
      // while at least one real move exists.
      if (!result.changed) continue;

      best = Math.max(best, expectimax(result.newBoard, depth - 1, false));
    }

    memo.set(hash, best);
    return best;
  }

  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) {
    const score = evaluateLeaf(board);
    memo.set(hash, score);
    return score;
  }

  let expected = 0;
  const cellProbability = 1 / emptyCells.length;

  for (const cell of emptyCells) {
    for (const spawn of SPAWN_VALUES) {
      const nextBoard = board.map((row) => [...row]) as Board;
      nextBoard[cell.row][cell.col] = spawn.value;
      expected +=
        cellProbability * spawn.probability * expectimax(nextBoard, depth - 1, true);
    }
  }

  memo.set(hash, expected);
  return expected;
}

export function getBestMove(board: Board): SolverResult {
  memo.clear();

  if (isGameOver(board)) {
    return { bestMove: "UP", isGameOver: true };
  }

  const depth = searchDepth(getEmptyCells(board).length);
  let bestMove: Direction = "UP";
  let bestScore = -Infinity;

  for (const direction of DIRECTIONS) {
    const result = applyMove(board, direction);

    if (result.reached11) {
      return { bestMove: direction, isGameOver: false };
    }

    // Never recommend a no-op direction. It remains a legal manual action
    // that consumes a turn in the actual game, but it should not be selected
    // by the assistant when a direction can actually move or merge tiles.
    if (!result.changed) continue;

    const score = expectimax(result.newBoard, depth - 1, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = direction;
    }
  }

  return { bestMove, isGameOver: false };
}
