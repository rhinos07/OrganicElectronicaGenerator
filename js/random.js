// Seeded pseudo random number generator (mulberry32) with musical helpers.
// The same seed always produces the same piece of music.

export function createRng(seed) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** Float in [min, max). */
    range: (min, max) => min + (max - min) * next(),
    /** Integer in [min, max] (both inclusive). */
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    /** Random element of a list. */
    pick: (list) => list[Math.floor(next() * list.length)],
    /** True with probability p. */
    chance: (p) => next() < p,
    /** Random element, chosen with the given relative weights. */
    weighted(items, weights) {
      const total = weights.reduce((sum, w) => sum + w, 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r < 0) return items[i];
      }
      return items[items.length - 1];
    },
    /** Fisher-Yates shuffle of a copy of the list. */
    shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/** Creates a new random 32-bit seed (not deterministic). */
export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}
