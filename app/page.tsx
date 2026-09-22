"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { Board as BoardType, Direction, GameState, SolverResult, SpawnValue } from "@/types";
import { completeSpawn, initialState, beginTurn, undoLastTurn } from "@/lib/history";
import { isBoard } from "@/lib/board";
import { applyMove } from "@/lib/merge";
import { isGameOver } from "@/lib/gameover";

const STORAGE_KEY = "merge-solver-ai-state-v3";
function isValidPhase(value: unknown): value is GameState["phase"] {
  return ["SETUP", "READY", "WAITING_FOR_SPAWN", "GAME_OVER"].includes(value as string);
}

function loadStoredState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!isBoard(parsed.board) || !Array.isArray(parsed.history) || !isValidPhase(parsed.phase)) {
      return null;
    }

    return {
      board: parsed.board,
      history: parsed.history as GameState["history"],
      phase: parsed.phase,
    };
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [state, setState] = useState<GameState>(initialState);
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const stored = loadStoredState();
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    const worker = new Worker(new URL("@/lib/solver.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ id: number; result: SolverResult }>) => {
      if (event.data.id !== requestIdRef.current) return;
      setSolverResult(event.data.result);
      setIsThinking(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !workerRef.current) return;
    if (state.phase === "WAITING_FOR_SPAWN" || state.phase === "GAME_OVER") {
      setSolverResult(null);
      setIsThinking(false);
      return;
    }

    const id = ++requestIdRef.current;
    setIsThinking(true);
    workerRef.current.postMessage({ id, board: state.board });
  }, [hydrated, state.board, state.phase]);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (isThinking || state.phase === "WAITING_FOR_SPAWN" || state.phase === "GAME_OVER") {
        return;
      }

      const result = applyMove(state.board, direction);
      const nextState = beginTurn(state, direction, result.newBoard, result.reached11);

      if (result.reached11) {
        setState(nextState);
        setError("");
        return;
      }

      if (!result.changed && isGameOver(result.newBoard)) {
        setState({ ...nextState, phase: "GAME_OVER" });
      } else {
        setState(nextState);
      }
      setError("");
    },
    [isThinking, state]
  );

  const handleBoardInput = useCallback(
    (row: number, col: number, value: number) => {
      if (state.phase === "SETUP") {
        if (value < 0 || value > 10) return;
        const board = state.board.map((currentRow) => [...currentRow]) as BoardType;
        board[row][col] = value as BoardType[number][number];
        setState((current) => ({ ...current, board }));
        setError("");
        return;
      }

      if (state.phase !== "WAITING_FOR_SPAWN") return;
      if (value < 1 || value > 5) return;
      if (state.board[row][col] !== 0) return;

      const updated = completeSpawn(state, { value: value as SpawnValue, row, col });
      if (!updated) return;

      setState(isGameOver(updated.board) ? { ...updated, phase: "GAME_OVER" } : updated);
      setError("");
    },
    [state]
  );

  const handleUndo = useCallback(() => {
    const previous = undoLastTurn(state);
    if (!previous) {
      setError("لا يوجد Turn للتراجع عنه.");
      return;
    }

    setState(previous);
    setSolverResult(null);
    setError("");
  }, [state]);

  const handleReset = useCallback(() => {
    setState(initialState());
    setSolverResult(null);
    setError("");
  }, []);

  const inputMode =
    state.phase === "SETUP"
      ? "SETUP"
      : state.phase === "WAITING_FOR_SPAWN"
        ? "SPAWN"
        : "NONE";

  const canPressMove =
    hydrated &&
    !isThinking &&
    state.phase !== "WAITING_FOR_SPAWN" &&
    state.phase !== "GAME_OVER" &&
    solverResult?.isGameOver === false;

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-5 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-xl flex-col items-center">
        <header className="mb-4 flex flex-col items-center">
          <img
            src="./img/logo.jpg"
            alt="Merge Rock AI"
            className="mb-2 h-16 w-16 rounded-2xl object-contain shadow-[0_0_18px_rgba(250,204,21,0.18)] sm:h-20 sm:w-20"
            draggable={false}
          />
          <h1 className="text-3xl font-extrabold tracking-wide text-yellow-400 sm:text-4xl">Merge Rock AI</h1>
          {isThinking && <div className="mt-2 text-xs font-semibold text-slate-400">Calculating...</div>}
        </header>

        <Board
          board={state.board}
          bestMove={solverResult?.bestMove}
          inputMode={inputMode}
          onCellEdit={handleBoardInput}
        />

        {state.phase === "WAITING_FOR_SPAWN" ? (
          <div className="mt-4 w-full max-w-[350px] rounded-2xl border border-yellow-500/20 bg-slate-800/80 px-4 py-3 text-center text-sm font-semibold text-yellow-400">
            أدخل الرقم الجديد من اللعبة
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div />
              <DirectionButton
                direction="UP"
                label="⬆"
                active={solverResult?.bestMove === "UP"}
                disabled={!canPressMove}
                onClick={handleMove}
              />
              <div />

              <DirectionButton
                direction="LEFT"
                label="⬅"
                active={solverResult?.bestMove === "LEFT"}
                disabled={!canPressMove}
                onClick={handleMove}
              />
              <DirectionButton
                direction="DOWN"
                label="⬇"
                active={solverResult?.bestMove === "DOWN"}
                disabled={!canPressMove}
                onClick={handleMove}
              />
              <DirectionButton
                direction="RIGHT"
                label="➡"
                active={solverResult?.bestMove === "RIGHT"}
                disabled={!canPressMove}
                onClick={handleMove}
              />
            </div>

            {solverResult && !solverResult.isGameOver && (
              <div className="text-sm font-bold text-yellow-400">
                Move: {solverResult.bestMove}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleUndo}
            disabled={state.history.length === 0}
            className="rounded-xl border border-slate-700 bg-slate-700 px-5 py-2.5 font-bold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-red-900/70 bg-red-900/70 px-5 py-2.5 font-bold text-white transition hover:bg-red-800"
          >
            New Game
          </button>
        </div>


        {state.phase === "GAME_OVER" && (
          <Modal title="Game Over" onUndo={handleUndo} onReset={handleReset} canUndo={state.history.length > 0} />
        )}

        <footer className="mt-auto pt-8 text-center text-xs text-slate-500">Merge Rock AI</footer>
      </div>
    </main>
  );
}

function DirectionButton({
  direction,
  label,
  active,
  disabled,
  onClick,
}: {
  direction: Direction;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: (direction: Direction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(direction)}
      disabled={disabled}
      aria-label={direction}
      className={`h-14 w-14 rounded-2xl border text-2xl font-black transition-all sm:h-16 sm:w-16 ${
        active
          ? "scale-105 border-yellow-300 bg-yellow-400 text-slate-950 shadow-[0_0_22px_rgba(250,204,21,0.45)]"
          : "border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {label}
    </button>
  );
}

function Modal({
  title,
  onUndo,
  onReset,
  canUndo,
}: {
  title: string;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
        <h2 className="text-3xl font-extrabold text-yellow-400">{title}</h2>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="flex-1 rounded-xl bg-slate-700 py-3 font-bold text-white disabled:opacity-40"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-xl bg-red-700 py-3 font-bold text-white hover:bg-red-600"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
