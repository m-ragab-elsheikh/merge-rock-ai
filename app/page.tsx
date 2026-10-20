"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { Board as BoardType, Direction, GameState, SolverResult, SpawnValue } from "@/types";
import { beginTurn, completeSpawn, initialState, isValidGameState, undoLastTurn } from "@/lib/history";
import { SocialLinks } from "@/components/SocialLinks";
import { applyMove } from "@/lib/merge";
import { isGameOver } from "@/lib/gameover";

const STORAGE_KEY = "merge-solver-ai-state-v3";

type WorkerResponse = { id: number; result?: SolverResult; error?: string };

function loadStoredState(): { state: GameState | null; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: null, warning: "" };

    const parsed: unknown = JSON.parse(raw);
    if (isValidGameState(parsed)) return { state: parsed, warning: "" };

    localStorage.removeItem(STORAGE_KEY);
    return { state: null, warning: "Saved progress was invalid and has been reset." };
  } catch {
    return { state: null, warning: "Saved progress could not be read. You can still play normally." };
  }
}

export default function HomePage() {
  const [state, setState] = useState<GameState>(initialState);
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [workerFailed, setWorkerFailed] = useState(false);
  const [solverRetryToken, setSolverRetryToken] = useState(0);
  const [storageWarning, setStorageWarning] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const restartWorkerRef = useRef<(() => void) | null>(null);

  const hasReached10Before =
    state.board.some((row) => row.includes(10)) ||
    state.history.some(
      (entry) =>
        entry.reached11 ||
        entry.boardBefore.some((row) => row.includes(10)) ||
        entry.boardAfter.some((row) => row.includes(10))
    );
  const maxTile = Math.max(1, ...state.board.flat());

  useEffect(() => {
    const stored = loadStoredState();
    if (stored.state) setState(stored.state);
    if (stored.warning) setStorageWarning(stored.warning);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageWarning("");
    } catch {
      setStorageWarning("This browser session cannot save progress. Your game may be lost after refresh.");
    }
  }, [hydrated, state]);

  useEffect(() => {
    const startWorker = () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      setWorkerFailed(false);

      try {
        const worker = new Worker(new URL("@/lib/solver.worker.ts", import.meta.url));
        workerRef.current = worker;

        const failWorker = (message: string) => {
          if (workerRef.current !== worker) return;
          worker.terminate();
          workerRef.current = null;
          requestIdRef.current += 1;
          setSolverResult(null);
          setIsThinking(false);
          setWorkerFailed(true);
          setError(message);
        };

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.id !== requestIdRef.current) return;
          if (event.data.error || !event.data.result) {
            failWorker("The move calculator encountered a problem. Select Retry to try again.");
            return;
          }
          setSolverResult(event.data.result);
          setIsThinking(false);
          setWorkerFailed(false);
          setError("");
        };

        worker.onerror = (event) => {
          event.preventDefault();
          failWorker("The move calculator stopped unexpectedly. Select Retry to try again.");
        };
        worker.onmessageerror = () => {
          failWorker("The move calculator returned an unreadable response. Select Retry to try again.");
        };
      } catch {
        workerRef.current = null;
        setIsThinking(false);
        setWorkerFailed(true);
        setError("The move calculator could not start. Select Retry to try again.");
      }
    };

    restartWorkerRef.current = startWorker;
    startWorker();

    return () => {
      restartWorkerRef.current = null;
      requestIdRef.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (state.phase === "WAITING_FOR_SPAWN" || state.phase === "GAME_OVER") {
      requestIdRef.current += 1;
      setSolverResult(null);
      setIsThinking(false);
      return;
    }
    if (!workerRef.current) return;

    const id = ++requestIdRef.current;
    setIsThinking(true);
    setError("");
    try {
      workerRef.current.postMessage({ id, board: state.board, hasReached10Before });
    } catch {
      workerRef.current.terminate();
      workerRef.current = null;
      setSolverResult(null);
      setIsThinking(false);
      setWorkerFailed(true);
      setError("The move request could not be sent. Select Retry to try again.");
    }
  }, [hydrated, state.board, state.history, state.phase, solverRetryToken, hasReached10Before]);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (isThinking || state.phase === "WAITING_FOR_SPAWN" || state.phase === "GAME_OVER") return;

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
      setError("There is no move to undo.");
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

  const handleRetrySolver = useCallback(() => {
    setError("");
    restartWorkerRef.current?.();
    setSolverRetryToken((current) => current + 1);
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
    !workerFailed &&
    state.phase !== "WAITING_FOR_SPAWN" &&
    state.phase !== "GAME_OVER" &&
    solverResult?.isGameOver === false &&
    solverResult.bestMove !== null;

  const solverStatus = isThinking
    ? "Calculating the best move…"
    : workerFailed
      ? "Move calculator unavailable"
      : state.phase === "GAME_OVER"
        ? "No more legal moves"
        : hasReached10Before
          ? "Stage 02 · Higher tile phase"
          : "Stage 01 · Build your board";

  return (
    <main className="forest-app">
      <div className="forest-backdrop" aria-hidden="true">
        <img src="./img/forest-wallpaper.webp" alt="" draggable={false} />
        <span className="forest-overlay" />
      </div>

      <div className="app-shell">
        <header className="app-header">
          <div className="top-bar">
            <div className="level-pill" aria-label={`Current highest tile is ${maxTile}`}>
              <BarsIcon />
              <span>LEVEL <strong>{maxTile}</strong></span>
            </div>
          </div>

          <div className="brand-lockup">
            <div className="brand-emblem">
              <img src="./img/logo.jpg" alt="Merge Rock AI logo" draggable={false} />
            </div>
            <h1 className="brand-title">MERGE ROCK <span>AI</span></h1>
            <p className="brand-status" aria-live="polite">
              <span className={`status-light ${isThinking ? "status-light--thinking" : workerFailed ? "status-light--error" : ""}`} />
              {solverStatus}
            </p>
          </div>
          <div className="title-beam" aria-hidden="true"><span /></div>
        </header>

        <section className="board-section" aria-label="Merge board">
          <Board
            board={state.board}
            bestMove={solverResult?.bestMove}
            inputMode={inputMode}
            onCellEdit={handleBoardInput}
          />
        </section>

        {state.phase === "SETUP" && (
          <section className="setup-panel">
            <div className="setup-copy">
              <p className="eyebrow">NEW SESSION</p>
              <h2>Match your game board</h2>
              <p>Tap a cell to enter its level.</p>
            </div>
          </section>
        )}

        <section className="status-strip" aria-label="Game status">
          <div className="moves-card">
            <div className="moves-icon"><FootprintsIcon /></div>
            <div className="moves-copy">
              <span>MOVES</span>
              <strong>{state.history.length}</strong>
            </div>
          </div>
          <div className="hint-card">
            <span className="hint-icon"><BulbIcon /></span>
            <p>
              {state.phase === "WAITING_FOR_SPAWN"
                ? "Enter the tile that appeared in your original game."
                : hasReached10Before
                  ? "Higher-value spawns are more likely in this Solver stage."
                  : "Merge matching creatures to reach higher levels!"}
            </p>
          </div>
        </section>

        {state.phase === "WAITING_FOR_SPAWN" && (
          <div className="spawn-prompt" role="status">
            <span className="spawn-prompt__pulse" />
            <div>
              <strong>New tile detected in the original game?</strong>
              <p>Select an empty cell on this board, then enter its value.</p>
            </div>
          </div>
        )}

        {state.phase !== "WAITING_FOR_SPAWN" && (
          <section className="controls-section" aria-label="Move controls">
            <div className="controls-heading">
              <div>
                <p className="eyebrow">RECOMMENDED MOVE</p>
                <h2>{solverResult?.bestMove && !solverResult.isGameOver ? solverResult.bestMove : isThinking ? "Thinking…" : "Ready when you are"}</h2>
              </div>
              {solverResult?.bestMove && !solverResult.isGameOver && (
                <span className="move-chip"><span className="chip-dot" /> AI PICK</span>
              )}
            </div>
            <div className="direction-pad">
              <div />
              <DirectionButton direction="UP" active={solverResult?.bestMove === "UP"} disabled={!canPressMove} onClick={handleMove} />
              <div />
              <DirectionButton direction="LEFT" active={solverResult?.bestMove === "LEFT"} disabled={!canPressMove} onClick={handleMove} />
              <DirectionButton direction="DOWN" active={solverResult?.bestMove === "DOWN"} disabled={!canPressMove} onClick={handleMove} />
              <DirectionButton direction="RIGHT" active={solverResult?.bestMove === "RIGHT"} disabled={!canPressMove} onClick={handleMove} />
            </div>
          </section>
        )}

        {(error || workerFailed) && (
          <div className="error-panel" role="alert">
            <p>{error || "The move calculator could not start."}</p>
            {workerFailed && (
              <button type="button" className="retry-button" onClick={handleRetrySolver}>↻ Retry calculator</button>
            )}
          </div>
        )}
        {storageWarning && <p className="storage-warning" role="status">{storageWarning}</p>}

        <div className="action-row">
          <button type="button" onClick={handleUndo} disabled={state.history.length === 0} className="action-button action-button--undo">
            <UndoIcon />
            <span>UNDO</span>
          </button>
          <button type="button" onClick={handleReset} className="action-button action-button--new">
            <PlayIcon />
            <span>NEW GAME</span>
          </button>
        </div>

        {state.phase === "GAME_OVER" && (
          <Modal title="Game Over" onUndo={handleUndo} onReset={handleReset} canUndo={state.history.length > 0} />
        )}

        <SocialLinks />

        <footer className="app-footer">
          <span className="footer-star">✦</span>
          MERGE ROCK AI <span>·</span> STAGE-AWARE SOLVER
        </footer>
      </div>
    </main>
  );
}

function DirectionButton({
  direction,
  active,
  disabled,
  onClick,
}: {
  direction: Direction;
  active: boolean;
  disabled: boolean;
  onClick: (direction: Direction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(direction)}
      disabled={disabled}
      aria-label={`Move ${direction.toLowerCase()}`}
      aria-pressed={active}
      className={`direction-button direction-button--${direction.toLowerCase()} ${active ? "direction-button--active" : ""}`}
    >
      <ArrowIcon direction={direction} />
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
    <div className="gameover-backdrop" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
      <div className="gameover-modal">
        <div className="gameover-icon"><span>✦</span></div>
        <p className="eyebrow">SESSION COMPLETE</p>
        <h2 id="gameover-title">{title}</h2>
        <p className="gameover-copy">No more legal moves are available on this board.</p>
        <div className="modal-actions">
          <button type="button" onClick={onUndo} disabled={!canUndo} className="modal-button modal-button--secondary"><UndoIcon /> Undo</button>
          <button type="button" onClick={onReset} className="modal-button modal-button--primary"><PlayIcon /> New Game</button>
        </div>
      </div>
    </div>
  );
}

function BarsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19v-5M9 19V9M14 19V4M19 19v-8" /></svg>;
}
function FootprintsIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8.4 3.5c-2.2 0-3.6 2.8-3.2 6.3.3 2.9 1.6 4.9 3.3 4.9 1.9 0 3.2-2.8 3-6.2-.2-2.8-1.1-5-3.1-5Z"/><path d="M5.4 17.2c-1.9.3-3.1 3.2-2.7 6 .4 2.5 1.8 4.3 3.7 4 1.8-.3 2.5-2.6 2-5.1-.5-2.8-1.4-5-3-4.9Z"/><g transform="translate(32 0) scale(-1 1)"><path d="M8.4 3.5c-2.2 0-3.6 2.8-3.2 6.3.3 2.9 1.6 4.9 3.3 4.9 1.9 0 3.2-2.8 3-6.2-.2-2.8-1.1-5-3.1-5Z"/><path d="M5.4 17.2c-1.9.3-3.1 3.2-2.7 6 .4 2.5 1.8 4.3 3.7 4 1.8-.3 2.5-2.6 2-5.1-.5-2.8-1.4-5-3-4.9Z"/></g></svg>;
}
function BulbIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M8.2 14.7A6.5 6.5 0 1 1 15.8 14.7c-.8.6-1.3 1.5-1.3 2.3h-5c0-.8-.5-1.7-1.3-2.3Z" /><path d="M12 2v2M3.8 5.2l1.4 1.4M20.2 5.2l-1.4 1.4M2 12h2M20 12h2" /></svg>;
}
function UndoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4.5 9H14a6 6 0 0 1 0 12H9" /></svg>;
}
function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8c0-.8.9-1.3 1.6-.8l11 7.1a1.1 1.1 0 0 1 0 1.8l-11 7.1c-.7.5-1.6 0-1.6-.8V4.8Z" /></svg>;
}
function ArrowIcon({ direction }: { direction: Direction }) {
  const rotations: Record<Direction, number> = { UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270 };
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" style={{ transform: `rotate(${rotations[direction]}deg)` }}>
      <path d="M16 27V5M7 14l9-9 9 9" />
    </svg>
  );
}