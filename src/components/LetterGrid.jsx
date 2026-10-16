import { useMemo, memo } from 'react';

// Must match --gap-ratio in index.css: the gap between tiles, in tile widths.
const GAP = 1 / 7;
const STEP = 1 + GAP;

const TileWords = memo(function TileWords({ info, setSearchQuery, setHoverWord }) {
  return (
    <div className="w-64 flex-none bg-slate-800/70 rounded-3xl p-6 shadow-2xl border border-white/10 backdrop-blur-md">
      <h2 className="mt-0 text-xl text-slate-200 border-b border-white/10 pb-2 mb-4">
        Words on {info.letter} ({info.r},{info.c})
      </h2>
      <ul className="list-none p-0 m-0 max-h-[400px] overflow-y-auto flex flex-col gap-2">
        {info.words.length === 0 ? (
          <li className="text-slate-400 italic">No words found</li>
        ) : (
          info.words.map(w => (
            <li
              key={w}
              onClick={() => setSearchQuery(w)}
              onMouseEnter={() => setHoverWord(w)}
              onMouseLeave={() => setHoverWord(null)}
              className="bg-slate-900/40 p-2 rounded-lg cursor-pointer hover:bg-slate-700/80 transition font-semibold"
            >
              {w}
            </li>
          ))
        )}
      </ul>
    </div>
  );
});

export default function LetterGrid({
  gridData,
  searchPaths,
  searchColor,
  savedQueries,
  settings,
  selectedCells,
  setSelectedCells,
  inspectedTile,
  setInspectedTile,
  tileWords,
  setSearchQuery,
  setHoverWord,
  findPaths
}) {
  const rows = gridData.length;
  const cols = rows > 0 ? gridData[0].length : 0;
  const inBounds = ([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols;

  // Saved layers only change when the saved list, grid or search options do,
  // not on every hover.
  const savedLayers = useMemo(() => {
    const layers = [];
    savedQueries.forEach(q => {
      if (!q.visible) return;
      if (q.type === 'group') {
        // Groups saved against a different grid may point outside this one.
        const cells = q.cells.filter(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols);
        if (cells.length) layers.push({ paths: [cells], color: q.color, noLines: true });
      } else {
        const qPaths = findPaths(q.word);
        if (qPaths.length > 0) layers.push({ paths: qPaths, color: q.color });
      }
    });
    return layers;
  }, [savedQueries, findPaths, rows, cols]);

  const layers = [];
  if (searchPaths.length > 0) layers.push({ paths: searchPaths, color: searchColor });
  layers.push(...savedLayers);
  if (selectedCells.length > 0) {
    layers.push({ paths: [selectedCells.filter(inBounds)], color: searchColor, noLines: true, isSelection: true });
  }

  const tileStates = {}; // `${r},${c}` -> { active, selected, background }
  const linesToDraw = [];
  layers.forEach(item => {
    item.paths.forEach(path => {
      let d = '';
      path.forEach(([r, c], idx) => {
        const key = `${r},${c}`;
        const state = tileStates[key] || (tileStates[key] = { active: false, selected: false, background: '' });
        state.active = true;
        if (item.isSelection) state.selected = true;
        state.background = item.color;
        // Tile centre in viewBox units, where one tile is 1 unit wide.
        d += `${idx === 0 ? 'M' : 'L'} ${c * STEP + 0.5} ${r * STEP + 0.5} `;
      });
      if (settings.showLines && !item.noLines && path.length > 1) {
        linesToDraw.push({ d, color: item.color });
      }
    });
  });

  const handleTileClick = (e, r, c) => {
    if (e.ctrlKey || e.metaKey) {
      const idx = selectedCells.findIndex(pos => pos[0] === r && pos[1] === c);
      if (idx > -1) {
        setSelectedCells(selectedCells.filter((_, i) => i !== idx));
      } else {
        setSelectedCells([...selectedCells, [r, c]]);
      }
      return;
    }
    setSelectedCells([]);
    setInspectedTile([r, c]);
  };

  const inspected = useMemo(() => {
    if (!inspectedTile) return null;
    const [r, c] = inspectedTile;
    if (r >= rows || c >= cols) return null;
    const letter = gridData[r][c];
    const words = tileWords[r * cols + c] || [];
    const startsWith = words.filter(w => w.startsWith(letter));
    const others = words.filter(w => !w.startsWith(letter));
    return { letter, r, c, words: [...startsWith, ...others] };
  }, [inspectedTile, tileWords, gridData, rows, cols]);

  const width = cols * STEP - GAP;
  const height = rows * STEP - GAP;

  return (
    <div className="flex flex-wrap gap-8 items-start max-w-full">
      <div className="bg-slate-800/70 p-4 sm:p-8 rounded-3xl shadow-2xl border border-white/5 backdrop-blur-md max-w-full overflow-auto">
        <div className={`grid-board relative ${inspected ? 'with-panel' : ''}`} style={{ '--cols': cols, '--rows': rows }}>
          <div className="grid relative z-10" style={{ gridTemplateColumns: `repeat(${cols}, var(--tile))` }}>
            {gridData.map((row, r) =>
              row.map((letter, c) => {
                const key = `${r},${c}`;
                if (!letter) return <div key={key} className="tile-empty" />;
                const state = tileStates[key] || {};
                return (
                  <div
                    key={key}
                    onClick={(e) => handleTileClick(e, r, c)}
                    className={`tile cursor-pointer ${state.active ? 'active' : ''} ${state.selected ? 'selected' : ''}`}
                    style={state.background ? { background: state.background } : undefined}
                  >
                    {letter}
                  </div>
                );
              })
            )}
          </div>

          {linesToDraw.length > 0 && (
            <svg
              className="path-layer absolute inset-0 w-full h-full pointer-events-none z-20"
              viewBox={`0 0 ${width} ${height}`}
            >
              {linesToDraw.map((line, i) => (
                <path key={i} d={line.d} className="line-path" stroke={line.color} />
              ))}
            </svg>
          )}
        </div>
      </div>

      {inspected && (
        <TileWords info={inspected} setSearchQuery={setSearchQuery} setHoverWord={setHoverWord} />
      )}
    </div>
  );
}
