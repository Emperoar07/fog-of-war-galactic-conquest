// Browser shim for Node.js 'crypto' module used by @arcium-hq/client.
// Provides randomBytes, createHash, createCipheriv, createDecipheriv stubs.

export function randomBytes(size: number): Buffer {
  const buf = Buffer.alloc(size);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

export function createHash(algorithm: string) {
  // Stub — @arcium-hq/client uses @noble/hashes for actual hashing.
  // This is only called if the code path is reached at runtime.
  throw new Error(`createHash('${algorithm}') is not available in the browser.`);
}

export function createCipheriv(algorithm: string, key: unknown, iv: unknown) {
  void algorithm;
  void key;
  void iv;
  throw new Error("createCipheriv is not available in the browser.");
}

export function createDecipheriv(algorithm: string, key: unknown, iv: unknown) {
  void algorithm;
  void key;
  void iv;
  throw new Error("createDecipheriv is not available in the browser.");
}

const cryptoShim = { randomBytes, createHash, createCipheriv, createDecipheriv };

export default cryptoShim;
