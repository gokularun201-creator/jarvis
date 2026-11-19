/**
 * Tiny recursive-descent evaluator. No eval / Function constructor,
 * so a voice transcript can never execute arbitrary code.
 */
export function evaluateExpression(input: string): number | null {
  const src = input
    .toLowerCase()
    .replace(/[×x]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\btimes\b|\bmultiplied by\b/g, '*')
    .replace(/\bdivided by\b|\bover\b/g, '/')
    .replace(/\bto the power of\b|\bpower\b/g, '^')
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\be\b/g, String(Math.E))
    .replace(/[^0-9+\-*/().^%\s]/g, ' ')
    .trim();

  if (!src || !/[0-9]/.test(src)) return null;

  let i = 0;

  const peek = () => src[i];
  const skip = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };

  function parseNumber(): number {
    skip();
    if (peek() === '-' ) {
      i++;
      return -parseNumber();
    }
    if (peek() === '+') {
      i++;
      return parseNumber();
    }
    const start = i;
    while (i < src.length && /[0-9.]/.test(src[i])) i++;
    if (start === i) throw new Error('bad expression');
    return Number(src.slice(start, i));
  }

  function parsePrimary(): number {
    skip();
    if (peek() === '(') {
      i++;
      const value = parseSum();
      skip();
      if (peek() !== ')') throw new Error('unbalanced');
      i++;
      return value;
    }
    return parseNumber();
  }

  function parsePower(): number {
    const base = parsePrimary();
    skip();
    if (peek() === '^') {
      i++;
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseProduct(): number {
    let value = parsePower();
    for (;;) {
      skip();
      const op = peek();
      if (op === '*' || op === '/' || op === '%') {
        i++;
        const rhs = parsePower();
        if (op === '*') value *= rhs;
        else if (op === '/') {
          if (rhs === 0) throw new Error('divide by zero');
          value /= rhs;
        } else value %= rhs;
      } else return value;
    }
  }

  function parseSum(): number {
    let value = parseProduct();
    for (;;) {
      skip();
      const op = peek();
      if (op === '+' || op === '-') {
        i++;
        const rhs = parseProduct();
        value = op === '+' ? value + rhs : value - rhs;
      } else return value;
    }
  }

  try {
    const result = parseSum();
    skip();
    if (i < src.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

export function prettyNumber(n: number): string {
  const rounded = Math.round(n * 1e6) / 1e6;
  return rounded.toLocaleString('en-US');
}
