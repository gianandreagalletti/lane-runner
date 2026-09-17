// Mulberry32 seeded PRNG — deterministic, no Math.random().
// Use this for any gameplay randomness. For visual-only randomness use Math.random() in rendering code.
export function makeRng(seed) {
  let s = seed >>> 0;
  return {
    next() {
      s += 0x6D2B79F5 | 0;
      let z = Math.imul(s ^ (s >>> 15), s | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
    },
    getState() { return s >>> 0; },
    setState(v) { s = v >>> 0; }
  };
}
