"use client";

import { useEffect, useState } from "react";
import { Board as BoardType, SpawnValue, TILE_COLORS } from "@/types";

type InputMode = "SETUP" | "SPAWN" | "NONE";

interface BoardProps {
  board: BoardType;
  bestMove?: string;
  inputMode: InputMode;
  onCellEdit?: (row: number, col: number, value: number) => void;
}

const setupValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const spawnValues: SpawnValue[] = [1, 2, 3, 4, 5];

export function Board({ board, bestMove, inputMode, onCellEdit }: BoardProps) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [inputMode]);

  const handleCellClick = (row: number, col: number) => {
    if (!onCellEdit || inputMode === "NONE") return;
    if (inputMode === "SPAWN" && board[row][col] !== 0) return;
    setSelected((current) =>
      current?.row === row && current?.col === col ? null : { row, col }
    );
  };

  const handleValueClick = (value: number) => {
    if (!selected || !onCellEdit) return;
    onCellEdit(selected.row, selected.col, value);
    setSelected(null);
  };

  const editable = inputMode !== "NONE";
  const values = inputMode === "SPAWN" ? spawnValues : setupValues;

  return (
    <section className="flex w-full flex-col items-center gap-3">
      <div className="w-full max-w-[350px] rounded-[1.5rem] bg-gradient-to-b from-slate-600 via-slate-800 to-slate-900 p-1 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="relative grid grid-cols-4 gap-2 overflow-hidden rounded-2xl border border-slate-950/80 bg-slate-900 p-3 shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-900/10 to-purple-900/10" />

          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
              const isSuggestedEdge =
                (bestMove === "LEFT" && colIndex === 0) ||
                (bestMove === "RIGHT" && colIndex === 3) ||
                (bestMove === "UP" && rowIndex === 0) ||
                (bestMove === "DOWN" && rowIndex === 3);
              const canSelect =
                editable && (inputMode === "SETUP" || (inputMode === "SPAWN" && cell === 0));

              return (
                <button
                  type="button"
                  key={`${rowIndex}-${colIndex}`}
                  aria-label={`Cell ${rowIndex + 1}, ${colIndex + 1}`}
                  disabled={!canSelect}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`relative aspect-square rounded-xl font-bold text-xl transition-all duration-200 ${TILE_COLORS[cell]} ${
                    cell === 0
                      ? "border border-slate-800/40 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]"
                      : "border border-white/5 shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
                  } ${
                    isSuggestedEdge && cell !== 0
                      ? "ring-2 ring-yellow-400/80 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                      : ""
                  } ${
                    isSelected
                      ? "z-20 scale-105 ring-4 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                      : ""
                  } ${
                    canSelect
                      ? "cursor-pointer hover:brightness-110 active:scale-95"
                      : "cursor-default"
                  }`}
                >
                  {cell !== 0 && (
                    <div className="relative flex h-full w-full items-center justify-center">
                      <img
                        src={`./img/animals/${cell}.png`}
                        alt={`Level ${cell}`}
                        className="h-12 w-12 object-contain drop-shadow-xl sm:h-14 sm:w-14"
                        draggable={false}
                      />
                      <div className="absolute -bottom-1.5 left-1/2 flex h-[22px] min-w-[22px] -translate-x-1/2 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-900 px-1 text-[10px] font-black text-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                        {cell}
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {editable && selected && (
        <div className="w-full max-w-[350px] rounded-2xl border border-slate-700 bg-slate-800 p-3 shadow-xl">
          <div className="mb-2 text-center text-sm font-bold text-slate-300">
            {inputMode === "SPAWN" ? "اختر الرقم الجديد" : "اختر الرقم"}
          </div>
          <div className={`grid gap-2 ${inputMode === "SPAWN" ? "grid-cols-5" : "grid-cols-5"}`}>
            {values.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleValueClick(value)}
                className="rounded-lg border border-slate-600 bg-slate-700 py-2 font-bold text-white transition hover:bg-slate-600 active:scale-95"
              >
                {value}
              </button>
            ))}
            {inputMode === "SETUP" && (
              <button
                type="button"
                onClick={() => handleValueClick(0)}
                className="rounded-lg border border-red-800/50 bg-red-900/50 py-2 font-bold text-red-100 transition hover:bg-red-800/80 active:scale-95"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {inputMode === "SPAWN" && !selected && (
        <p className="text-center text-sm font-semibold text-yellow-400">اختار الخانة الفارغة ثم أدخل الرقم</p>
      )}
    </section>
  );
}
