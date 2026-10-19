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

## Saved groups

A saved group has a name, plus an optional word (highlighted along its paths)
and optional extra cells (Ctrl-click tiles to select them). **Save** stores
whatever is in the search bar and selection; it is named after the word, or
you are asked for a name if there's only a selection.

- Click a group to copy its word and colour into the search bar as a separate
  query. The group itself doesn't change.
- Click the pencil to edit a group. The search bar turns yellow and holds the
  group's word, its cells are selected, and its name becomes editable. Change
  any of them and press **Save**, or press Esc or the pencil again to cancel.

## Saved data

Saved words and groups, settings and any custom grid are stored in the
browser's local storage, so each visitor keeps their own. Use **Export** /
**Import** in the sidebar to move a saved list between browsers.
