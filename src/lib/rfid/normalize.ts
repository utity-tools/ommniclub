/**
 * Normaliza un tag RFID a formato hexadecimal uppercase de 8 caracteres.
 *
 * Formatos soportados (salida de lectores USB genéricos):
 * - Decimal puro:       "4251785"   → "0040E089"
 * - Hex sin padding:    "40e089"    → "0040E089"
 * - Hex con colones:    "00:40:E0:89" → "0040E089"
 */

const RE_SEPARATORS = /[\s:.-]/g;
const RE_DECIMAL = /^\d+$/;
const RE_HEX = /^[0-9A-F]+$/;
const RE_VALID_TAG = /^[0-9A-F]{8}$/;

export function normalizeRFIDTag(raw: string): string {
  const cleaned = raw.trim().replace(RE_SEPARATORS, "").toUpperCase();

  if (RE_DECIMAL.test(cleaned)) {
    return parseInt(cleaned, 10).toString(16).toUpperCase().padStart(8, "0");
  }

  if (RE_HEX.test(cleaned)) {
    return cleaned.padStart(8, "0");
  }

  throw new Error(`Formato de tag RFID no reconocido: "${raw}"`);
}

export function hexToDecimal(hex: string): number {
  return parseInt(hex, 16);
}

export function isValidRFIDTag(tag: string): boolean {
  return RE_VALID_TAG.test(tag);
}
