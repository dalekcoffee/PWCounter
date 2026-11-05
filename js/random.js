// Dice and coin, from the browser's cryptographic random source (no modulo bias).

function fairInt(n, rand) {
  const limit = Math.floor(0x100000000 / n) * n;
  for (;;) {
    const x = rand();
    if (x < limit) return x % n;
  }
}

const cryptoRand = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** A whole number 1..sides. `rand` returns a uint32 (injectable for tests). */
export const rollDie = (sides = 6, rand = cryptoRand) => fairInt(sides, rand) + 1;

/** 'heads' | 'tails' */
export const flipCoin = (rand = cryptoRand) => (fairInt(2, rand) === 0 ? 'heads' : 'tails');
