// A saved group: a display name plus what it highlights, an optional word
// (drawn as paths) and optional extra cells (drawn without lines).
//   { id, name, word, cells: [[r, c], ...], color, visible }

export function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Accepts the current shape and the two older ones, so existing saved lists
// and exported JSON keep working:
//   { word, color, visible }                       a saved word
//   { type: 'group', word, cells, color, visible } a cell group (word was its name)
export function normalizeGroup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const isLegacyCellGroup = raw.name === undefined && raw.type === 'group';
  const name = String(raw.name ?? raw.word ?? '').trim().toUpperCase();
  const word = isLegacyCellGroup ? '' : String(raw.word ?? '').trim().toUpperCase();
  const cells = Array.isArray(raw.cells)
    ? raw.cells.filter(p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger))
    : [];
  if (!name || (!word && !cells.length)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name,
    word,
    cells,
    color: typeof raw.color === 'string' ? raw.color : '#ef4444',
    visible: raw.visible !== false,
  };
}

export function normalizeGroups(list) {
  return Array.isArray(list) ? list.map(normalizeGroup).filter(Boolean) : [];
}
