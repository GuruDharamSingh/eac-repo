const TABLE: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** 1 -> "I", 14 -> "XIV". Out-of-range input falls back to the plain number. */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  let rest = n;
  let out = "";
  for (const [v, s] of TABLE) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}
