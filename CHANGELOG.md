# Changelog

## 2.0.1

More accurate segmentation of single words, plus documentation corrections and
accuracy benchmarks.

- **Segmentation.** The bundled word list contains every letter as a word (`s`
  is at rank 17), so a run could be split into fragments cheaper than the word
  they spell: `sand` became `s and`, `sat` became `s at`. The bundled dictionary
  now ignores one-letter entries other than `a` and `i`, so a word no longer
  competes with single-letter fragments of itself. Those letters follow
  `unknownWordPenalty` like any other unmatched text, so
  `unknownWordPenalty: null` drops them. Custom dictionaries keep their
  one-letter entries, and `addWords('x')` still works. Across the 126,136-word
  list, segmented one word at a time, this fixes 226 words and regresses none;
  the 125,317 words that already segmented correctly are untouched, and of the
  593 that are still wrong, one changed (`somethings` now segments as
  `some things` instead of `something s`).
- **No per-token cost.** A 0.3 cost per token on top of the dictionary cost was
  tried as well. It raised `corpus.txt` from 176 to 178 exact sentences and
  would have fixed 113 more isolated words (`onto`, `thereby`), but on the
  held-out prose set it gained no sentence and lost six: `each other` became
  `eachother`, `on to` became `onto`, `to us` became `tous`. The released code
  keeps the plain cheapest-path search, which wins on held-out prose and on the
  combined corpus.
- **Accuracy benchmarks.** `npm run bench:accuracy` strips the spaces from
  `bench/corpus.txt` (202 tuned sentences) and `bench/prose.txt` (600 held-out
  sentences from six public-domain novels) and reports exact match plus
  word-level precision, recall and F1; CI enforces a floor on both. Against
  2.0.0, exact match went from 173 to 176 on the tuned corpus and from 464 to
  474 on the prose corpus, with no sentence regressing on either. The prose
  improvements all come from the letter `s` no longer being a word: `sat` and
  `sit` inside sentences, possessives such as `hers`, and contractions such as
  `that's`. Scope: every bundled word segmented on its own, plus these 802
  sentences under the default options. Arbitrary multi-word strings were not
  exhaustively compared, so a rare cost tie outside the corpora may still
  change.
- **Merging docs.** The `mergeNumbers` / `mergeContractions` docs claimed `1 2 3`
  became `123` and `wang 's` became `wang's`. Merging never crosses a separator,
  so both stay split. README, `index.d.ts` and the `index.js` JSDoc now show the
  real behavior, and a test pins it.
- **Performance section.** The 3× claim sat next to a table that implied 3.3×.
  Both now use re-measured numbers: ~2.8× faster than v1 (85 ms → 30 ms for
  4,500 characters; 388 ms → 137 ms for 21,000), and a faster dictionary load
  (~83 ms → ~46 ms, including JSON parsing and indexing).
- **`NOTICE`** now says the list was de-duplicated instead of claiming every
  word is unchanged.

## 2.0.0

The v2 rewrite is a breaking release: output defaults and some return values
changed.

- **Rewritten segmentation.** Dynamic programming over a `Map` and typed arrays,
  about 2.8× faster than v1 on long input. The dictionary is parsed on first
  use, not at import.
- **New options.** `withOffsets`, `normalizeAccents`, `mergeNumbers`,
  `mergeContractions`, `maxWordLength`, `unknownWordPenalty`, and a `dictionary`
  constructor option.
- **Defaults changed.** Accents are normalized, numbers and contractions merge,
  and text the dictionary cannot cover is kept instead of dropped.
- **Isolated instances.** `addWords()` no longer mutates a module-global
  dictionary and returns the instance. Empty entries are ignored; non-strings
  and words containing whitespace are rejected.
- **Types and module formats.** TypeScript declarations, plus ESM and CommonJS
  entry points.
- **Word list.** De-duplicated from 126,138 to 126,136 entries; the relative
  frequency order is unchanged.
- **Errors instead of hangs.** The API initializes lazily and validates input
  instead of looping on an unloaded dictionary.
