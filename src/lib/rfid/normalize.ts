/**
 * Normaliza un tag RFID a formato hexadecimal uppercase de 8 caracteres.
 *
 * Los lectores USB baratos emiten el ID en distintos formatos según firmware:
 * - Decimal (10 dígitos): "0004256841"
 * - Hex sin padding: "40e089"
 * - Hex con separadores: "40:E0:89:AB"
 * - Little-endian byte-swapped (algunos lectores Wiegand emulados)
 */
export function normalizeRFIDTag(raw: string): string {
  const cleaned = raw.trim().replace(/[\s:.-]/g, "").toUpperCase();

  // Decimal puro (solo dígitos) → convertir a hex
  if (/^\d+$/.test(cleaned)) {
    const hex = parseInt(cleaned, 10).toString(16).toUpperCase().padStart(8, "0");
    return hex;
  }

  // Ya es hex → normalizar padding a 8 chars
  if (/^[0-9A-F]+$/.test(cleaned)) {
    return cleaned.padStart(8, "0");
  }

  throw new Error(`Formato de tag RFID no reconocido: "${raw}"`);
}

/** Convierte hex normalizado a decimal (para mostrar al staff) */
export function hexToDecimal(hex: string): number {
  return parseInt(hex, 16);
}

/** Valida que un tag normalizado tiene el formato correcto */
export function isValidRFIDTag(tag: string): boolean {
  return /^[0-9A-F]{8}$/.test(tag);
}
