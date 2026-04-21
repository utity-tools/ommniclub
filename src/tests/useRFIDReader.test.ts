import { describe, it, expect } from "vitest";
import { normalizeRFIDTag, isValidRFIDTag } from "@/lib/rfid/normalize";

// El hook usa APIs de browser (window, navigator.serial) — testeamos
// la lógica de normalización que es el núcleo del hook, y simulamos
// el flujo de eventos de teclado con un stub manual.

function simulateKeyboardRead(
  keys: string[],
  suffix = "Enter"
): { raw: string; normalized: string } | null {
  let buffer = "";
  let result: { raw: string; normalized: string } | null = null;

  for (const key of keys) {
    if (key === suffix || key === "Enter") {
      if (!buffer) break;
      try {
        const normalized = normalizeRFIDTag(buffer);
        if (isValidRFIDTag(normalized)) {
          result = { raw: buffer, normalized };
        }
      } catch {
        result = null;
      }
      buffer = "";
    } else if (key.length === 1) {
      buffer += key;
    }
  }

  return result;
}

describe("RFID keyboard mode — flujo de lectura", () => {
  it("procesa correctamente un tag hexadecimal enviado por teclado", () => {
    const keys = ["0", "0", "4", "0", "E", "0", "8", "9", "Enter"];
    const result = simulateKeyboardRead(keys);
    expect(result).not.toBeNull();
    expect(result!.normalized).toBe("0040E089");
  });

  it("procesa un tag en formato decimal enviado por teclado", () => {
    // 4251785 decimal = 0040E089 hex
    const keys = ["4", "2", "5", "1", "7", "8", "5", "Enter"];
    const result = simulateKeyboardRead(keys);
    expect(result).not.toBeNull();
    expect(result!.normalized).toBe("0040E089");
  });

  it("retorna null si el buffer está vacío al recibir Enter", () => {
    const result = simulateKeyboardRead(["Enter"]);
    expect(result).toBeNull();
  });

  it("ignora caracteres no válidos y falla con gracia", () => {
    const keys = ["Z", "Z", "Z", "Enter"];
    const result = simulateKeyboardRead(keys);
    expect(result).toBeNull();
  });

  it("soporta sufijo personalizado distinto de Enter", () => {
    const keys = ["0", "0", "4", "0", "E", "0", "8", "9", "\t"];
    const result = simulateKeyboardRead(keys, "\t");
    expect(result).not.toBeNull();
    expect(result!.normalized).toBe("0040E089");
  });
});

describe("RFID — casos edge de normalización en flujo completo", () => {
  it("tag con todos los bits a 1 (FFFFFFFF)", () => {
    const keys = ["F", "F", "F", "F", "F", "F", "F", "F", "Enter"];
    const result = simulateKeyboardRead(keys);
    expect(result!.normalized).toBe("FFFFFFFF");
  });

  it("tag con todos los bits a 0 (00000000)", () => {
    const keys = ["0", "Enter"];
    const result = simulateKeyboardRead(keys);
    expect(result!.normalized).toBe("00000000");
  });
});
