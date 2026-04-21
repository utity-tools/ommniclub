import { describe, it, expect } from "vitest";
import {
  normalizeRFIDTag,
  hexToDecimal,
  isValidRFIDTag,
} from "@/lib/rfid/normalize";

describe("normalizeRFIDTag", () => {
  it("convierte decimal puro a hex uppercase con padding de 8", () => {
    // 4251785 decimal = 0x0040E089
    expect(normalizeRFIDTag("4251785")).toBe("0040E089");
  });

  it("normaliza hex sin padding a 8 caracteres", () => {
    expect(normalizeRFIDTag("40e089")).toBe("0040E089");
  });

  it("elimina separadores de tipo colon", () => {
    expect(normalizeRFIDTag("00:40:E0:89")).toBe("0040E089");
  });

  it("elimina separadores de tipo punto", () => {
    expect(normalizeRFIDTag("00.40.E0.89")).toBe("0040E089");
  });

  it("maneja espacios y convierte a uppercase", () => {
    expect(normalizeRFIDTag("  40e089  ")).toBe("0040E089");
  });

  it("acepta tag ya normalizado sin cambios", () => {
    expect(normalizeRFIDTag("0040E089")).toBe("0040E089");
  });

  it("lanza error para formato no reconocido", () => {
    expect(() => normalizeRFIDTag("ZZZ-INVALID")).toThrow(
      "Formato de tag RFID no reconocido"
    );
  });

  it("maneja el valor 0 correctamente", () => {
    expect(normalizeRFIDTag("0")).toBe("00000000");
  });

  it("maneja el valor máximo de 32 bits", () => {
    expect(normalizeRFIDTag("4294967295")).toBe("FFFFFFFF");
  });
});

describe("hexToDecimal", () => {
  it("convierte hex a decimal correctamente", () => {
    expect(hexToDecimal("0040E089")).toBe(4_251_785);
  });

  it("convierte FFFFFFFF a 4294967295", () => {
    expect(hexToDecimal("FFFFFFFF")).toBe(4_294_967_295);
  });
});

describe("isValidRFIDTag", () => {
  it("acepta tag de exactamente 8 caracteres hex", () => {
    expect(isValidRFIDTag("0040E089")).toBe(true);
    expect(isValidRFIDTag("FFFFFFFF")).toBe(true);
    expect(isValidRFIDTag("00000000")).toBe(true);
  });

  it("rechaza tags de longitud incorrecta", () => {
    expect(isValidRFIDTag("40E089")).toBe(false);
    expect(isValidRFIDTag("0040E0890")).toBe(false);
  });

  it("rechaza tags con caracteres no hex", () => {
    expect(isValidRFIDTag("0040E08Z")).toBe(false);
    expect(isValidRFIDTag("GGGGGGGG")).toBe(false);
  });

  it("rechaza string vacío", () => {
    expect(isValidRFIDTag("")).toBe(false);
  });
});
