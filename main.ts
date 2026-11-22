import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Tiny stack VM: 32-bit wrapping ints, 256-value data stack, 64-deep call
// stack, 256 words of memory, byte input, capped output, 1M step limit.
function run(p, q) {
  const s = [], c = [], m = new Int32Array(256), ob = Buffer.alloc(65536);
  let ip = 0, pc = 0, n = 0, ol = 0;
  const pop = () => { if (!s.length) throw 2; return s.pop(); };
  const push = v => { if (s.length > 255) throw 3; s.push(v | 0); };
  try {
    for (;;) {
      if (n >= 1e6) throw 10;
      if (pc < 0 || pc >= p.length) throw 9;
      const op = p[pc];
      let L = 1, im = 0;
      if (op === 1 || op === 2 || (op >= 48 && op <= 51)) {
        L = op === 1 ? 2 : op === 2 ? 5 : 3;
        if (pc + L > p.length) throw 9;
        im = op === 1 ? p[pc + 1] : op === 2 ? p.readInt32LE(pc + 1) : p[pc + 1] | (p[pc + 2] << 8);
        if (op === 1 && im > 127) im -= 256;
      }
      const sg = im > 32767 ? im - 65536 : im;
      n++;
      pc += L;
      switch (op) {
        case 0: return [ob.subarray(0, ol), 0];
        case 1: case 2: push(im); break;
        case 3: pop(); break;
        case 4: { const a = pop(); push(a); push(a); break; }
        case 5: { const b = pop(), a = pop(); push(b); push(a); break; }
        case 6: { const b = pop(), a = pop(); push(a); push(b); push(a); break; }
        case 7: { const d = pop(), b = pop(), a = pop(); push(b); push(d); push(a); break; }
        case 16: { const b = pop(), a = pop(); push(a + b); break; }
        case 17: { const b = pop(), a = pop(); push(a - b); break; }
        case 18: { const b = pop(), a = pop(); push(Math.imul(a, b)); break; }
        case 19: { const b = pop(), a = pop(); if (!b) throw 4; push(Math.trunc(a / b)); break; }
        case 20: { const b = pop(), a = pop(); if (!b) throw 4; push((a % b) || 0); break; }
        case 21: { const b = pop(), a = pop(); if (!b) throw 4; push(Math.trunc((a >>> 0) / (b >>> 0))); break; }
        case 22: { const b = pop(), a = pop(); if (!b) throw 4; push((a >>> 0) % (b >>> 0)); break; }
        case 23: push(-pop()); break;
        case 24: { const b = pop(), a = pop(); push(a & b); break; }
        case 25: { const b = pop(), a = pop(); push(a | b); break; }
        case 26: { const b = pop(), a = pop(); push(a ^ b); break; }
        case 27: push(~pop()); break;
        case 28: { const b = pop(), a = pop(); push(a << (b & 31)); break; }
        case 29: { const b = pop(), a = pop(); push(a >> (b & 31)); break; }
        case 30: { const b = pop(), a = pop(); push(a >>> (b & 31)); break; }
        case 32: { const b = pop(), a = pop(); push(a === b ? 1 : 0); break; }
        case 33: { const b = pop(), a = pop(); push(a < b ? 1 : 0); break; }
        case 34: { const b = pop(), a = pop(); push((a >>> 0) < (b >>> 0) ? 1 : 0); break; }
        case 48: pc += sg; break;
        case 49: if (pop() === 0) pc += sg; break;
        case 50: if (pop() !== 0) pc += sg; break;
        case 51: if (c.length > 63) throw 7; c.push(pc); pc = im; break;
        case 52: if (!c.length) throw 8; pc = c.pop(); break;
        case 64: { const a = pop(); if (a < 0 || a > 255) throw 6; push(m[a]); break; }
        case 65: { const a = pop(), v = pop(); if (a < 0 || a > 255) throw 6; m[a] = v; break; }
        case 80: { const v = pop(), t = String(v); if (ol + t.length > 65536) throw 11; ob.write(t, ol, 'ascii'); ol += t.length; break; }
        case 81: { const v = pop(); if (ol > 65535) throw 11; ob[ol++] = v & 255; break; }
        case 82: push(ip < q.length ? q[ip++] : -1); break;
        case 83: return [ob.subarray(0, ol), pop() & 255];
        default: throw 5;
      }
    }
  } catch (x) {
    if (typeof x !== 'number') throw x;
    return [ob.subarray(0, ol), x];
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const d of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, d, 'program.bin')), readFileSync(join(I, d, 'input.bin')));
  mkdirSync(join(O, d), { recursive: true });
  writeFileSync(join(O, d, 'stdout.bin'), r[0]);
  writeFileSync(join(O, d, 'exit.txt'), r[1] + '\n');
}
