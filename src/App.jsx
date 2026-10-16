import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import LetterGrid from './components/LetterGrid';
import Sidebar from './components/Sidebar';
import { findPaths, parseGrid } from './utils/solver';
import useSolver from './utils/useSolver';

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
    const parsed = JSON.parse(storage.get('letterGridQueries') || '[]');
    return Array.isArray(parsed) ? parsed : [];
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

  const handleSave = () => {
    if (selectedCells.length > 0) {
      let groupName = searchQuery.trim().toUpperCase();
      if (!groupName) {
        const promptName = prompt("Enter a name for this cell group:", "My Group");
        if (!promptName) return;
        groupName = promptName.trim().toUpperCase();
      }
      const existingIdx = savedQueries.findIndex(q => q.word === groupName);
      const newGroup = { type: 'group', word: groupName, cells: [...selectedCells], color, visible: true };
      if (existingIdx > -1) {
        setSavedQueries(savedQueries.map((q, i) => (i === existingIdx ? newGroup : q)));
      } else {
        setSavedQueries([...savedQueries, newGroup]);
      }
      setSelectedCells([]);
      setSearchQuery('');
    } else {
      const word = searchQuery.trim().toUpperCase();
      if (!word) return;
      const existingIdx = savedQueries.findIndex(q => q.word === word);
      if (existingIdx > -1) {
        setSavedQueries(savedQueries.map((q, i) => (i === existingIdx ? { ...q, color } : q)));
      } else {
        setSavedQueries([...savedQueries, { word, color, visible: true }]);
      }
    }
  };

  return (
    <div className="w-full min-h-screen">
      <header className="w-full py-8 text-center">
        <h1 className="m-0 text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">LetterGrid</h1>
      </header>

      <div className="flex flex-col lg:flex-row gap-12 w-11/12 mx-auto mb-12 items-start justify-center">
        <div className="flex flex-col gap-6 flex-none max-w-full">
          <div className="flex gap-4 items-center bg-slate-800/70 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="Type a word..."
              className="flex-grow min-w-0 p-3 rounded-lg border border-white/20 bg-slate-900/60 text-white text-xl font-semibold outline-none transition focus:border-sky-400 uppercase"
            />
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-10 h-10 flex-none border-none rounded-full cursor-pointer bg-transparent"
            />
            <button onClick={handleSave} className="py-3 px-6 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition">
              Save
            </button>
          </div>

          <LetterGrid
            gridData={gridData}
            searchPaths={currentPaths}
            searchColor={color}
            savedQueries={savedQueries}
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
          setSearchQuery={setSearchQuery}
          setColor={setColor}
          setSelectedCells={setSelectedCells}
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
