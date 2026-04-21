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
  idle:      { label: "Lector inactivo",    pill: "bg-gray-200 text-gray-600",  dot: "bg-gray-400",  pulse: false },
  listening: { label: "Esperando tarjeta…", pill: "bg-blue-100 text-blue-700",  dot: "bg-blue-500",  pulse: true  },
  reading:   { label: "Leyendo…",           pill: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500", pulse: true  },
  error:     { label: "Error de lectura",   pill: "bg-red-100 text-red-700",    dot: "bg-red-500",   pulse: false },
} as const;

export function RFIDStatusIndicator({ mode = "keyboard", onRead, onError, className }: Props) {
  const { status, startSerial, stopSerial } = useRFIDReader({ mode, onRead, onError });
  const { label, pill, dot, pulse } = STATUS_CONFIG[status];
  const isDisconnected = status === "idle" || status === "error";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all", pill, pulse && "animate-pulse")}
        role="status"
        aria-live="polite"
      >
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        {label}
      </div>

      {mode === "serial" && (
        <button
          onClick={isDisconnected ? startSerial : stopSerial}
          className={cn(
            "rounded px-3 py-1 text-xs text-white",
            isDisconnected ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"
          )}
        >
          {isDisconnected ? "Conectar lector serial" : "Desconectar"}
        </button>
      )}
    </div>
  );
}
