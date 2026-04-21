"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { normalizeRFIDTag, isValidRFIDTag } from "@/lib/rfid/normalize";

export type RFIDReaderMode = "keyboard" | "serial";

export type RFIDReadResult = {
  raw: string;
  normalized: string;
  mode: RFIDReaderMode;
  timestamp: number;
};

export type RFIDReaderStatus = "idle" | "listening" | "reading" | "error";

type UseRFIDReaderOptions = {
  mode?: RFIDReaderMode;
  /** Tiempo máximo en ms para acumular caracteres de un tag (teclado mode) */
  keyboardDebounceMs?: number;
  /** Prefijo que envían algunos lectores antes del tag (ej: STX byte) */
  prefix?: string;
  /** Sufijo que envían algunos lectores tras el tag (ej: Enter, ETX) */
  suffix?: string;
  onRead: (result: RFIDReadResult) => void;
  onError?: (error: Error) => void;
};

/**
 * Hook para capturar lecturas RFID desde dispositivos USB.
 *
 * Soporta dos modos:
 * - keyboard: El lector emula un teclado y envía el tag como keystrokes.
 *   Es el modo más común en lectores genéricos de bajo coste.
 * - serial: Usa Web Serial API para lectores con protocolo propio.
 *
 * El objetivo de latencia es <200ms desde pasada del tag hasta callback.
 */
export function useRFIDReader({
  mode = "keyboard",
  keyboardDebounceMs = 80,
  prefix = "",
  suffix = "Enter",
  onRead,
  onError,
}: UseRFIDReaderOptions) {
  const [status, setStatus] = useState<RFIDReaderStatus>("idle");
  const bufferRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialPortRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);

  // ─── KEYBOARD MODE ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignorar si el foco está en un input normal del usuario
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === suffix || e.key === "Enter") {
        const raw = bufferRef.current;
        bufferRef.current = "";
        if (timerRef.current) clearTimeout(timerRef.current);

        if (!raw) return;

        const trimmed = prefix ? raw.replace(prefix, "") : raw;

        try {
          const normalized = normalizeRFIDTag(trimmed);
          if (!isValidRFIDTag(normalized)) throw new Error("Tag inválido");

          setStatus("idle");
          onRead({ raw: trimmed, normalized, mode: "keyboard", timestamp: Date.now() });
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
        return;
      }

      // Acumular caracteres del tag en el buffer
      if (e.key.length === 1) {
        if (bufferRef.current === "") setStatus("reading");
        bufferRef.current += e.key;

        // Reset automático si el lector se cuelga sin enviar sufijo
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
          setStatus("listening");
        }, keyboardDebounceMs * 5);
      }
    },
    [mode, suffix, prefix, keyboardDebounceMs, onRead, onError]
  );

  // ─── SERIAL MODE ────────────────────────────────────────────────────────────
  const startSerial = useCallback(async () => {
    if (!("serial" in navigator)) {
      onError?.(new Error("Web Serial API no soportada en este navegador"));
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;

      const decoder = new TextDecoderStream();
      // BufferSource compat: TextDecoderStream.writable accepts ArrayBufferView at runtime
      (port.readable as ReadableStream<Uint8Array>).pipeTo(
        decoder.writable as unknown as WritableStream<Uint8Array>
      );
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      setStatus("listening");
      let serialBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        serialBuffer += value;

        // Los lectores seriales terminan el tag con \r o \n
        if (serialBuffer.includes("\r") || serialBuffer.includes("\n")) {
          const raw = serialBuffer.replace(/[\r\n]/g, "").trim();
          serialBuffer = "";

          if (!raw) continue;
          try {
            const normalized = normalizeRFIDTag(raw);
            if (!isValidRFIDTag(normalized)) throw new Error("Tag inválido");
            onRead({ raw, normalized, mode: "serial", timestamp: Date.now() });
          } catch (err) {
            onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        }
      }
    } catch (err) {
      setStatus("error");
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [onRead, onError]);

  const stopSerial = useCallback(async () => {
    readerRef.current?.cancel();
    await serialPortRef.current?.close();
    serialPortRef.current = null;
    readerRef.current = null;
    setStatus("idle");
  }, []);

  // ─── LIFECYCLE ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "keyboard") {
      setStatus("listening");
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        if (timerRef.current) clearTimeout(timerRef.current);
        setStatus("idle");
      };
    }
  }, [mode, handleKeyDown]);

  return {
    status,
    /** Solo disponible en modo serial */
    startSerial,
    stopSerial,
  };
}
