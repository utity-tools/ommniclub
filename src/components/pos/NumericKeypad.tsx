"use client";

import { useCallback, useReducer } from "react";
import { cn } from "@/lib/utils";

type KeypadState = { display: string; hasDecimal: boolean };
type KeypadAction =
  | { type: "DIGIT"; key: string }
  | { type: "DECIMAL" }
  | { type: "BACKSPACE" }
  | { type: "CLEAR" };

const MAX_INTEGER_DIGITS = 4;  // max 9999g
const MAX_DECIMAL_DIGITS = 1;  // resolución 0.1g

function keypadReducer(state: KeypadState, action: KeypadAction): KeypadState {
  switch (action.type) {
    case "DIGIT": {
      if (state.display === "0" && action.key !== "0") {
        return { ...state, display: action.key };
      }
      const [intPart, decPart = ""] = state.display.split(".");
      if (state.hasDecimal) {
        if (decPart.length >= MAX_DECIMAL_DIGITS) return state;
        return { ...state, display: `${intPart}.${decPart}${action.key}` };
      }
      if (intPart.length >= MAX_INTEGER_DIGITS) return state;
      return { ...state, display: state.display + action.key };
    }
    case "DECIMAL":
      if (state.hasDecimal) return state;
      return { display: state.display + ".", hasDecimal: true };
    case "BACKSPACE": {
      if (state.display.length <= 1) return { display: "0", hasDecimal: false };
      const next = state.display.slice(0, -1);
      return { display: next, hasDecimal: next.includes(".") };
    }
    case "CLEAR":
      return { display: "0", hasDecimal: false };
    default:
      return state;
  }
}

type Props = {
  onConfirm: (grams: number) => void;
  disabled?: boolean;
  className?: string;
};

const DIGIT_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];

export function NumericKeypad({ onConfirm, disabled = false, className }: Props) {
  const [state, dispatch] = useReducer(keypadReducer, { display: "0", hasDecimal: false });

  const handleConfirm = useCallback(() => {
    const value = parseFloat(state.display);
    if (value > 0) {
      onConfirm(value);
      dispatch({ type: "CLEAR" });
    }
  }, [state.display, onConfirm]);

  const btnBase = "flex items-center justify-center rounded-xl text-2xl font-semibold h-16 transition-colors select-none touch-manipulation";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Display */}
      <div className="flex items-baseline justify-end gap-1 rounded-xl bg-gray-100 px-4 py-3">
        <span className="text-4xl font-bold tabular-nums">{state.display}</span>
        <span className="text-lg text-gray-500">g</span>
      </div>

      {/* Grid 3×4 */}
      <div className="grid grid-cols-3 gap-2">
        {DIGIT_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => dispatch({ type: "DIGIT", key: k })}
            disabled={disabled}
            className={cn(btnBase, "bg-white border border-gray-200 active:bg-gray-100 disabled:opacity-40")}
          >
            {k}
          </button>
        ))}

        {/* Fila inferior */}
        <button
          onClick={() => dispatch({ type: "DECIMAL" })}
          disabled={disabled || state.hasDecimal}
          className={cn(btnBase, "bg-white border border-gray-200 active:bg-gray-100 disabled:opacity-40")}
        >
          .
        </button>
        <button
          onClick={() => dispatch({ type: "DIGIT", key: "0" })}
          disabled={disabled}
          className={cn(btnBase, "bg-white border border-gray-200 active:bg-gray-100 disabled:opacity-40")}
        >
          0
        </button>
        <button
          onClick={() => dispatch({ type: "BACKSPACE" })}
          disabled={disabled}
          className={cn(btnBase, "bg-gray-100 active:bg-gray-200 disabled:opacity-40")}
          aria-label="Borrar"
        >
          ⌫
        </button>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          onClick={() => dispatch({ type: "CLEAR" })}
          disabled={disabled}
          className={cn(btnBase, "bg-gray-100 text-gray-700 active:bg-gray-200 disabled:opacity-40")}
        >
          C
        </button>
        <button
          onClick={handleConfirm}
          disabled={disabled || state.display === "0"}
          className={cn(btnBase, "bg-green-600 text-white active:bg-green-700 disabled:opacity-40")}
        >
          OK
        </button>
      </div>
    </div>
  );
}
