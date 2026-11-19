# WordsNinja

Split English text that has no spaces into words.

```js
import WordsNinja from 'wordsninja';

const ninja = new WordsNinja();
ninja.splitSentence('youneedtolearnfromyourmistakes');
// → ['you', 'need', 'to', 'learn', 'from', 'your', 'mistakes']
```

[![npm version](https://img.shields.io/npm/v/wordsninja.svg)](https://www.npmjs.com/package/wordsninja)
[![npm downloads](https://img.shields.io/npm/dm/wordsninja.svg)](https://www.npmjs.com/package/wordsninja)
[![CI](https://github.com/parsakafi/wordsninja/actions/workflows/ci.yml/badge.svg)](https://github.com/parsakafi/wordsninja/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/wordsninja.svg)](./LICENSE)

## Why WordsNinja

- **Zero dependencies** and a small API surface.
- **~2.8× faster than v1** — a dynamic-programming search over a frequency-ordered dictionary, backed by a `Map` and typed
  arrays.
- **Keeps your text** — case is preserved and characters the dictionary cannot cover are returned instead of silently
  dropped.
- **Offset-aware** — get `{ word, start, end }` tokens so you can highlight matches in the original string.
- **Custom dictionaries** — pass an array of words or point at a `.json` / `.txt` file.
- **TypeScript types and ESM + CommonJS** entry points.
- **Lazy dictionary load** — importing the package no longer parses the 1.8 MB word list.

## Install

```bash
npm install wordsninja
```

Requires Node.js 18 or newer.

## Quick start

CommonJS:

```js
const WordsNinja = require('wordsninja');
const ninja = new WordsNinja();

console.log(ninja.splitSentence('youneedtolearnfromyourmistakes'));
// [ 'you', 'need', 'to', 'learn', 'from', 'your', 'mistakes' ]
```

ESM:

```js
import WordsNinja from 'wordsninja';

const ninja = new WordsNinja();
```

TypeScript:

```ts
import WordsNinja from 'wordsninja';

const ninja = new WordsNinja();
const words: string[] = ninja.splitSentence('ilovewordsninja');
```

The dictionary is loaded on first use. `await ninja.loadDictionary()` still works and is kept for backwards
compatibility with v1:

```js
const ninja = new WordsNinja();
await ninja.loadDictionary(); // optional
ninja.splitSentence('helloworld');
```

## API

### `new WordsNinja(options?)`

| Option       | Type                 | Description                                                                                                                                |
|--------------|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `dictionary` | `string[] \| string` | Custom dictionary. An array of words, or a path to a `.json` array or newline separated `.txt` file. Defaults to the bundled English list. |

```js
const ninja = new WordsNinja({dictionary: ['code', 'ninja']});
ninja.splitSentence('codeninja'); // ['code', 'ninja']
```

The `dictionary` option is validated eagerly; the file is read (and the bundled list parsed) on first use.

### `ninja.loadDictionary(): Promise<this>`

Loads the dictionary and resolves with the instance. Optional — the dictionary is loaded lazily — but useful for warming
up in a serverless handler.

### `ninja.addWords(words): this`

Adds one word or an array of words to **this instance's** dictionary. Added words get the lowest possible cost, so they
outrank bundled words. Matching is case-insensitive and accent-insensitive.

```js
const ninja = new WordsNinja();
ninja.addWords('parsa').addWords(['kafi', 'wordsninja']);

ninja.splitSentence('parsayouneedtolearnfromyourmistakes');
// [ 'parsa', 'you', 'need', 'to', 'learn', 'from', 'your', 'mistakes' ]
```

Instances do not share added words.

### `ninja.splitSentence(input, options?): string[] | string | WordToken[]`

Splits `input` into words. Throws a `TypeError` if `input` is not a string.

| Option                  | Type             | Default | Description                                                                                                                       |
|-------------------------|------------------|---------|-----------------------------------------------------------------------------------------------------------------------------------|
| `camelCaseSplitter`     | `boolean`        | `false` | Split camelCase / PascalCase boundaries. `XMLHttpRequest` → `XML Http Request`, `Note12` → `Note 12`.                             |
| `capitalizeFirstLetter` | `boolean`        | `false` | Capitalize the first letter of every word.                                                                                        |
| `joinWords`             | `boolean`        | `false` | Return a space separated string instead of an array. Takes precedence over `withOffsets`.                                         |
| `withOffsets`           | `boolean`        | `false` | Return `{ word, start, end }` objects. Offsets are UTF-16 indices into `input`.                                                   |
| `normalizeAccents`      | `boolean`        | `true`  | Strip diacritics before matching (`café` matches `cafe`) while returning the original text.                                       |
| `mergeNumbers`          | `boolean`        | `true`  | Merge adjacent digit tokens: `call116116now` → `['call', '116116', 'now']`. Merging never crosses a separator, so `1 2 3` stays three tokens. |
| `mergeContractions`     | `boolean`        | `true`  | Attach `'s`, `'re`, `'ll`, `'ve`, `'d`, `'m`, `'t` to the preceding word: `wang'sbook` → `["wang's", 'book']`. Merging never crosses a separator, so `wang 's` stays two tokens. |
| `maxWordLength`         | `number`         | `64`    | Maximum length of a dictionary word considered at each position. Lower values are faster; longer words are treated as unknown.    |
| `unknownWordPenalty`    | `number \| null` | `10`    | Cost per unmatched character. Unmatched characters are kept as tokens. Set to `null` to drop characters that cannot be segmented. In the bundled dictionary, a lone letter other than `a` or `i` counts as unmatched text. |

#### Offsets

```js
const input = 'Ihave2cats';
ninja.splitSentence(input, {withOffsets: true});
// [
//   { word: 'I',    start: 0, end: 1 },
//   { word: 'have', start: 1, end: 5 },
//   { word: '2',    start: 5, end: 6 },
//   { word: 'cats', start: 6, end: 10 }
// ]
```

Every offset pair slices back to its word:

```js
for (const token of tokens) {
    input.slice(token.start, token.end) === token.word; // always true
}
```

`capitalizeFirstLetter` changes `word` but not the offsets. When `joinWords` is `true`, a string is returned and offsets
are ignored.

#### All options together

```js
ninja.splitSentence('helloWorldHowAreYou', {
    camelCaseSplitter: true,
    capitalizeFirstLetter: true,
    joinWords: true,
});
// 'Hello World How Are You'
```

## Behavior details

- **Case is preserved.** Only the dictionary lookup is case-insensitive.
- **Separators are removed.** Spaces, punctuation, emoji and other characters outside `letters`, `digits` and `'` are
  not part of the result. They become boundaries between words.
- **Accents are normalized by default.** `cafélatte` → `['café', 'latte']`. Disable with `normalizeAccents: false`; the
  accented character is then treated as unknown text.
- **Text the dictionary cannot cover is kept.** Non-English scripts, brand names and typos come back as tokens instead
  of disappearing: `سلامدنیا` → `['سلامدنیا']`. Adjacent unknown characters are grouped into one token. Use
  `unknownWordPenalty: null` if you would rather drop them.
- **Numbers and possessives are merged by default.** `call123now` → `['call', '123', 'now']`, `wang'sbook` →
  `["wang's", 'book']`. Disable with `mergeNumbers: false` / `mergeContractions: false`.
- **Whole words win over cheap fragments.** The bundled word list contains every letter as an entry, so a run could be
  split into pieces cheaper than the word they spell (`sand` → `s and`). The bundled dictionary ignores one-letter
  entries other than `a` and `i`; those letters are treated as unmatched text, so `sand` stays `sand`. Custom
  dictionaries keep their one-letter entries.
- **Ambiguous input is a guess.** `thequickbrownfox` can only be segmented by cost; some strings have more than one
  plausible split.
- **Long words are capped.** `maxWordLength` bounds the candidate window per position. Words longer than the cap are
  treated as unknown.

## Custom dictionaries

```js
// Array
const code = new WordsNinja({dictionary: ['code', 'ninja']});

// JSON file: ["code", "ninja"]
const fromJson = new WordsNinja({dictionary: './words.json'});

// Text file: one word per line
const fromText = new WordsNinja({dictionary: './words.txt'});
```

Paths are resolved from the current working directory. An empty dictionary is valid: every run of text is returned as
unknown tokens (or dropped when `unknownWordPenalty` is `null`).

## Bundlers and browsers

The package resolves no Node built-ins at import time, so it bundles cleanly for browsers and edge runtimes:

```js
import WordsNinja from 'wordsninja';

const ninja = new WordsNinja();
ninja.splitSentence('youneedtolearnfromyourmistakes');
```

The bundled word list is included in the bundle (about 610 KB gzipped) and parsed on first use. File-path dictionaries
are Node.js only; in the browser, fetch the words and pass an array instead:

```js
const words = await (await fetch('/words.json')).json();
const ninja = new WordsNinja({dictionary: words});
```

Offsets, custom words and every option work the same way in the browser.

## Migrating from v1

v2 is a breaking release compared with v1:

- **`loadDictionary()` is optional.** The dictionary loads on first use. It still exists, now resolves with the
  instance, and is idempotent.
- **Instances are isolated.** `addWords()` no longer changes a module-global dictionary shared by every instance.
- **The possessive/merge code actually runs.** v1 stored merged tokens at `out[-1]`, so the branch never executed.
  Possessives and digit runs are now merged by default.
- **Unknown text is no longer dropped silently.** v1 returned `[]` for non-Latin input and removed accents as
  separators; v2 keeps unmatched text as tokens.
- **Accents are normalized by default.** `cafélatte` now yields `['café', 'latte']` instead of `['caf', 'latte']`.
- **`addWords()` returns the instance** for chaining, ignores empty entries, and rejects non-strings or words
  containing whitespace.
- **Clear errors instead of hangs.** Using the API before the dictionary was loaded used to loop until
  `RangeError: Invalid array length`; it now initializes lazily and validates input.
- **Node.js 18+**, TypeScript types, and ESM are supported.
- **New options:** `withOffsets`, `normalizeAccents`, `mergeNumbers`, `mergeContractions`, `maxWordLength`,
  `unknownWordPenalty`, plus a `dictionary` constructor option.

## Performance

Measured on a desktop machine (Node 22); split workloads are best of five, dictionary load is a cold start:

| Workload          | v1                      | v2                        |
|-------------------|-------------------------|---------------------------|
| 4,500 characters  | ~85 ms                  | **~30 ms**                |
| 21,000 characters | ~388 ms                 | **~137 ms**               |
| Dictionary load   | ~83 ms (import + build) | **~46 ms** (first use)    |

v2 also supports `withOffsets` at no measurable extra cost. Numbers vary by machine; run the benchmark on your hardware.

### Accuracy

`npm run bench:accuracy` removes the spaces from two corpora and scores the result against the intended words:

| Corpus                       | Sentences | Exact       | Precision | Recall | F1    |
|------------------------------|-----------|-------------|-----------|--------|-------|
| `bench/corpus.txt` (tuned)   | 202       | 176 (87.1%) | 96.8%     | 95.6%  | 96.2% |
| `bench/prose.txt` (held out) | 600       | 474 (79.0%) | 97.4%     | 96.6%  | 97.0% |

`prose.txt` holds 600 sentences from six public-domain novels; it is kept apart from the corpus used while tuning, so a
change cannot raise the tuned score by over-fitting. CI enforces a floor on both. Against 2.0.0, 13 more sentences are
exact (3 tuned and 10 prose) and none regressed.

Most remaining misses are cost ties a unigram model cannot resolve without context: a longer dictionary word wins over
two shorter ones (`every day` → `everyday`, `me an` → `mean`), or two two-word splits compete (`i slept` → `is lept`).

## Development

```bash
npm test                 # node:test suite
npm run test:watch       # watch mode
npm run bench            # segmentation speed benchmark
npm run bench:accuracy   # accuracy against bench/corpus.txt and bench/prose.txt
npm run build:dictionary # validate/de-duplicate words-en.json
```

CI runs the test suite on Node.js 18, 20, 22 and 24, verifies the published artifact with `npm pack --dry-run`, and
fails if the accuracy benchmark drops below its floor.

## Releasing

1. Update the version and the changelog/README notes.
2. `npm test`
3. Tag and push: `git tag v2.0.1 && git push origin v2.0.1`

The `Release` workflow checks that the tag matches `package.json`, runs the tests, and publishes with provenance through
npm trusted publishing. If you publish manually, use `npm publish --provenance`.

## Limitations

WordsNinja is a dictionary-based segmenter, not a language model:

- The bundled list is English-focused. Non-English text is preserved as unknown tokens, not segmented.
- Segmentation is a best guess for ambiguous input.
- Punctuation is treated as a boundary, not preserved.
- The dictionary costs ~30 MB of heap once loaded; it is shared by all instances in a process.

## License

[MIT](./LICENSE) © Parsa Kafi

## Acknowledgements

- Algorithm
  from [How to split text without spaces into list of words?](https://stackoverflow.com/questions/8870261/how-to-split-text-without-spaces-into-list-of-words).
- Word list from the [wordninja](https://pypi.org/project/wordninja) Python package (MIT). See [NOTICE](./NOTICE).
- v1 camelCase splitting was based
  on [split-camelcase-to-words](https://www.npmjs.com/package/split-camelcase-to-words).
