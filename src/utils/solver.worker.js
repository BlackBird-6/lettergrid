import { buildTrie, buildWordMap } from './solver';

// The trie is built once per word list and reused across recomputes.
let trie = null;

self.onmessage = ({ data }) => {
  if (data.type === 'words') {
    trie = buildTrie(data.words);
    return;
  }
  if (data.type === 'solve') {
    const result = trie
      ? buildWordMap(data.grid, trie, data.settings)
      : { tileWords: [], allWords: [] };
    self.postMessage({ id: data.id, ...result });
  }
};
