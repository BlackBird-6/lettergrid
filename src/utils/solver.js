// Grid cells are addressed by flat index (r * cols + c). An empty string marks
// a padding cell in a ragged grid: it renders as a gap and never matches.

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

const MAX_PATHS = 2000;

// Parses "B=D=P, A=E" into letter -> Set of letters it may stand in for.
// Matching is not transitive, mirroring the original behaviour.
export function parseEquivalencies(str = '') {
  const map = new Map();
  for (const groupStr of str.toUpperCase().split(',')) {
    const group = groupStr.split('=').map(c => c.trim()).filter(Boolean);
    for (const a of group) {
      if (!map.has(a)) map.set(a, new Set([a]));
      for (const b of group) map.get(a).add(b);
    }
  }
  return map;
}

// For every cell, the list of letters it can match.
function cellOptions(gridData, equivalencies) {
  const eq = parseEquivalencies(equivalencies);
  return gridData.flat().map(ch => (ch ? (eq.has(ch) ? [...eq.get(ch)] : [ch]) : []));
}

// Precomputed neighbour lists: neighbours[cell][dir] = index, or -1 if off-grid.
function buildNeighbours(rows, cols) {
  const out = new Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[r * cols + c] = DIRS.map(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        return nr >= 0 && nr < rows && nc >= 0 && nc < cols ? nr * cols + nc : -1;
      });
    }
  }
  return out;
}

export function buildTrie(words) {
  const root = { kids: new Map(), word: null };
  for (const word of words) {
    if (word.length <= 1) continue;
    let node = root;
    for (const ch of word) {
      let next = node.kids.get(ch);
      if (!next) node.kids.set(ch, (next = { kids: new Map(), word: null }));
      node = next;
    }
    node.word = word;
  }
  return root;
}

// Walks every grid path once, guided by the trie, so the cost scales with
// the grid rather than with (words x cells).
export function buildWordMap(gridData, trie, { reuse, straight, equivalencies }) {
  const rows = gridData.length;
  const cols = rows ? gridData[0].length : 0;
  const size = rows * cols;
  const options = cellOptions(gridData, equivalencies);
  const neighbours = buildNeighbours(rows, cols);
  const tileSets = Array.from({ length: size }, () => new Set());
  const found = new Set();
  const used = new Uint8Array(size);
  const path = [];

  function visit(cell, node, dir) {
    path.push(cell);
    used[cell] = 1;
    for (const ch of options[cell]) {
      const next = node.kids.get(ch);
      if (!next) continue;
      if (next.word && path.length > 1) {
        found.add(next.word);
        for (const p of path) tileSets[p].add(next.word);
      }
      if (next.kids.size === 0) continue;
      const nbrs = neighbours[cell];
      for (let d = 0; d < 8; d++) {
        if (straight && dir !== -1 && d !== dir) continue;
        const n = nbrs[d];
        if (n === -1 || (!reuse && used[n]) || options[n].length === 0) continue;
        visit(n, next, dir === -1 ? d : dir);
      }
    }
    path.pop();
    used[cell] = 0;
  }

  for (let cell = 0; cell < size; cell++) {
    if (options[cell].length) visit(cell, trie, -1);
  }

  const byLength = (a, b) => b.length - a.length || (a < b ? -1 : 1);
  return {
    tileWords: tileSets.map(s => [...s].sort()),
    allWords: [...found].sort(byLength),
  };
}

// All paths spelling `word`, as arrays of [r, c]. Capped to keep pathological
// inputs (e.g. "EEEEEEE" with reuse on) from hanging the UI.
export function findPaths(word, gridData, { reuse, straight, equivalencies }) {
  const w = word ? word.trim().toUpperCase() : '';
  if (!w || !gridData.length) return [];
  const rows = gridData.length;
  const cols = gridData[0].length;
  const options = cellOptions(gridData, equivalencies);
  const neighbours = buildNeighbours(rows, cols);
  const used = new Uint8Array(rows * cols);
  const path = [];
  const paths = [];

  function dfs(cell, index, dir) {
    if (paths.length >= MAX_PATHS || !options[cell].includes(w[index])) return;
    path.push(cell);
    used[cell] = 1;
    if (index === w.length - 1) {
      paths.push(path.map(p => [Math.floor(p / cols), p % cols]));
    } else {
      const nbrs = neighbours[cell];
      for (let d = 0; d < 8; d++) {
        if (straight && dir !== -1 && d !== dir) continue;
        const n = nbrs[d];
        if (n !== -1 && (reuse || !used[n])) dfs(n, index + 1, dir === -1 ? d : dir);
      }
    }
    path.pop();
    used[cell] = 0;
  }

  for (let cell = 0; cell < rows * cols; cell++) dfs(cell, 0, -1);
  return paths;
}

// Turns pasted/uploaded text into a rectangular grid. Rows may be written as
// "ABC" or "A B C" / "A,B,C"; ragged rows are padded with empty cells.
export function parseGrid(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim().toUpperCase())
    .filter(Boolean)
    .map(l => (/[\s,]/.test(l) ? l.split(/[\s,]+/).join('') : l));
  if (!lines.length) return [];
  const cols = Math.max(...lines.map(l => [...l].length));
  return lines.map(l => {
    const row = [...l];
    while (row.length < cols) row.push('');
    return row;
  });
}

export function gridToText(gridData) {
  return gridData.map(row => row.map(ch => ch || ' ').join('').trimEnd()).join('\n');
}
