// Pure calculator: a list of tokens, numbers as digit strings and the operators + - × ÷.
// × and ÷ are worked out before + and −, left to right.

export const OPS = ['+', '-', '×', '÷'];
const MAX_DIGITS = 9;
const MAX_TOKENS = 41;

const isOp = (t) => OPS.includes(t);
const last = (tokens) => tokens[tokens.length - 1];

export function pressDigit(tokens, d) {
  if (!/^(\d|00)$/.test(d) || tokens.length >= MAX_TOKENS) return tokens;
  const t = last(tokens);
  if (t === undefined || isOp(t)) return [...tokens, d === '00' ? '0' : d];
  if (t.length >= MAX_DIGITS) return tokens;
  const merged = t === '0' ? (d === '00' ? '0' : d) : (t + d).slice(0, MAX_DIGITS);
  return [...tokens.slice(0, -1), merged];
}

export function pressOp(tokens, op) {
  if (!isOp(op)) return tokens;
  const t = last(tokens);
  if (t === undefined) return ['0', op];
  if (isOp(t)) return [...tokens.slice(0, -1), op];
  if (tokens.length >= MAX_TOKENS) return tokens;
  return [...tokens, op];
}

export function backspace(tokens) {
  const t = last(tokens);
  if (t === undefined) return tokens;
  if (isOp(t) || t.length === 1) return tokens.slice(0, -1);
  return [...tokens.slice(0, -1), t.slice(0, -1)];
}

/** A shortcut such as +100 or −500: adds "+ 100" / "− 500" to the sum. */
export function shortcut(tokens, n) {
  if (!Number.isInteger(n) || n === 0) return tokens;
  const op = n > 0 ? '+' : '-';
  const num = String(Math.abs(n));
  if (tokens.length === 0) return n > 0 ? [num] : ['0', op, num];
  const base = isOp(last(tokens)) ? tokens.slice(0, -1) : tokens;
  if (base.length + 2 > MAX_TOKENS) return tokens;
  return [...base, op, num];
}

/** The value of the sum; a trailing operator is ignored. null = nothing yet, NaN = division by zero. */
export function evaluate(tokens) {
  const list = isOp(last(tokens)) ? tokens.slice(0, -1) : tokens;
  if (list.length === 0) return null;
  // first pass: × and ÷
  const terms = [Number(list[0])];
  const signs = [];
  for (let i = 1; i < list.length; i += 2) {
    const op = list[i];
    const n = Number(list[i + 1]);
    if (op === '×') terms[terms.length - 1] *= n;
    else if (op === '÷') terms[terms.length - 1] = n === 0 ? NaN : terms[terms.length - 1] / n;
    else { signs.push(op); terms.push(n); }
  }
  // second pass: + and −
  let total = terms[0];
  signs.forEach((op, i) => { total = op === '+' ? total + terms[i + 1] : total - terms[i + 1]; });
  return total;
}

/** "=": the sum becomes its result (only a whole, finite, non-negative result can be typed on from). */
export function equals(tokens) {
  const v = evaluate(tokens);
  if (v === null || !Number.isFinite(v)) return tokens;
  const r = Math.round(v * 100) / 100;
  if (r < 0) return ['0', '-', String(Math.abs(r))];
  return [String(r)];
}

export function formatNumber(v) {
  if (v === null) return '0';
  if (!Number.isFinite(v)) return 'Error';
  const r = Math.round(v * 100) / 100;
  return r.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export const exprText = (tokens) =>
  tokens.map((t) => (t === '-' ? '−' : isOp(t) ? t : Number(t).toLocaleString('en-US', { maximumFractionDigits: 2 }))).join(' ');
