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

export const RFID_DEFAULTS = {
  BAUD_RATE: 9600,
  KEYBOARD_DEBOUNCE_MS: 80,
  SUFFIX: "Enter",
  PREFIX: "",
} as const;

type UseRFIDReaderOptions = {
  mode?: RFIDReaderMode;
  keyboardDebounceMs?: number;
  prefix?: string;
  suffix?: string;
  onRead: (result: RFIDReadResult) => void;
  onError?: (error: Error) => void;
};

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA"]);

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function processTag(raw: string, mode: RFIDReaderMode): RFIDReadResult {
  const normalized = normalizeRFIDTag(raw);
  if (!isValidRFIDTag(normalized)) throw new Error("Tag inválido");
  return { raw, normalized, mode, timestamp: Date.now() };
}

export function useRFIDReader({
  mode = "keyboard",
  keyboardDebounceMs = RFID_DEFAULTS.KEYBOARD_DEBOUNCE_MS,
  prefix = RFID_DEFAULTS.PREFIX,
  suffix = RFID_DEFAULTS.SUFFIX,
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
      const target = e.target as HTMLElement;
      if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;

      if (e.key === suffix || e.key === "Enter") {
        const raw = bufferRef.current;
        bufferRef.current = "";
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!raw) return;

        const trimmed = prefix ? raw.replace(prefix, "") : raw;
        try {
          onRead(processTag(trimmed, "keyboard"));
          setStatus("idle");
        } catch (err) {
          onError?.(toError(err));
        }
        return;
      }

      if (e.key.length === 1) {
        if (bufferRef.current === "") setStatus("reading");
        bufferRef.current += e.key;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
          setStatus("listening");
        }, keyboardDebounceMs * 5);
      }
    },
    [suffix, prefix, keyboardDebounceMs, onRead, onError]
  );

  // ─── SERIAL MODE ────────────────────────────────────────────────────────────
  const startSerial = useCallback(async () => {
    if (!("serial" in navigator)) {
      onError?.(new Error("Web Serial API no soportada en este navegador"));
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: RFID_DEFAULTS.BAUD_RATE });
      serialPortRef.current = port;

      const decoder = new TextDecoderStream();
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

        if (serialBuffer.includes("\r") || serialBuffer.includes("\n")) {
          const raw = serialBuffer.replace(/[\r\n]/g, "").trim();
          serialBuffer = "";
          if (!raw) continue;
          try {
            onRead(processTag(raw, "serial"));
          } catch (err) {
            onError?.(toError(err));
          }
        }
      }
    } catch (err) {
      setStatus("error");
      onError?.(toError(err));
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
    if (mode !== "keyboard") return;

    const id = setTimeout(() => setStatus("listening"), 0);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus("idle");
    };
  }, [mode, handleKeyDown]);

  return { status, startSerial, stopSerial };
}
