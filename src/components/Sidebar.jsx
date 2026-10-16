import GridImport from './GridImport';

export default function Sidebar({
  settings,
  updateSetting,
  isComputing,
  loadingMsg,
  savedQueries,
  setSavedQueries,
  setSearchQuery,
  setColor,
  setSelectedCells,
  gridData,
  isCustomGrid,
  onGridImport,
  onGridReset
}) {
  const toggleVisibility = (e, index) => {
    e.stopPropagation();
    setSavedQueries(savedQueries.map((q, i) => (i === index ? { ...q, visible: !q.visible } : q)));
  };

  const deleteQuery = (e, index) => {
    e.stopPropagation();
    setSavedQueries(savedQueries.filter((_, i) => i !== index));
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (dragIndex !== dropIndex && !isNaN(dragIndex)) {
      const copy = [...savedQueries];
      const [draggedItem] = copy.splice(dragIndex, 1);
      copy.splice(dropIndex, 0, draggedItem);
      setSavedQueries(copy);
    }
  };

  const loadQuery = (q) => {
    if (q.type === 'group') {
      setSearchQuery(q.word);
      setColor(q.color);
      setSelectedCells(q.cells);
    } else {
      setSelectedCells([]);
      setSearchQuery(q.word);
      setColor(q.color);
    }
  };

  const handleExport = async () => {
    const dataStr = JSON.stringify(savedQueries);
    try {
      await navigator.clipboard.writeText(dataStr);
      alert('Copied to clipboard!');
    } catch {
      prompt('Copy this text:', dataStr);
    }
  };

  const handleImport = () => {
    const dataStr = prompt('Paste your word list JSON:');
    if (!dataStr) return;
    try {
      const imported = JSON.parse(dataStr);
      if (Array.isArray(imported)) {
        const copy = [...savedQueries];
        imported.forEach(impQ => {
          const existingIdx = copy.findIndex(q => q.word === impQ.word);
          if (existingIdx > -1) copy[existingIdx] = impQ;
          else copy.push(impQ);
        });
        setSavedQueries(copy);
      }
    } catch {
      alert('Invalid JSON data.');
    }
  };

  const clearAll = () => {
    if (window.confirm('Clear all saved words and groups?')) {
      setSavedQueries([]);
    }
  };

  return (
    <div className="flex-1 min-w-[300px] max-w-md bg-slate-800/70 rounded-3xl p-6 shadow-2xl border border-white/10 backdrop-blur-md flex flex-col max-h-[80vh] overflow-y-auto">
      <h2 className="mt-0 text-2xl border-b border-white/10 pb-4 mb-4">Sidebar</h2>

      <GridImport
        gridData={gridData}
        isCustomGrid={isCustomGrid}
        onGridImport={onGridImport}
        onGridReset={onGridReset}
      />

      <div className="mb-6">
        <h3 className="text-slate-300 text-lg mb-2">Equivalences</h3>
        <input 
          type="text" 
          value={settings.equivalencies}
          onChange={(e) => updateSetting('equivalencies', e.target.value)}
          placeholder="e.g. B=D=P, A=E" 
          className="w-full p-2 rounded-lg border border-white/20 bg-slate-900/60 text-white font-['Outfit'] outline-none focus:border-sky-400 uppercase transition"
        />
      </div>

      <div className="mb-6 flex flex-col gap-2">
        <h3 className="text-slate-300 text-lg mb-1 flex items-baseline justify-between">
          Settings
          {isComputing && <span className="text-xs font-normal text-sky-400 animate-pulse">{loadingMsg}</span>}
        </h3>
        <label className="flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white transition">
          <input type="checkbox" checked={settings.reuse} onChange={e => updateSetting('reuse', e.target.checked)} className="w-4 h-4 cursor-pointer" />
          Allow Letter Reuse
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white transition">
          <input type="checkbox" checked={settings.straight} onChange={e => updateSetting('straight', e.target.checked)} className="w-4 h-4 cursor-pointer" />
          Straight Lines Only
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white transition">
          <input type="checkbox" checked={settings.showLines} onChange={e => updateSetting('showLines', e.target.checked)} className="w-4 h-4 cursor-pointer" />
          Show Path Lines
        </label>
      </div>

      <h3 className="text-slate-300 text-lg mb-2">Saved Words</h3>
      <ul className="flex-1 min-h-[6rem] overflow-y-auto m-0 p-0 list-none flex flex-col gap-2 pr-2">
        {savedQueries.map((q, i) => (
          <li 
            key={i} 
            draggable 
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, i)}
            className="flex items-center gap-2 p-2 bg-slate-900/40 hover:bg-slate-900/80 rounded-lg cursor-pointer border border-transparent hover:border-white/10 transition"
          >
            <div className="w-4 h-4 rounded-full flex-none" style={{ background: q.color }} onClick={() => loadQuery(q)}></div>
            <div className="flex-grow font-semibold tracking-wide truncate" onClick={() => loadQuery(q)}>
              {q.word} {q.type === 'group' && <span className="text-xs opacity-70 ml-1">(Group)</span>}
            </div>
            
            <div className={`cursor-pointer opacity-50 hover:opacity-100 transition ${q.visible ? 'text-sky-400 opacity-100' : ''}`} onClick={(e) => toggleVisibility(e, i)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {q.visible 
                  ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></>
                  : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></>
                }
              </svg>
            </div>
            <div className="cursor-pointer opacity-50 hover:opacity-100 hover:text-red-500 transition ml-1" onClick={(e) => deleteQuery(e, i)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary">Export</button>
          <button onClick={handleImport} className="btn-secondary">Import</button>
          <button onClick={clearAll} className="btn-secondary">Clear All</button>
        </div>
      </div>
    </div>
  );
}
