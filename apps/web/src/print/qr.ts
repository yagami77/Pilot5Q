/**
 * Encodeur QR code minimal, sans dépendance : mode octets, correction M, versions 1 à 10
 * (jusqu'à 213 octets), choix du masque par pénalité. Rend une matrice de modules que
 * `QrSvg` dessine en vecteur.
 */

/** Par version : [codewords EC par bloc, blocs du groupe 1, données/bloc, blocs du groupe 2, données/bloc]. */
const EC_M: [number, number, number, number, number][] = [
  [0, 0, 0, 0, 0],
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
];

const ALIGN: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/* ---------- Corps de Galois GF(256), polynôme 0x11d ---------- */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

function mul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!;
}

function rsGenerator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j]! ^= g[j]!;
      next[j + 1]! ^= mul(g[j]!, EXP[i]!);
    }
    g = next;
  }
  return g;
}

function rsEncode(data: number[], n: number): number[] {
  const g = rsGenerator(n);
  const res = new Array<number>(n).fill(0);
  for (const d of data) {
    const f = d ^ res[0]!;
    res.shift();
    res.push(0);
    if (f) for (let j = 0; j < n; j++) res[j]! ^= mul(g[j + 1]!, f);
  }
  return res;
}

/* ---------- Flux de bits ---------- */

class Bits {
  bits: number[] = [];
  push(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

function dataCodewords(version: number): number {
  const [, b1, d1, b2, d2] = EC_M[version]!;
  return b1 * d1 + b2 * d2;
}

function chooseVersion(byteLength: number): number {
  for (let v = 1; v <= 10; v++) {
    const bits = dataCodewords(v) * 8;
    const header = 4 + (v < 10 ? 8 : 16);
    if (header + byteLength * 8 <= bits) return v;
  }
  throw new Error("Texte trop long pour un QR code de version ≤ 10");
}

function encodeCodewords(bytes: Uint8Array, version: number): number[] {
  const cap = dataCodewords(version);
  const bs = new Bits();
  bs.push(0b0100, 4);
  bs.push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) bs.push(b, 8);
  bs.push(0, Math.min(4, cap * 8 - bs.bits.length));
  while (bs.bits.length % 8) bs.bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bs.bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bs.bits[i + j]!;
    data.push(v);
  }
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);

  // Blocs et entrelacement
  const [ec, b1, d1, b2, d2] = EC_M[version]!;
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let k = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const len = i < b1 ? d1 : d2;
    const block = data.slice(k, k + len);
    k += len;
    blocks.push(block);
    ecBlocks.push(rsEncode(block, ec));
  }
  const out: number[] = [];
  const maxLen = Math.max(d1, d2);
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) out.push(b[i]!);
  for (let i = 0; i < ec; i++) for (const b of ecBlocks) out.push(b[i]!);
  return out;
}

/* ---------- Matrice ---------- */

type Grid = boolean[][];

function makeGrid(size: number): Grid {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function placeFunctionPatterns(version: number): { modules: Grid; reserved: Grid } {
  const size = version * 4 + 17;
  const modules = makeGrid(size);
  const reserved = makeGrid(size);
  const set = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r]![c] = dark;
    reserved[r]![c] = true;
  };
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const d = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(r0 + r, c0 + c, d !== 2 && d !== 4);
      }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const al = ALIGN[version]!;
  const last = al[al.length - 1];
  for (const r of al)
    for (const c of al) {
      // Les trois positions qui chevauchent un motif de repérage sont omises
      if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++)
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  // Zones d'information de format (réservées, écrites ensuite)
  for (let i = 0; i < 9; i++) {
    if (i === 6) continue; // motif de synchronisation
    set(8, i, false);
    set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false);
    set(size - 1 - i, 8, false);
  }
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }
  return { modules, reserved };
}

function placeData(modules: Grid, reserved: Grid, codewords: number[]) {
  const size = modules.length;
  let idx = 0;
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let k = 0; k < size; k++) {
      const row = up ? size - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (reserved[row]![c]) continue;
        const bit =
          idx < codewords.length * 8 && ((codewords[idx >> 3]! >>> (7 - (idx & 7))) & 1) === 1;
        modules[row]![c] = bit;
        idx++;
      }
    }
    up = !up;
  }
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function writeFormat(modules: Grid, mask: number) {
  const size = modules.length;
  const data = (0b00 << 3) | mask; // niveau M
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  // set(x = colonne, y = ligne)
  const set = (x: number, y: number, v: boolean) => {
    modules[y]![x] = v;
  };
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
}

function penalty(m: Grid): number {
  const size = m.length;
  let score = 0;
  const runs = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j <= size; j++) {
        if (j < size && get(i, j) === get(i, j - 1)) run++;
        else {
          if (run >= 5) score += 3 + run - 5;
          run = 1;
        }
      }
      // Motifs 1:1:3:1:1 bordés de 4 clairs
      for (let j = 0; j + 11 <= size; j++) {
        const w = Array.from({ length: 11 }, (_, k) => get(i, j + k));
        const p = [true, false, true, true, true, false, true];
        const left = w.slice(0, 4).every((v) => !v) && p.every((v, k) => w[4 + k] === v);
        const right = w.slice(7).every((v) => !v) && p.every((v, k) => w[k] === v);
        if (left || right) score += 40;
      }
    }
  };
  runs((i, j) => m[i]![j]!);
  runs((i, j) => m[j]![i]!);
  for (let r = 0; r + 1 < size; r++)
    for (let c = 0; c + 1 < size; c++) {
      const v = m[r]![c];
      if (m[r]![c + 1] === v && m[r + 1]![c] === v && m[r + 1]![c + 1] === v) score += 3;
    }
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return score + Math.max(0, k) * 10;
}

/** Matrice des modules (true = sombre) d'un QR code (mode octets, correction M). */
export function qrMatrix(text: string): Grid {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  const codewords = encodeCodewords(bytes, version);
  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const { modules, reserved } = placeFunctionPatterns(version);
    placeData(modules, reserved, codewords);
    for (let r = 0; r < modules.length; r++)
      for (let c = 0; c < modules.length; c++)
        if (!reserved[r]![c] && maskBit(mask, r, c)) modules[r]![c] = !modules[r]![c];
    writeFormat(modules, mask);
    const s = penalty(modules);
    if (s < bestScore) {
      bestScore = s;
      best = modules;
    }
  }
  return best!;
}

/** Chemin SVG (unités = modules) des modules sombres, origine en haut à gauche. */
export function qrPath(grid: Grid): string {
  let d = "";
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v) d += `M${c} ${r}h1v1h-1z`;
    }),
  );
  return d;
}
