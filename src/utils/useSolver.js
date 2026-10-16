import { useEffect, useRef, useCallback } from 'react';

// Runs the word search in a Web Worker so large grids never freeze the page.
// Only the most recent request gets a result; superseded ones resolve to null.
export default function useSolver() {
  const workerRef = useRef(null);
  const pending = useRef(null);
  const nextId = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (pending.current && pending.current.id === data.id) {
        pending.current.resolve(data);
        pending.current = null;
      }
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const setWords = useCallback(words => {
    workerRef.current.postMessage({ type: 'words', words });
  }, []);

  const solve = useCallback((grid, { reuse, straight, equivalencies }) => {
    const id = ++nextId.current;
    pending.current?.resolve(null);
    return new Promise(resolve => {
      pending.current = { id, resolve };
      workerRef.current.postMessage({ type: 'solve', id, grid, settings: { reuse, straight, equivalencies } });
    });
  }, []);

  return { setWords, solve };
}
