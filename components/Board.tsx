"use client";

import { useEffect, useState } from "react";
import { Board as BoardType, Direction, SpawnValue } from "@/types";

type InputMode = "SETUP" | "SPAWN" | "NONE";

interface BoardProps {
  board: BoardType;
  bestMove?: Direction | null;
  inputMode: InputMode;
  onCellEdit?: (row: number, col: number, value: number) => void;
}

const setupValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const spawnValues: SpawnValue[] = [1, 2, 3, 4, 5];

export function Board({ board, bestMove, inputMode, onCellEdit }: BoardProps) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [failedTileImages, setFailedTileImages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setSelected(null);
  }, [inputMode]);

  const handleCellClick = (row: number, col: number) => {
    if (!onCellEdit || inputMode === "NONE") return;
    if (inputMode === "SPAWN" && board[row][col] !== 0) return;
    setSelected((current) => current?.row === row && current.col === col ? null : { row, col });
  };

  const handleValueClick = (value: number) => {
    if (!selected || !onCellEdit) return;
    onCellEdit(selected.row, selected.col, value);
    setSelected(null);
  };

  const editable = inputMode !== "NONE";
  const values = inputMode === "SPAWN" ? spawnValues : setupValues;

  return (
    <section className="board-wrap" aria-label="Four by four board">
      <div className="board-frame">
        <div className="board-grid">
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isSelected = selected?.row === rowIndex && selected?.col === colIndex;
              const isSuggestedEdge =
                (bestMove === "LEFT" && colIndex === 0) ||
                (bestMove === "RIGHT" && colIndex === 3) ||
                (bestMove === "UP" && rowIndex === 0) ||
                (bestMove === "DOWN" && rowIndex === 3);
              const canSelect = editable && (inputMode === "SETUP" || (inputMode === "SPAWN" && cell === 0));

              return (
                <button
                  type="button"
                  key={`${rowIndex}-${colIndex}`}
                  aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, ${cell === 0 ? "empty" : `level ${cell}`}`}
                  disabled={!canSelect}
                  aria-pressed={isSelected}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`tile-cell ${cell === 0 ? "tile-cell--empty" : `tile-cell--level-${cell}`} ${
                    isSuggestedEdge && cell !== 0 ? "tile-cell--suggested-edge" : ""
                  } ${isSelected ? "tile-cell--selected" : ""} ${canSelect ? "tile-cell--editable" : ""}`}
                >
                  {cell === 0 ? (
                    <span className="empty-cell-glint" aria-hidden="true" />
                  ) : (
                    <span className="tile-art-wrap">
                      {failedTileImages[cell] ? (
                        <span aria-hidden="true" className="tile-number-fallback">{cell}</span>
                      ) : (
                        <img
                          src={`./img/animals/${cell}.png`}
                          alt={`Level ${cell}`}
                          className="tile-art"
                          draggable={false}
                          onError={() => setFailedTileImages((current) => ({ ...current, [cell]: true }))}
                        />
                      )}
                      <span className="tile-level-badge">{cell}</span>
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {editable && selected && (
        <div className="value-picker">
          <div className="value-picker__heading">
            {inputMode === "SPAWN" ? "Enter the new tile value" : "Choose the tile value"}
          </div>
          <div className={`value-picker__grid ${inputMode === "SPAWN" ? "value-picker__grid--spawn" : ""}`}>
            {values.map((value) => (
              <button key={value} type="button" onClick={() => handleValueClick(value)} className={`value-option value-option--${value}`}>
                {value}
              </button>
            ))}
            {inputMode === "SETUP" && (
              <button type="button" onClick={() => handleValueClick(0)} className="value-option value-option--clear" aria-label="Clear cell">×</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
