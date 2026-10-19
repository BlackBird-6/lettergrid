import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import LetterGrid from './components/LetterGrid';
import Sidebar from './components/Sidebar';
import { findPaths, parseGrid } from './utils/solver';
import useSolver from './utils/useSolver';
import { newId, normalizeGroups } from './utils/groups';

const CUSTOM_GRID_KEY = 'letterGridCustomGrid';
// Pause after the last keystroke in the equivalences box before re-solving.
const EQUIV_DEBOUNCE_MS = 300;

// localStorage can be unavailable (private mode, blocked storage) or hold a
// corrupted value; neither should stop the app from loading.
const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* not persisted */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* not persisted */ }
  },
};

function loadSavedQueries() {
  try {
    return normalizeGroups(JSON.parse(storage.get('letterGridQueries') || '[]'));
  } catch {
    return [];
  }
}

// Memoised so hovering a word (which re-renders App) doesn't re-render every chip.
const WordList = memo(function WordList({ words, setSearchQuery, setHoverWord }) {
  return (
    <div className="flex flex-wrap gap-2 max-h-[250px] overflow-y-auto pr-2">
      {words.map(word => (
        <div
          key={word}
          onClick={() => setSearchQuery(word)}
          onMouseEnter={() => setHoverWord(word)}
          onMouseLeave={() => setHoverWord(null)}
          className="bg-slate-900/60 border border-white/20 px-3 py-1 rounded-full text-sm cursor-pointer transition-colors hover:bg-blue-500 hover:border-blue-600 text-slate-200"
        >
          {word}
        </div>
      ))}
    </div>
  );
});

function App() {
  const { setWords, solve } = useSolver();
  const [gridData, setGridData] = useState([]);
  const [defaultGridText, setDefaultGridText] = useState('');
  const [isCustomGrid, setIsCustomGrid] = useState(false);
  const [wordsReady, setWordsReady] = useState(false);
  const [allWords, setAllWords] = useState([]);
  const [tileWords, setTileWords] = useState([]);
  const [isComputing, setIsComputing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Initializing...');

  const [savedQueries, setSavedQueries] = useState(loadSavedQueries);

  const [settings, setSettings] = useState({
    reuse: storage.get('letterGridReuse') === 'true',
    straight: storage.get('letterGridStraight') === 'true',
    showLines: storage.get('letterGridShowLines') !== 'false',
    equivalencies: storage.get('letterGridEquiv') || ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [color, setColor] = useState('#ef4444');
  const [selectedCells, setSelectedCells] = useState([]);
  const [inspectedTile, setInspectedTile] = useState(null);
  const [hoverWord, setHoverWord] = useState(null);
  // The group being edited: { id, name }. While set, the search bar, colour and
  // selected cells hold that group's contents, and Save writes them back.
  const [editing, setEditing] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    storage.set('letterGridQueries', JSON.stringify(savedQueries));
  }, [savedQueries]);

  useEffect(() => {
    storage.set('letterGridReuse', settings.reuse);
    storage.set('letterGridStraight', settings.straight);
    storage.set('letterGridShowLines', settings.showLines);
    storage.set('letterGridEquiv', settings.equivalencies);
  }, [settings]);

  const showGrid = (grid) => {
    setGridData(grid);
    setSelectedCells([]);
    setInspectedTile(null);
  };

  useEffect(() => {
    (async () => {
      setIsComputing(true);
      setLoadingMsg('Loading static files...');
      try {
        const [wRes, lRes] = await Promise.all([fetch('/words.txt'), fetch('/letters.txt')]);
        const [wText, lText] = await Promise.all([wRes.text(), lRes.text()]);
        const words = wText.split('\n').map(w => w.trim().toUpperCase()).filter(Boolean);
        setWords(words);
        setWordsReady(true);
        setDefaultGridText(lText);

        const customText = storage.get(CUSTOM_GRID_KEY);
        const customGrid = customText ? parseGrid(customText) : [];
        const grid = customGrid.length ? customGrid : parseGrid(lText);
        setIsCustomGrid(customGrid.length > 0);
        showGrid(grid);
      } catch (err) {
        console.error(err);
        setIsComputing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // on mount

  // Returns an error string, or null on success.
  const handleGridImport = (text) => {
    const grid = parseGrid(text);
    if (!grid.length) return 'The grid is empty.';
    storage.set(CUSTOM_GRID_KEY, text);
    setIsCustomGrid(true);
    showGrid(grid);
    return null;
  };

  const handleGridReset = () => {
    storage.remove(CUSTOM_GRID_KEY);
    const grid = parseGrid(defaultGridText);
    setIsCustomGrid(false);
    showGrid(grid);
  };

  const { reuse, straight, equivalencies } = settings;

  // Re-solve whenever the grid or a search option changes. Typing in the
  // equivalences box is debounced; everything else re-solves immediately.
  const lastEquiv = useRef(equivalencies);
  useEffect(() => {
    if (!wordsReady || !gridData.length) return;
    const delay = lastEquiv.current === equivalencies ? 0 : EQUIV_DEBOUNCE_MS;
    lastEquiv.current = equivalencies;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsComputing(true);
      setLoadingMsg('Computing paths...');
      const result = await solve(gridData, { reuse, straight, equivalencies });
      // null means a newer request superseded this one; let that one finish.
      if (cancelled || !result) return;
      setTileWords(result.tileWords);
      setAllWords(result.allWords);
      setIsComputing(false);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wordsReady, gridData, reuse, straight, equivalencies, solve]);
  const pathFinder = useCallback(
    (w) => findPaths(w, gridData, { reuse, straight, equivalencies }),
    [gridData, reuse, straight, equivalencies]
  );
  const activeWord = hoverWord || searchQuery;
  const currentPaths = useMemo(() => pathFinder(activeWord), [pathFinder, activeWord]);

  const updateSetting = (key, val) => {
    setSettings(s => ({ ...s, [key]: val }));
  };

  // A group deleted (or cleared) mid-edit simply ends the edit.
  const editingGroup = editing && savedQueries.find(g => g.id === editing.id);

  const editError = (() => {
    if (!editingGroup) return '';
    const name = editing.name.trim().toUpperCase();
    if (!name) return 'The group needs a name.';
    // Saving outside edit mode updates the group with the same name, so names stay unique.
    if (savedQueries.some(g => g.id !== editing.id && g.name === name)) return `"${name}" already exists.`;
    if (!searchQuery.trim() && !selectedCells.length) return 'Enter a word or select cells.';
    return '';
  })();

  const startEditing = (id) => {
    const group = savedQueries.find(g => g.id === id);
    if (!group) return;
    setEditing({ id, name: group.name });
    setSearchQuery(group.word);
    setSelectedCells(group.cells);
    setColor(group.color);
    searchInputRef.current?.focus();
  };

  const stopEditing = () => {
    setEditing(null);
    setSearchQuery('');
    setSelectedCells([]);
  };

  const toggleEditing = (id) => (editingGroup?.id === id ? stopEditing() : startEditing(id));

  // Outside edit mode, clicking a group copies its word and colour into the
  // search bar as an independent query; the group itself is untouched.
  const loadGroup = (group) => {
    if (editingGroup) return;
    setSearchQuery(group.word);
    setColor(group.color);
  };

  const handleSave = () => {
    const word = searchQuery.trim().toUpperCase();
    const cells = [...selectedCells];

    if (editingGroup) {
      if (editError) return;
      const name = editing.name.trim().toUpperCase();
      setSavedQueries(savedQueries.map(g => (g.id === editing.id ? { ...g, name, word, cells, color } : g)));
      stopEditing();
      return;
    }

    if (!word && !cells.length) return;
    let name = word;
    if (!name) {
      const promptName = prompt('Enter a name for this group:', 'My Group');
      if (!promptName || !promptName.trim()) return;
      name = promptName.trim().toUpperCase();
    }
    const existing = savedQueries.find(g => g.name === name);
    if (existing) {
      setSavedQueries(savedQueries.map(g => (g.id === existing.id ? { ...g, word, cells, color } : g)));
    } else {
      setSavedQueries([...savedQueries, { id: newId(), name, word, cells, color, visible: true }]);
    }
    if (cells.length) {
      setSelectedCells([]);
      setSearchQuery('');
    }
  };

  const handleSearchKeyDown = (e) => {
    if (!editingGroup) return;
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') stopEditing();
  };

  return (
    <div className="w-full min-h-screen">
      <header className="w-full py-8 text-center">
        <h1 className="m-0 text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">LetterGrid</h1>
      </header>

      <div className="flex flex-col lg:flex-row gap-12 w-11/12 mx-auto mb-12 items-start justify-center">
        <div className="flex flex-col gap-6 flex-none max-w-full">
          <div className={`flex flex-col gap-3 bg-slate-800/70 p-4 rounded-2xl backdrop-blur-md border shadow-2xl transition ${editingGroup ? 'border-yellow-400/60' : 'border-white/10'}`}>
          <div className="flex gap-4 items-center">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value.toUpperCase())}
              onKeyDown={handleSearchKeyDown}
              placeholder={editingGroup ? 'Word for this group (optional)' : 'Type a word...'}
              className={`flex-grow min-w-0 p-3 rounded-lg border bg-slate-900/60 text-white text-xl font-semibold outline-none transition uppercase ${editingGroup ? 'border-yellow-400 ring-2 ring-yellow-400/40 focus:border-yellow-300' : 'border-white/20 focus:border-sky-400'}`}
            />
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-10 h-10 flex-none border-none rounded-full cursor-pointer bg-transparent"
            />
            <button
              onClick={handleSave}
              disabled={!!editError}
              className={`py-3 px-6 active:scale-95 border-none rounded-lg font-semibold text-base cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed ${editingGroup ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-900' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
            >
              Save
            </button>
          </div>
          {editingGroup && (
            <p className="m-0 text-sm text-yellow-200/90">
              Editing <span className="font-semibold">{editingGroup.name}</span>. Change the word, colour or Ctrl-selected cells, then Save. Esc or the edit button cancels.
              {editError && <span className="block text-red-400 mt-1">{editError}</span>}
            </p>
          )}
          </div>

          <LetterGrid
            gridData={gridData}
            searchPaths={currentPaths}
            searchColor={color}
            savedQueries={savedQueries}
            hiddenGroupId={editingGroup?.id}
            settings={settings}
            selectedCells={selectedCells}
            setSelectedCells={setSelectedCells}
            inspectedTile={inspectedTile}
            setInspectedTile={setInspectedTile}
            tileWords={tileWords}
            setSearchQuery={setSearchQuery}
            setHoverWord={setHoverWord}
            findPaths={pathFinder}
          />
        </div>

        <Sidebar
          settings={settings}
          updateSetting={updateSetting}
          isComputing={isComputing}
          loadingMsg={loadingMsg}
          savedQueries={savedQueries}
          setSavedQueries={setSavedQueries}
          editing={editingGroup ? editing : null}
          setEditingName={name => setEditing(ed => ({ ...ed, name }))}
          editError={editError}
          onToggleEdit={toggleEditing}
          onLoadGroup={loadGroup}
          onSave={handleSave}
          onCancelEdit={stopEditing}
          gridData={gridData}
          isCustomGrid={isCustomGrid}
          onGridImport={handleGridImport}
          onGridReset={handleGridReset}
        />
      </div>

      <div className="w-11/12 max-w-7xl mx-auto mb-8 bg-slate-800/70 border border-white/10 rounded-2xl p-6 shadow-xl">
        <h2 className="mt-0 text-2xl border-b border-white/10 pb-2 mb-4">
          All Found Words <span className="text-slate-400 text-lg font-normal">({allWords.length})</span>
        </h2>
        <WordList words={allWords} setSearchQuery={setSearchQuery} setHoverWord={setHoverWord} />
      </div>
    </div>
  );
}

export default App;
