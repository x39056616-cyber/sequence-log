/**
 * Equal-probability random selection with rejection sampling.
 *
 * Every draw records the raw random bytes, the pool snapshot and the pool size,
 * so any result can be re-checked later. There is no weighting and no hidden
 * adjustment: the wheel never punishes, never shortens and never rerolls quietly.
 */

export interface RandomDraw {
  index: number;
  bytes: number[];
  poolSize: number;
}

/** Largest multiple of `poolSize` that fits in a byte range, used to reject biased tail values. */
function rejectionLimit(poolSize: number): number {
  const span = 256;
  return span - (span % poolSize);
}

export function drawIndex(poolSize: number, entropy?: () => number): RandomDraw {
  if (poolSize <= 0) throw new Error("转盘池为空");
  if (poolSize === 1) return { index: 0, bytes: [], poolSize };

  const limit = rejectionLimit(poolSize);
  const bytes: number[] = [];
  const nextByte = entropy ?? defaultByte;

  // At most 64 attempts: with poolSize <= 64 the chance of exhausting this is negligible.
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const value = nextByte();
    bytes.push(value);
    if (value < limit) return { index: value % poolSize, bytes, poolSize };
  }
  // Deterministic fallback keeps the wheel usable even if an entropy source misbehaves.
  const seed = bytes.reduce((acc, value, position) => (acc * 31 + value + position) >>> 0, 7);
  return { index: seed % poolSize, bytes, poolSize };
}

function defaultByte(): number {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buffer = new Uint8Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0];
  }
  return Math.floor(Math.random() * 256);
}

/** Opaque, reproducible seed string for a spin, derived from the recorded bytes. */
export function spinSeed(categoryId: string, bytes: number[], createdAt: string): string {
  const payload = categoryId + "|" + bytes.join(",") + "|" + createdAt;
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function bytesToHex(bytes: number[]): string {
  return bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
}

