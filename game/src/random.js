// Sky Courier — deterministic seeded random numbers.
// Mulberry32: small, fast, and the same seed always deals the same world,
// so a screenshot staged with &seed=7 is the same frame every time.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1-D value noise from the seeded stream: a fixed table of control
// points, linearly interpolated with a smoothstep, so terrain is rolling
// rather than jagged.
export function makeNoise(rand, points, span) {
  const values = [];
  for (let i = 0; i < points; i += 1) values.push(rand() * 2 - 1);
  return function noise(x) {
    const pos = x / span;
    const i = Math.floor(pos);
    const f = pos - i;
    const a = values[((i % points) + points) % points];
    const b = values[(((i + 1) % points) + points) % points];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}
