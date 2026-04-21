"use client";

import { useRFIDReader, type RFIDReaderMode, type RFIDReadResult } from "@/hooks/useRFIDReader";
import { cn } from "@/lib/utils";

type Props = {
  mode?: RFIDReaderMode;
  onRead: (result: RFIDReadResult) => void;
  onError?: (error: Error) => void;
  className?: string;
};

const STATUS_CONFIG = {
  idle: { label: "Lector inactivo", color: "bg-gray-200 text-gray-600", pulse: false },
  listening: { label: "Esperando tarjeta...", color: "bg-blue-100 text-blue-700", pulse: true },
  reading: { label: "Leyendo...", color: "bg-yellow-100 text-yellow-700", pulse: true },
  error: { label: "Error de lectura", color: "bg-red-100 text-red-700", pulse: false },
} as const;

export function RFIDStatusIndicator({ mode = "keyboard", onRead, onError, className }: Props) {
  const { status, startSerial, stopSerial } = useRFIDReader({ mode, onRead, onError });
  const cfg = STATUS_CONFIG[status];

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
          cfg.color,
          cfg.pulse && "animate-pulse"
        )}
        role="status"
        aria-live="polite"
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "idle" && "bg-gray-400",
            status === "listening" && "bg-blue-500",
            status === "reading" && "bg-yellow-500",
            status === "error" && "bg-red-500"
          )}
        />
        {cfg.label}
      </div>

      {mode === "serial" && (
        <div className="flex gap-2">
          {status === "idle" || status === "error" ? (
            <button
              onClick={startSerial}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              Conectar lector serial
            </button>
          ) : (
            <button
              onClick={stopSerial}
              className="rounded bg-gray-600 px-3 py-1 text-xs text-white hover:bg-gray-700"
            >
              Desconectar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
