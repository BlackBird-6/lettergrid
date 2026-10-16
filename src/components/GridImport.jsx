import { useState, useRef } from 'react';
import { gridToText } from '../utils/solver';

export default function GridImport({ gridData, isCustomGrid, onGridImport, onGridReset }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const rows = gridData.length;
  const cols = rows ? gridData[0].length : 0;

  const apply = (value) => {
    const err = onGridImport(value);
    setError(err || '');
    if (!err) setEditing(false);
  };

  const openEditor = () => {
    setText(gridToText(gridData));
    setError('');
    setEditing(true);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    const value = await file.text();
    setText(value);
    apply(value);
  };

  return (
    <div className="mb-6">
      <h3 className="text-slate-300 text-lg mb-2">
        Grid{' '}
        <span className="text-slate-400 text-sm font-normal">
          {cols} × {rows}{isCustomGrid ? ' (custom)' : ''}
        </span>
      </h3>

      {editing && (
        <div className="flex flex-col gap-2 mb-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'One row per line, e.g.\nCAT\nDOG'}
            className="w-full p-2 rounded-lg border border-white/20 bg-slate-900/60 text-white font-mono text-sm outline-none focus:border-sky-400 uppercase transition resize-y"
          />
          <p className="m-0 text-xs text-slate-400">
            One row per line, any width or height. Letters can be separated by spaces or commas. Short rows are padded with blank cells.
          </p>
          {error && <p className="m-0 text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => apply(text)} className="btn-secondary">Apply</button>
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!editing && <button onClick={openEditor} className="btn-secondary">Edit / Paste</button>}
        <button onClick={() => fileRef.current.click()} className="btn-secondary">Upload .txt</button>
        {isCustomGrid && (
          <button onClick={onGridReset} className="btn-secondary">Default</button>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={handleFile} className="hidden" />
    </div>
  );
}
