# LetterGrid

A word-search explorer: finds every dictionary word that can be traced through
adjacent tiles of a letter grid, and lets you highlight, colour and save words
or groups of cells.

## Running

```sh
npm install
npm run dev      # development server
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Files

- `public/letters.txt` is the default grid, one row per line.
- `public/words.txt` is the dictionary, one word per line.
- `src/utils/solver.js` holds the grid search. `solver.worker.js` runs it off the main thread.

## Custom grids

In the sidebar's **Grid** section you can paste a grid or upload a `.txt` file.
Grids can be any size, square or rectangular. Write one row per line. Letters
may be run together (`CAT`) or separated by spaces or commas (`C A T`). Rows
shorter than the longest row are padded with blank cells. The custom grid is
kept in local storage until you click **Default**.

## Saved data

Saved words and groups, settings and any custom grid are stored in the
browser's local storage, so each visitor keeps their own. Use **Export** /
**Import** in the sidebar to move a saved list between browsers.
