import { Board, Direction, SolverResult, DIRECTIONS, SpawnValue } from "../types";
import { applyMove } from "./merge";
import { isGameOver } from "./gameover";

const SPAWN_VALUES: SpawnValue[] = [1, 2, 3, 4, 5];

const WIN_SCORE = 1_000_000_000;
const GAME_OVER_SCORE = -50_000_000;

// Exponential tile values: 2^v
const POW2 = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

// Super-linear progression score: merging v + v -> v + 1 strictly increases score
const PROGRESSION_SCORE = [
  0,
  40,          // 1
  120,         // 2
  350,         // 3
  1_000,       // 4
  2_800,       // 5
  7_800,       // 6
  21_000,      // 7
  56_000,      // 8
  150_000,     // 9
  420_000,     // 10
];

// Snake path indices (0..15) for all 8 symmetries of a 4x4 board.
const SNAKE_PATHS: number[][] = (() => {
  const basePath = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
  const paths: number[][] = [];

  for (const flipR of [false, true]) {
    for (const flipC of [false, true]) {
      for (const transpose of [false, true]) {
        const mapped = basePath.map((idx) => {
          const r = Math.floor(idx / 4);
          const c = idx % 4;
          const rr = flipR ? 3 - r : r;
          const cc = flipC ? 3 - c : c;
          return transpose ? cc * 4 + rr : rr * 4 + cc;
        });
        paths.push(mapped);
      }
    }
  }
  return paths;
})();

const STEP_WEIGHT = [
  16, 12, 9, 6.8,
  5.0, 3.8, 2.9, 2.2,
  1.6, 1.2, 0.9, 0.65,
  0.45, 0.3, 0.2, 0.1,
];

const SNAKE_WEIGHT_TABLES: number[][] = SNAKE_PATHS.map((path) => {
  const table = new Array<number>(16).fill(0);
  for (let step = 0; step < 16; step++) {
    table[path[step]] = STEP_WEIGHT[step];
  }
  return table;
});

let memo = new Map<string, number>();
let nodesVisited = 0;
let evaluationsVisited = 0;
let budgetExhaustions = 0;
let completedDepth = 0;
let rootCandidateCount = 0;
let activeCandidateNodes = 0;
let activeCandidateEvaluations = 0;
let globalNodeLimit = 5_000;
let globalEvalLimit = 25_000;
let lastBudgetLimit: "nodes" | "evaluations" | null = null;
let lastExhaustedCandidate: Direction | null = null;
const MAX_NODES_PER_CANDIDATE = 5_000;
const MAX_EVALS_PER_CANDIDATE = 25_000;
const DEFAULT_SEARCH_NODES = 5_000;
const DEFAULT_SEARCH_EVALS = 25_000;
const SEARCH_BUDGET_EXHAUSTED = Symbol("SEARCH_BUDGET_EXHAUSTED");

type RootCandidateDiagnostic = {
  direction: Direction;
  initialScore: number;
  completedScore: number | null;
  completedDepth: number;
  nodesUsed: number;
  evaluationsUsed: number;
};
let rootCandidateDiagnostics: RootCandidateDiagnostic[] = [];

export function getSolverSearchStats() {
  return {
    completedDepth,
    budgetExhaustions,
    nodesVisited,
    evaluationsVisited,
    rootCandidateCount,
    nodesPerCandidateLimit: MAX_NODES_PER_CANDIDATE,
    evaluationsPerCandidateLimit: MAX_EVALS_PER_CANDIDATE,
    maxSearchNodes: globalNodeLimit,
    maxSearchEvals: globalEvalLimit,
    lastBudgetLimit,
    lastExhaustedCandidate,
    rootCandidates: rootCandidateDiagnostics.map((candidate) => ({ ...candidate })),
  };
}

function hashGrid(g: number[]): string {
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += g[i].toString(16);
  }
  return s;
}

export function boardToFlat(board: Board): number[] {
  const g = new Array<number>(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      g[r * 4 + c] = board[r][c];
    }
  }
  return g;
}

// Ultra-fast 1D move simulation matching lib/merge.ts rules exactly
function slideLine(
  g: number[],
  i0: number,
  i1: number,
  i2: number,
  i3: number,
  out: number[]
): { changed: boolean; reached11: boolean } {
  const v0 = g[i0];
  const v1 = g[i1];
  const v2 = g[i2];
  const v3 = g[i3];

  const nonZero: number[] = [];
  if (v0 !== 0) nonZero.push(v0);
  if (v1 !== 0) nonZero.push(v1);
  if (v2 !== 0) nonZero.push(v2);
  if (v3 !== 0) nonZero.push(v3);

  let reached11 = false;
  const merged: number[] = [];

  for (let idx = 0; idx < nonZero.length; idx++) {
    const curr = nonZero[idx];
    const next = nonZero[idx + 1];
    if (curr !== undefined && curr === next) {
      if (curr === 10) {
        reached11 = true;
      } else {
        merged.push(curr + 1);
      }
      idx += 1;
    } else if (curr !== undefined) {
      merged.push(curr);
    }
  }

  const n0 = merged[0] ?? 0;
  const n1 = merged[1] ?? 0;
  const n2 = merged[2] ?? 0;
  const n3 = merged[3] ?? 0;

  out[i0] = n0;
  out[i1] = n1;
  out[i2] = n2;
  out[i3] = n3;

  const changed = n0 !== v0 || n1 !== v1 || n2 !== v2 || n3 !== v3;
  return { changed, reached11 };
}

export function simulateFlatMove(
  g: number[],
  dir: Direction
): { next: number[]; changed: boolean; reached11: boolean } {
  const next = new Array<number>(16);
  let changed = false;
  let reached11 = false;

  for (let line = 0; line < 4; line++) {
    let res: { changed: boolean; reached11: boolean };
    if (dir === "LEFT") {
      const b = line * 4;
      res = slideLine(g, b, b + 1, b + 2, b + 3, next);
    } else if (dir === "RIGHT") {
      const b = line * 4;
      res = slideLine(g, b + 3, b + 2, b + 1, b, next);
    } else if (dir === "UP") {
      res = slideLine(g, line, line + 4, line + 8, line + 12, next);
    } else {
      res = slideLine(g, line + 12, line + 8, line + 4, line, next);
    }
    if (res.changed) changed = true;
    if (res.reached11) reached11 = true;
  }

  return { next, changed, reached11 };
}

function evaluateFlatBoard(g: number[]): number {
  if (evaluationsVisited >= globalEvalLimit || activeCandidateEvaluations >= MAX_EVALS_PER_CANDIDATE) {
    lastBudgetLimit = "evaluations";
    throw SEARCH_BUDGET_EXHAUSTED;
  }
  evaluationsVisited += 1;
  activeCandidateEvaluations += 1;

  let emptyCount = 0;
  let progression = 0;
  let smoothness = 0;
  let trappedPenalty = 0;

  let tenCount = 0;
  let nineCount = 0;
  let eightCount = 0;
  let sevenCount = 0;

  for (let i = 0; i < 16; i++) {
    const v = g[i];
    if (v === 0) {
      emptyCount += 1;
      continue;
    }

    progression += PROGRESSION_SCORE[v];
    if (v === 10) tenCount += 1;
    else if (v === 9) nineCount += 1;
    else if (v === 8) eightCount += 1;
    else if (v === 7) sevenCount += 1;

    const r = i >> 2;
    const c = i & 3;

    if (c < 3) {
      const right = g[i + 1];
      if (right !== 0) {
        if (right === v) {
          smoothness += PROGRESSION_SCORE[v] * 0.45;
        } else {
          smoothness -= Math.abs(POW2[v] - POW2[right]) * 6;
        }
      }
    }
    if (r < 3) {
      const down = g[i + 4];
      if (down !== 0) {
        if (down === v) {
          smoothness += PROGRESSION_SCORE[v] * 0.45;
        } else {
          smoothness -= Math.abs(POW2[v] - POW2[down]) * 6;
        }
      }
    }

    // Check if this tile is a trapped blocker surrounded by higher tiles
    let minSurrounding = 99;
    let blockedSides = 0;
    if (r > 0) {
      const up = g[i - 4];
      if (up > v + 1) {
        blockedSides += 1;
        if (up < minSurrounding) minSurrounding = up;
      }
    } else {
      blockedSides += 1;
    }
    if (r < 3) {
      const dn = g[i + 4];
      if (dn > v + 1) {
        blockedSides += 1;
        if (dn < minSurrounding) minSurrounding = dn;
      }
    } else {
      blockedSides += 1;
    }
    if (c > 0) {
      const lt = g[i - 1];
      if (lt > v + 1) {
        blockedSides += 1;
        if (lt < minSurrounding) minSurrounding = lt;
      }
    } else {
      blockedSides += 1;
    }
    if (c < 3) {
      const rt = g[i + 1];
      if (rt > v + 1) {
        blockedSides += 1;
        if (rt < minSurrounding) minSurrounding = rt;
      }
    } else {
      blockedSides += 1;
    }

    if (blockedSides >= 3 && minSurrounding <= 10) {
      trappedPenalty += (POW2[minSurrounding] - POW2[v]) * (blockedSides === 4 ? 35 : 16);
    }
  }

  let mergeScore = 0;
  let availableMergeCount = 0;
  let monoPenalty = 0;
  let directTenMergeAvailable = false;

  const evalLine = (i0: number, i1: number, i2: number, i3: number) => {
    const line = [g[i0], g[i1], g[i2], g[i3]];
    let prev = 0;
    let inc = 0;
    let dec = 0;

    for (let k = 0; k < 4; k++) {
      const cur = line[k];
      if (cur === 0) continue;
      if (prev !== 0) {
        if (cur === prev) {
          availableMergeCount += 1;
          if (cur === 10) {
            directTenMergeAvailable = true;
            mergeScore += 45_000_000;
          } else {
            mergeScore += PROGRESSION_SCORE[cur] * 0.85 + 8_000;
          }
          prev = 0;
          continue;
        } else {
          const diff = Math.abs(cur - prev);
          if (diff === 1) {
            mergeScore += PROGRESSION_SCORE[Math.max(cur, prev)] * 0.25;
          }
          const pPrev = POW2[prev];
          const pCur = POW2[cur];
          if (pCur > pPrev) inc += pCur - pPrev;
          else dec += pPrev - pCur;
        }
      }
      prev = cur;
    }

    monoPenalty += Math.min(inc, dec);
  };

  for (let l = 0; l < 4; l++) {
    const b = l * 4;
    evalLine(b, b + 1, b + 2, b + 3);
    evalLine(l, l + 4, l + 8, l + 12);
  }

  if (emptyCount === 0 && availableMergeCount === 0) {
    return GAME_OVER_SCORE;
  }

  let bestSnakeScore = -Infinity;
  for (let p = 0; p < 8; p++) {
    const table = SNAKE_WEIGHT_TABLES[p];
    const path = SNAKE_PATHS[p];
    let s = 0;
    for (let i = 0; i < 16; i++) {
      const v = g[i];
      if (v !== 0) {
        s += POW2[v] * table[i];
      }
    }
    const head0 = g[path[0]];
    const head1 = g[path[1]];
    const head2 = g[path[2]];
    if (head0 >= 7) {
      if (head1 > 0 && head0 >= head1 && head0 - head1 <= 2) {
        s += POW2[head1] * 8;
        if (head2 > 0 && head1 >= head2 && head1 - head2 <= 2) {
          s += POW2[head2] * 5;
        }
      }
    }
    if (s > bestSnakeScore) bestSnakeScore = s;
  }

  const snakeBonus = bestSnakeScore * 3;

  // Survival & mobility scoring: crucial for 1..5 spawn survival
  const emptyBonus =
    emptyCount * 55_000 +
    emptyCount * emptyCount * 5_500 +
    availableMergeCount * 24_000 -
    (emptyCount <= 2 && availableMergeCount === 0 ? 350_000 : 0) -
    (emptyCount === 1 && availableMergeCount <= 1 ? 200_000 : 0);

  // High-tile stepping stones toward Merge 11
  let synergy = 0;
  if (directTenMergeAvailable) {
    synergy += 500_000_000;
  } else if (tenCount >= 2) {
    synergy += 300_000_000;
  } else if (tenCount === 1) {
    synergy += 50_000_000;
    if (nineCount >= 2) synergy += 100_000_000;
    else if (nineCount === 1 && eightCount >= 2) synergy += 60_000_000;
    else if (nineCount === 1 && eightCount === 1) synergy += 40_000_000;
    else if (nineCount === 1) synergy += 25_000_000 + sevenCount * 2_000_000;
    else synergy += eightCount * 5_000_000;
  } else if (nineCount >= 2) {
    synergy += 20_000_000;
  }

  return (
    progression +
    snakeBonus +
    smoothness +
    mergeScore +
    emptyBonus +
    synergy -
    monoPenalty * 10 -
    trappedPenalty
  );
}

function searchChanceNode(g: number[], depthRemaining: number): number {
  if (nodesVisited >= globalNodeLimit || activeCandidateNodes >= MAX_NODES_PER_CANDIDATE) {
    lastBudgetLimit = "nodes";
    throw SEARCH_BUDGET_EXHAUSTED;
  }
  nodesVisited += 1;
  activeCandidateNodes += 1;

  // At leaf level (depthRemaining <= 1), evaluate the post-move state directly
  // or with lightweight sampling so we don't blow 40x evals on a single leaf.
  if (depthRemaining <= 1) {
    return evaluateFlatBoard(g);
  }

  const emptyIndices: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (g[i] === 0) emptyIndices.push(i);
  }

  const numEmpty = emptyIndices.length;
  if (numEmpty === 0) {
    return evaluateFlatBoard(g);
  }

  const hash = `${hashGrid(g)}|C${depthRemaining}`;
  const cached = memo.get(hash);
  if (cached !== undefined) return cached;

  // When many cells are empty at deep levels, stride-sample empty cells deterministically
  // so the solver can complete deeper plies within the 5,000-node / 25,000-eval budget.
  let cellsToTest = emptyIndices;
  if (numEmpty > 6 && depthRemaining >= 3) {
    cellsToTest = [];
    const step = numEmpty / 6;
    for (let k = 0; k < 6; k++) {
      cellsToTest.push(emptyIndices[Math.floor(k * step)]);
    }
  }

  // Representative spawns: when board is open and depth is high, test [1, 3, 5] (low, mid, high);
  // when board is tight (numEmpty <= 4), test all [1, 2, 3, 4, 5] for exact tactical survival.
  const spawnList: readonly number[] =
    numEmpty <= 4 ? SPAWN_VALUES : [1, 3, 5];

  const weight = 1 / (cellsToTest.length * spawnList.length);
  let expected = 0;

  for (let e = 0; e < cellsToTest.length; e++) {
    const cellIdx = cellsToTest[e];
    for (let s = 0; s < spawnList.length; s++) {
      g[cellIdx] = spawnList[s];
      expected += weight * searchMaxNode(g, depthRemaining - 1);
    }
    g[cellIdx] = 0;
  }

  memo.set(hash, expected);
  return expected;
}

function searchMaxNode(g: number[], depthRemaining: number): number {
  if (nodesVisited >= globalNodeLimit || activeCandidateNodes >= MAX_NODES_PER_CANDIDATE) {
    lastBudgetLimit = "nodes";
    throw SEARCH_BUDGET_EXHAUSTED;
  }
  nodesVisited += 1;
  activeCandidateNodes += 1;

  if (depthRemaining <= 0) {
    return evaluateFlatBoard(g);
  }

  const hash = `${hashGrid(g)}|M${depthRemaining}`;
  const cached = memo.get(hash);
  if (cached !== undefined) return cached;

  let best = GAME_OVER_SCORE;
  let hasLegalMove = false;

  for (let d = 0; d < 4; d++) {
    const dir = DIRECTIONS[d];
    const sim = simulateFlatMove(g, dir);
    if (sim.reached11) {
      memo.set(hash, WIN_SCORE);
      return WIN_SCORE;
    }
    if (!sim.changed) continue;

    hasLegalMove = true;
    const val = searchChanceNode(sim.next, depthRemaining);
    if (val > best) best = val;
  }

  const result = hasLegalMove ? best : GAME_OVER_SCORE;
  memo.set(hash, result);
  return result;
}

function getAdaptiveDepth(emptyCount: number): number {
  // Preserve the current search policy: only boards with <= 3 empty cells reach depth 4.
  return emptyCount <= 3 ? 4 : 3;
}

export function getBestMove(board: Board): SolverResult {
  budgetExhaustions = 0;
  completedDepth = 0;
  nodesVisited = 0;
  evaluationsVisited = 0;
  rootCandidateCount = 0;
  activeCandidateNodes = 0;
  activeCandidateEvaluations = 0;
  globalNodeLimit = DEFAULT_SEARCH_NODES;
  globalEvalLimit = DEFAULT_SEARCH_EVALS;
  lastBudgetLimit = null;
  lastExhaustedCandidate = null;
  rootCandidateDiagnostics = [];

  if (isGameOver(board)) {
    return { bestMove: null, isGameOver: true };
  }

  const flat = boardToFlat(board);
  let emptyCount = 0;
  for (let i = 0; i < 16; i++) {
    if (flat[i] === 0) emptyCount += 1;
  }

  const candidates: Array<{
    direction: Direction;
    nextFlat: number[];
    initialScore: number;
  }> = [];

  for (const direction of DIRECTIONS) {
    const result = applyMove(board, direction);
    // Priority 1: Any move that immediately reaches Merge 11 wins on the spot
    if (result.reached11) {
      completedDepth = 1;
      rootCandidateCount = 1;
      globalNodeLimit = MAX_NODES_PER_CANDIDATE;
      globalEvalLimit = MAX_EVALS_PER_CANDIDATE;
      rootCandidateDiagnostics = [{
        direction,
        initialScore: WIN_SCORE,
        completedScore: WIN_SCORE,
        completedDepth: 1,
        nodesUsed: 0,
        evaluationsUsed: 0,
      }];
      return { bestMove: direction, isGameOver: false };
    }
    if (result.changed) {
      const nextFlat = boardToFlat(result.newBoard);
      candidates.push({
        direction,
        nextFlat,
        initialScore: evaluateFlatBoard(nextFlat),
      });
    }
  }

  rootCandidateCount = candidates.length;
  rootCandidateDiagnostics = candidates.map((candidate) => ({
    direction: candidate.direction,
    initialScore: candidate.initialScore,
    completedScore: null,
    completedDepth: 1,
    nodesUsed: 0,
    evaluationsUsed: 0,
  }));
  if (candidates.length === 0) {
    return { bestMove: null, isGameOver: isGameOver(board) };
  }
  // Global budget is allocated per root candidate and iterative-deepening level.

  // Sort candidates descending by their immediate heuristic evaluation (Move Ordering)
  candidates.sort((a, b) => b.initialScore - a.initialScore);

  if (candidates.length === 1) {
    completedDepth = 1;
    return { bestMove: candidates[0].direction, isGameOver: false };
  }

  const maxDepth = getAdaptiveDepth(emptyCount);
  globalNodeLimit = MAX_NODES_PER_CANDIDATE * candidates.length * (maxDepth - 1);
  globalEvalLimit = MAX_EVALS_PER_CANDIDATE * candidates.length * (maxDepth - 1);
  let bestMove: Direction = candidates[0].direction;
  completedDepth = 1; // Depth 1 (immediate evaluation of all candidates) is already completed!

  memo.clear();
  // Iterative deepening starting from depth 2 (which includes spawn + player response).
  // Each root candidate receives a fresh per-level node/evaluation budget, so work spent on
  // a shallower iteration cannot consume its allowance at a deeper iteration. The total call
  // budget scales with legal root moves and the number of iterative-deepening levels.
  for (let depth = 2; depth <= maxDepth; depth++) {
    let depthBestMove: Direction = candidates[0].direction;
    let depthBestScore = -Infinity;
    let depthCompleted = true;
    const depthScores = new Map<Direction, number>();

    for (const candidate of candidates) {
      activeCandidateNodes = 0;
      activeCandidateEvaluations = 0;
      try {
        const score = searchChanceNode(candidate.nextFlat.slice(), depth);
        depthScores.set(candidate.direction, score);
        if (score > depthBestScore) {
          depthBestScore = score;
          depthBestMove = candidate.direction;
        }
      } catch (error) {
        if (error !== SEARCH_BUDGET_EXHAUSTED) throw error;
        budgetExhaustions += 1;
        lastExhaustedCandidate = candidate.direction;
        depthCompleted = false;
        break;
      } finally {
        const diagnostic = rootCandidateDiagnostics.find((item) => item.direction === candidate.direction);
        if (diagnostic) {
          diagnostic.nodesUsed = activeCandidateNodes;
          diagnostic.evaluationsUsed = activeCandidateEvaluations;
        }
      }
    }

    if (!depthCompleted) break;

    completedDepth = depth;
    bestMove = depthBestMove;

    // Save scores only after every root candidate completed the same depth.
    for (const candidate of candidates) {
      const diagnostic = rootCandidateDiagnostics.find((item) => item.direction === candidate.direction);
      if (diagnostic) {
        diagnostic.completedScore = depthScores.get(candidate.direction) ?? null;
        diagnostic.completedDepth = depth;
      }
    }

    // Re-order candidates based on the latest completed depth to keep best move first
    candidates.sort((a, b) =>
      a.direction === bestMove ? -1 : b.direction === bestMove ? 1 : 0
    );
  }

  return { bestMove, isGameOver: false };
}
