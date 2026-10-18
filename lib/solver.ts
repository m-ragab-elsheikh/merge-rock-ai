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
// Evaluate four snake orientations instead of forcing the largest tile into
// one fixed corner. These patterns are alternatives, not additive bonuses.
const SNAKE_ORDERS = [
  [15, 14, 13, 12, 8, 9, 10, 11, 7, 6, 5, 4, 0, 1, 2, 3],
  [12, 13, 14, 15, 11, 10, 9, 8, 4, 5, 6, 7, 3, 2, 1, 0],
  [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12],
  [3, 2, 1, 0, 4, 5, 6, 7, 11, 10, 9, 8, 12, 13, 14, 15],
];

let memo = new Map<string, number>();
let nodesVisited = 0;
const MAX_SEARCH_NODES = 30_000;

function getBoardHash(board: Board): string {
  return board.map((row) => row.join(",")).join("|");
}

function evaluateLeaf(board: Board): number {
  if (isGameOver(board)) return GAME_OVER_SCORE;

  // Strongly prefer states from which 10+10 can win on the next player move.
  // This matters at search leaves, where a win may be just beyond the horizon.
  for (const direction of DIRECTIONS) {
    if (applyMove(board, direction).reached11) return WIN_SCORE / 2;
  }

  let smoothness = 0;
  let mergePotential = 0;
  let tenCount = 0;
  let maxTile = 0;
  let maxTileRow = 0;
  let maxTileCol = 0;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const value = board[row][col];
      if (value === 0) continue;

      if (value > maxTile) {
        maxTile = value;
        maxTileRow = row;
        maxTileCol = col;
      }
      if (value === 10) tenCount += 1;

      if (col < 3 && board[row][col + 1] !== 0) {
        const neighbor = board[row][col + 1];
        smoothness -= Math.abs(value - neighbor) * 1_500;
      }

      if (row < 3 && board[row + 1][col] !== 0) {
        const neighbor = board[row + 1][col];
        smoothness -= Math.abs(value - neighbor) * 1_500;
      }
    }
  }

  // Reward equal tiles that can meet after a normal slide. Empty cells do not
  // block a merge, so compare consecutive occupied values in each row/column.
  // Higher-level pairs are worth more because they are closer to the target 11.
  const scoreMergePairs = (values: number[]) => {
    const occupied = values.filter((value) => value !== 0);
    for (let index = 0; index < occupied.length - 1; index++) {
      const current = occupied[index];
      const next = occupied[index + 1];
      if (current !== undefined && current === next) {
        mergePotential += (current + 1) * (current + 1) * 5_000;
      }
    }
  };
  for (let row = 0; row < 4; row++) scoreMergePairs(board[row]);
  for (let col = 0; col < 4; col++) scoreMergePairs(board.map((row) => row[col]));

  // Keep the strongest snake orientation; summing orientations would reward
  // the same tile multiple times and distort the evaluation scale.
  let bestSnake = -Infinity;
  for (const order of SNAKE_ORDERS) {
    let score = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        score += board[row][col] * order[row * 4 + col];
      }
    }
    bestSnake = Math.max(bestSnake, score);
  }
  const snakeBonus = bestSnake * 2_000;

  // Penalize reversals in each row/column. A line can be increasing OR
  // decreasing; only the smaller directional variation is penalized.
  // Empty cells are ignored so gaps do not create artificial gradients.
  let monotonicityPenalty = 0;
  const linePenalty = (values: number[]) => {
    const occupied = values.filter((value) => value !== 0);
    let increasing = 0;
    let decreasing = 0;
    for (let index = 0; index < occupied.length - 1; index++) {
      const current = occupied[index];
      const next = occupied[index + 1];
      if (current === undefined || next === undefined) continue;
      if (next > current) increasing += next - current;
      else decreasing += current - next;
    }
    return Math.min(increasing, decreasing);
  };
  for (let row = 0; row < 4; row++) {
    monotonicityPenalty += linePenalty(board[row]);
  }
  for (let col = 0; col < 4; col++) {
    monotonicityPenalty += linePenalty(board.map((row) => row[col]));
  }

  const emptyBonus = getEmptyCells(board).length * 35_000;
  const tenBonus = tenCount * 180_000;
  const maxTileBonus = maxTile * maxTile * 12_000;
  const cornerBonus =
    maxTile > 0 &&
    ((maxTileRow === 0 || maxTileRow === 3) &&
      (maxTileCol === 0 || maxTileCol === 3))
      ? maxTile * 15_000
      : 0;

  return (
    snakeBonus +
    smoothness +
    mergePotential +
    emptyBonus +
    tenBonus +
    maxTileBonus +
    cornerBonus -
    monotonicityPenalty * 2_000
  );
}

// Depth is measured in complete player turns (move plus random spawn).
// Full chance-node expansion is expensive, so keep the adaptive depth bounded.
function searchDepth(emptyCount: number): number {
  if (emptyCount <= 2) return 4;
  if (emptyCount <= 5) return 3;
  return 2;
}

/**
 * Scores the random spawn that follows a player move.
 * `turnsRemaining` counts complete player turns, including the move that
 * has already happened and the spawn currently being evaluated.
 */
function evaluateSpawn(boardAfterMove: Board, turnsRemaining: number): number {
  const hash = `${getBoardHash(boardAfterMove)}|SPAWN|T${turnsRemaining}`;
  const cached = memo.get(hash);
  if (cached !== undefined) return cached;

  // Bound the search work per recommendation. When the budget is exhausted,
  // still model the current random spawn exactly, but stop expanding deeper turns.
  const expandFutureTurns = nodesVisited++ < MAX_SEARCH_NODES;
  const emptyCells = getEmptyCells(boardAfterMove);
  if (emptyCells.length === 0) {
    const score = evaluateLeaf(boardAfterMove);
    memo.set(hash, score);
    return score;
  }

  let expected = 0;
  const cellProbability = 1 / emptyCells.length;

  for (const cell of emptyCells) {
    for (const spawn of SPAWN_VALUES) {
      const nextBoard = boardAfterMove.map((row) => [...row]) as Board;
      nextBoard[cell.row][cell.col] = spawn.value;

      // Evaluate only after the spawn completes the current turn. If more
      // turns remain, search the next player decision from this new board.
      const value = turnsRemaining <= 1 || !expandFutureTurns
        ? evaluateLeaf(nextBoard)
        : chooseMoveValue(nextBoard, turnsRemaining - 1);
      expected += cellProbability * spawn.probability * value;
    }
  }

  memo.set(hash, expected);
  return expected;
}

/** Chooses the best move with a depth measured in complete turns. */
function chooseMoveValue(board: Board, turnsRemaining: number): number {
  if (turnsRemaining <= 0 || isGameOver(board)) {
    return evaluateLeaf(board);
  }
  if (nodesVisited++ >= MAX_SEARCH_NODES) {
    return evaluateLeaf(board);
  }

  const hash = `${getBoardHash(board)}|T${turnsRemaining}`;
  const cached = memo.get(hash);
  if (cached !== undefined) return cached;

  let best = GAME_OVER_SCORE;
  let foundMove = false;

  for (const direction of DIRECTIONS) {
    const result = applyMove(board, direction);

    if (result.reached11) {
      best = Math.max(best, WIN_SCORE);
      foundMove = true;
      continue;
    }
    if (!result.changed) continue;

    foundMove = true;
    best = Math.max(best, evaluateSpawn(result.newBoard, turnsRemaining));
  }

  const score = foundMove ? best : GAME_OVER_SCORE;
  memo.set(hash, score);
  return score;
}

export function getBestMove(board: Board): SolverResult {
  memo.clear();
  nodesVisited = 0;

  if (isGameOver(board)) {
    return { bestMove: null, isGameOver: true };
  }

  const depth = searchDepth(getEmptyCells(board).length);
  let bestMove: Direction | null = null;
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

    const score = evaluateSpawn(result.newBoard, depth);
    if (score > bestScore) {
      bestScore = score;
      bestMove = direction;
    }
  }

  // No fallback direction: never fabricate UP (or any other move) when every
  // direction is a no-op. The UI can distinguish this from a real suggestion.
  if (bestMove === null) {
    return { bestMove: null, isGameOver: isGameOver(board) };
  }

  return { bestMove, isGameOver: false };
}
