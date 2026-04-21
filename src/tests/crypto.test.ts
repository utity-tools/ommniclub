import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

// Importación dinámica para que el env esté seteado antes del módulo
const { encrypt, decrypt } = await import("@/lib/crypto");

describe("AES-256-GCM crypto", () => {
  it("cifra y descifra un DNI correctamente", () => {
    const plain = "12345678A";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("produce ciphertexts distintos para el mismo plaintext (IV aleatorio)", () => {
    const plain = "12345678A";
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it("el ciphertext tiene el formato iv:data:tag (3 partes base64)", () => {
    const parts = encrypt("test").split(":");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("lanza si el ciphertext está corrupto", () => {
    expect(() => decrypt("invalido")).toThrow("Formato de ciphertext inválido");
  });

  it("lanza si ENCRYPTION_KEY es inválida", () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "short";
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-char hex string");
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("cifra cadenas con caracteres especiales y unicode", () => {
    const plain = "García Ñoño 日本語 🔑";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });
});
