/**
 * Exact fraction arithmetic for Faraid (GCD-reduced).
 * Avoids floating-point errors when showing 1/8, 1/6, 2/3, etc.
 */
export class Fraction {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('Denominator cannot be zero');
    this.n = Number(n);
    this.d = Number(d);
    this._reduce();
  }

  static gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a || 1;
  }

  static lcm(a, b) {
    return Math.abs(a * b) / Fraction.gcd(a, b);
  }

  _reduce() {
    if (this.n === 0) { this.d = 1; return; }
    const g = Fraction.gcd(this.n, this.d);
    let sign = this.d < 0 ? -1 : 1;
    this.n = (this.n / g) * sign;
    this.d = Math.abs(this.d / g);
  }

  get reduced() { return new Fraction(this.n, this.d); }
  get toDouble() { return this.n / this.d; }

  toDisplayString() {
    if (this.d === 1) return String(this.n);
    if (this.n === 0) return '0';
    return `${this.n}/${this.d}`;
  }

  plus(o) {
    const cd = Fraction.lcm(this.d, o.d);
    return new Fraction(this.n * (cd / this.d) + o.n * (cd / o.d), cd);
  }

  minus(o) {
    const cd = Fraction.lcm(this.d, o.d);
    return new Fraction(this.n * (cd / this.d) - o.n * (cd / o.d), cd);
  }

  times(o) { return new Fraction(this.n * o.n, this.d * o.d); }

  div(o) {
    if (o.n === 0) throw new Error('Divide by zero');
    return new Fraction(this.n * o.d, this.d * o.n);
  }

  static ZERO = new Fraction(0, 1);
  static ONE = new Fraction(1, 1);
  static HALF = new Fraction(1, 2);
  static ONE_THIRD = new Fraction(1, 3);
  static TWO_THIRDS = new Fraction(2, 3);
  static ONE_FOURTH = new Fraction(1, 4);
  static ONE_SIXTH = new Fraction(1, 6);
  static ONE_EIGHTH = new Fraction(1, 8);

  static fromNumber(x, maxDen = 24) {
    // Best simple fraction approximation for display
    let bestN = 0, bestD = 1, bestErr = Math.abs(x);
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(x * d);
      const err = Math.abs(x - n / d);
      if (err < bestErr) { bestErr = err; bestN = n; bestD = d; }
    }
    return new Fraction(bestN, bestD);
  }
}
