import { Board, Direction, SolverResult, DIRECTIONS, SpawnValue } from "../types";
import { applyMove } from "./merge";
import { isGameOver } from "./gameover";

const SPAWN_VALUES: SpawnValue[] = [1, 2, 3, 4, 5];

const PRE10_SPAWN_COUNTS = [557, 163, 38, 11, 0] as const;
const POST10_SPAWN_COUNTS = [57, 294, 45, 23, 20] as const;
function probabilitiesFromCounts(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0) + counts.length;
  return counts.map((count) => (count + 1) / total);
}
const PRE10_SPAWN_PROBS = probabilitiesFromCounts(PRE10_SPAWN_COUNTS);
const POST10_SPAWN_PROBS = probabilitiesFromCounts(POST10_SPAWN_COUNTS);

function containsTen(g: readonly number[]): boolean {
  return g.some((value) => value === 10);
}

// تعديل أوزان النجاة والموت بناءً على نصيحة Claude
const WIN_SCORE = 2_000_000_000;
const GAME_OVER_SCORE = -1_000_000_000; 

const POW2 = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

const PROGRESSION_SCORE = [
  0, 40, 120, 350, 1_000, 2_800, 7_800, 21_000, 56_000, 150_000, 420_000,
];

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
  16, 12, 9, 6.8, 5.0, 3.8, 2.9, 2.2, 1.6, 1.2, 0.9, 0.65, 0.45, 0.3, 0.2, 0.1,
];

const SNAKE_WEIGHT_TABLES: number[][] = SNAKE_PATHS.map((path) => {
  const table = new Array<number>(16).fill(0);
  for (let step = 0; step < 16; step++) table[path[step]] = STEP_WEIGHT[step];
  return table;
});

// Time Budget Variables
let searchStartTime = 0;
let timeBudgetMs = 90; // ميزانية 90 مللي ثانية كحد أقصى للبحث
let timeoutTriggered = false;

function hashGrid(g: number[]): string {
  let s = "";
  for (let i = 0; i < 16; i++) s += g[i].toString(16);
  return s;
}

function boardToFlat(board: Board): number[] {
  const g = new Array<number>(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) g[r * 4 + c] = board[r][c];
  }
  return g;
}

function slideLine(
  g: number[], i0: number, i1: number, i2: number, i3: number, out: number[]
): { changed: boolean; reached11: boolean } {
  const nonZero: number[] = [];
  if (g[i0] !== 0) nonZero.push(g[i0]);
  if (g[i1] !== 0) nonZero.push(g[i1]);
  if (g[i2] !== 0) nonZero.push(g[i2]);
  if (g[i3] !== 0) nonZero.push(g[i3]);

  let reached11 = false;
  const merged: number[] = [];

  for (let idx = 0; idx < nonZero.length; idx++) {
    const curr = nonZero[idx];
    const next = nonZero[idx + 1];
    if (curr !== undefined && curr === next) {
      if (curr === 10) reached11 = true;
      else merged.push(curr + 1);
      idx += 1;
    } else if (curr !== undefined) {
      merged.push(curr);
    }
  }

  out[i0] = merged[0] ?? 0;
  out[i1] = merged[1] ?? 0;
  out[i2] = merged[2] ?? 0;
  out[i3] = merged[3] ?? 0;

  return { 
    changed: out[i0] !== g[i0] || out[i1] !== g[i1] || out[i2] !== g[i2] || out[i3] !== g[i3], 
    reached11 
  };
}

function simulateFlatMove(
  g: number[], dir: Direction
): { next: number[]; changed: boolean; reached11: boolean } {
  const next = new Array<number>(16);
  let changed = false, reached11 = false;

  for (let line = 0; line < 4; line++) {
    let res;
    if (dir === "LEFT") res = slideLine(g, line * 4, line * 4 + 1, line * 4 + 2, line * 4 + 3, next);
    else if (dir === "RIGHT") res = slideLine(g, line * 4 + 3, line * 4 + 2, line * 4 + 1, line * 4, next);
    else if (dir === "UP") res = slideLine(g, line, line + 4, line + 8, line + 12, next);
    else res = slideLine(g, line + 12, line + 8, line + 4, line, next);

    if (res.changed) changed = true;
    if (res.reached11) reached11 = true;
  }
  return { next, changed, reached11 };
}

// حساب ديون الدمج (Merge Debt) بناءً على مقترح Claude لقياس فوضى الرقعة
const mergeDebtArray = new Int8Array(12);
function calculateMergeDebt(g: number[]): number {
  mergeDebtArray.fill(0);
  let tiles = 0;
  for (let i = 0; i < 16; i++) {
    if (g[i] > 0) {
      mergeDebtArray[g[i]]++;
      tiles++;
    }
  }
  let pop = 0;
  for (let v = 1; v <= 10; v++) {
    pop += mergeDebtArray[v] & 1;
    mergeDebtArray[v + 1] += mergeDebtArray[v] >> 1;
  }
  return tiles - pop;
}

function evaluateFlatBoard(g: number[]): number {
  let emptyCount = 0, progression = 0, smoothness = 0, trappedPenalty = 0;
  let tenCount = 0, nineCount = 0, eightCount = 0, sevenCount = 0;

  for (let i = 0; i < 16; i++) {
    const v = g[i];
    if (v === 0) { emptyCount += 1; continue; }

    progression += PROGRESSION_SCORE[v];
    if (v === 10) tenCount += 1;
    else if (v === 9) nineCount += 1;
    else if (v === 8) eightCount += 1;
    else if (v === 7) sevenCount += 1;

    const r = i >> 2, c = i & 3;
    if (c < 3) {
      const right = g[i + 1];
      if (right !== 0) smoothness += right === v ? PROGRESSION_SCORE[v] * 0.45 : -Math.abs(POW2[v] - POW2[right]) * 6;
    }
    if (r < 3) {
      const down = g[i + 4];
      if (down !== 0) smoothness += down === v ? PROGRESSION_SCORE[v] * 0.45 : -Math.abs(POW2[v] - POW2[down]) * 6;
    }

    let minSurrounding = 99, blockedSides = 0;
    if (r > 0 && g[i - 4] > v + 1) { blockedSides++; minSurrounding = Math.min(minSurrounding, g[i - 4]); } else if (r===0) blockedSides++;
    if (r < 3 && g[i + 4] > v + 1) { blockedSides++; minSurrounding = Math.min(minSurrounding, g[i + 4]); } else if (r===3) blockedSides++;
    if (c > 0 && g[i - 1] > v + 1) { blockedSides++; minSurrounding = Math.min(minSurrounding, g[i - 1]); } else if (c===0) blockedSides++;
    if (c < 3 && g[i + 1] > v + 1) { blockedSides++; minSurrounding = Math.min(minSurrounding, g[i + 1]); } else if (c===3) blockedSides++;

    if (blockedSides >= 3 && minSurrounding <= 10) {
      trappedPenalty += (POW2[minSurrounding] - POW2[v]) * (blockedSides === 4 ? 35 : 16);
    }
  }

  let mergeScore = 0, availableMergeCount = 0, monoPenalty = 0;
  const evalLine = (i0: number, i1: number, i2: number, i3: number) => {
    const line = [g[i0], g[i1], g[i2], g[i3]];
    let prev = 0, inc = 0, dec = 0;
    for (let k = 0; k < 4; k++) {
      const cur = line[k];
      if (cur === 0) continue;
      if (prev !== 0) {
        if (cur === prev) {
          availableMergeCount += 1;
          mergeScore += cur === 10 ? 45_000_000 : PROGRESSION_SCORE[cur] * 0.85 + 8_000;
          prev = 0; continue;
        } else {
          if (Math.abs(cur - prev) === 1) mergeScore += PROGRESSION_SCORE[Math.max(cur, prev)] * 0.25;
          if (POW2[cur] > POW2[prev]) inc += POW2[cur] - POW2[prev]; else dec += POW2[prev] - POW2[cur];
        }
      }
      prev = cur;
    }
    monoPenalty += Math.min(inc, dec);
  };

  for (let l = 0; l < 4; l++) {
    evalLine(l * 4, l * 4 + 1, l * 4 + 2, l * 4 + 3);
    evalLine(l, l + 4, l + 8, l + 12);
  }

  if (emptyCount === 0 && availableMergeCount === 0) return GAME_OVER_SCORE;

  let bestSnakeScore = -Infinity;
  for (let p = 0; p < 8; p++) {
    const table = SNAKE_WEIGHT_TABLES[p];
    let s = 0;
    for (let i = 0; i < 16; i++) if (g[i] !== 0) s += POW2[g[i]] * table[i];
    if (s > bestSnakeScore) bestSnakeScore = s;
  }

  const emptyBonus = emptyCount * 55_000 + emptyCount * emptyCount * 5_500 + availableMergeCount * 24_000;

  // دمج דיون الدمج مع غرامة أقوى إذا كان هناك 10
  const debt = calculateMergeDebt(g);
  const debtPenalty = debt * (tenCount > 0 ? 80_000 : 30_000);

  let synergy = 0;
  if (tenCount >= 2) synergy += 300_000_000;
  else if (tenCount === 1) {
    synergy += 50_000_000;
    if (nineCount >= 2) synergy += 100_000_000;
    else if (nineCount === 1 && eightCount >= 2) synergy += 60_000_000;
    else if (nineCount === 1 && eightCount === 1) synergy += 40_000_000;
    else if (nineCount === 1) synergy += 25_000_000 + sevenCount * 2_000_000;
    else synergy += eightCount * 5_000_000;
  } else if (nineCount >= 2) synergy += 20_000_000;

  return progression + bestSnakeScore * 3 + smoothness + mergeScore + emptyBonus + synergy - monoPenalty * 10 - trappedPenalty - debtPenalty;
}

function searchChanceNode(g: number[], depthRemaining: number, lateSpawnPhase: boolean, pathProb: number): number {
  if (Date.now() - searchStartTime > timeBudgetMs) {
    timeoutTriggered = true;
    return 0;
  }

  if (depthRemaining <= 1) return evaluateFlatBoard(g);

  // Probability Cutoff Pruning (قص الفروع التي يقل احتمالها التراكمي عن 0.2% لتوفير الميزانية)
  if (pathProb < 0.002) return evaluateFlatBoard(g);

  const emptyIndices: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (g[i] === 0) emptyIndices.push(i);
  }

  const numEmpty = emptyIndices.length;
  if (numEmpty === 0) return evaluateFlatBoard(g);

  // أخذ عينات محدودة جداً في الفراغات الكبيرة للتركيز على العمق
  let cellsToTest = emptyIndices;
  if (numEmpty > 4) {
    cellsToTest = [];
    const step = numEmpty / 3;
    for (let k = 0; k < 3; k++) cellsToTest.push(emptyIndices[Math.floor(k * step)]);
  }

  const probs = lateSpawnPhase ? POST10_SPAWN_PROBS : PRE10_SPAWN_PROBS;
  const cellWeight = 1 / cellsToTest.length;
  let expected = 0;

  for (let e = 0; e < cellsToTest.length; e++) {
    const cellIdx = cellsToTest[e];
    for (let s = 0; s < SPAWN_VALUES.length; s++) {
      const p = probs[s];
      if (p <= 0.005) continue; // تجاهل البلاطات المستحيلة

      g[cellIdx] = SPAWN_VALUES[s];
      expected += cellWeight * p * searchMaxNode(g, depthRemaining - 1, lateSpawnPhase, pathProb * p * cellWeight);
    }
    g[cellIdx] = 0;
  }

  return expected;
}

function searchMaxNode(g: number[], depthRemaining: number, lateSpawnPhase: boolean, pathProb: number): number {
  if (Date.now() - searchStartTime > timeBudgetMs) {
    timeoutTriggered = true;
    return 0;
  }

  lateSpawnPhase = lateSpawnPhase || containsTen(g);

  if (depthRemaining <= 0) return evaluateFlatBoard(g);

  let best = GAME_OVER_SCORE;
  let hasLegalMove = false;

  for (let d = 0; d < 4; d++) {
    const dir = DIRECTIONS[d];
    const sim = simulateFlatMove(g, dir);
    if (sim.reached11) return WIN_SCORE;
    if (!sim.changed) continue;

    hasLegalMove = true;
    const val = searchChanceNode(sim.next, depthRemaining, lateSpawnPhase || containsTen(sim.next), pathProb);
    if (val > best) best = val;
  }

  return hasLegalMove ? best : GAME_OVER_SCORE;
}

export function getBestMove(board: Board, hasReached10Before = false): SolverResult {
  searchStartTime = Date.now();
  timeoutTriggered = false;

  if (isGameOver(board)) return { bestMove: null, isGameOver: true };

  const candidates: Array<{ direction: Direction; nextFlat: number[]; initialScore: number }> = [];

  for (const direction of DIRECTIONS) {
    const result = applyMove(board, direction);
    if (result.reached11) return { bestMove: direction, isGameOver: false };
    if (result.changed) {
      const nextFlat = boardToFlat(result.newBoard);
      candidates.push({ direction, nextFlat, initialScore: evaluateFlatBoard(nextFlat) });
    }
  }

  if (candidates.length === 0) return { bestMove: null, isGameOver: true };
  candidates.sort((a, b) => b.initialScore - a.initialScore);
  if (candidates.length === 1) return { bestMove: candidates[0].direction, isGameOver: false };

  let bestMove: Direction = candidates[0].direction;

  // البحث التدريجي العميق بلا سقف للعقد، يتوقف فقط بناءً على الوقت (90 مللي ثانية)
  for (let depth = 2; depth <= 8; depth++) {
    let depthBestMove: Direction = candidates[0].direction;
    let depthBestScore = -Infinity;

    for (const candidate of candidates) {
      if (timeoutTriggered) break;
      const score = searchChanceNode(candidate.nextFlat.slice(), depth, hasReached10Before || containsTen(candidate.nextFlat), 1.0);
      if (score > depthBestScore && !timeoutTriggered) {
        depthBestScore = score;
        depthBestMove = candidate.direction;
      }
    }

    if (timeoutTriggered) break; // الوقت انتهى، نعتمد نتيجة العمق السابق المكتملة
    bestMove = depthBestMove;
    candidates.sort((a, b) => (a.direction === bestMove ? -1 : b.direction === bestMove ? 1 : 0));
  }

  return { bestMove, isGameOver: false };
}