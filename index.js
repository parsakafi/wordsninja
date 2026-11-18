'use strict';

// Node built-ins are loaded lazily and indirectly so browser bundlers never
// try to resolve them. They are only needed for file-path dictionaries.
const nodeRequire =
    typeof module !== 'undefined' && typeof module.require === 'function'
        ? module.require.bind(module)
        : null;

/**
 * WordsNinja
 * Split English text that has no spaces into words.
 *
 * The segmentation is a dynamic-programming search (Viterbi style) over a
 * frequency-ordered dictionary: every candidate word gets a cost derived from
 * its rank, and the cheapest path through the input wins.
 *
 * @class
 */

const DEFAULT_MAX_WORD_LENGTH = 64;
const DEFAULT_UNKNOWN_WORD_PENALTY = 10;

const KIND_WORD = 1;
const KIND_UNKNOWN = 2;

// A "run" is a maximal span of letters, digits and apostrophes. Everything
// else (spaces, punctuation, emoji, ...) is a separator.
const RUN_RE = /[\p{L}\p{N}'\u2019]+/gu;
const COMBINING_MARKS_RE = /\p{M}+/gu;
const NON_ASCII_RE = /[^\x00-\x7f]/;
const SIMPLE_WORD_RE = /^[a-z0-9']+$/;
const DIGITS_RE = /^\p{N}+$/u;
const CONTRACTION_SUFFIXES = new Set(["'s", "'re", "'ll", "'ve", "'d", "'m", "'t"]);
const CONTRACTION_START_RE = /[\p{L}\p{N}]$/u;

const BOOLEAN_OPTIONS = [
    'camelCaseSplitter',
    'capitalizeFirstLetter',
    'joinWords',
    'withOffsets',
    'normalizeAccents',
    'mergeNumbers',
    'mergeContractions',
];

/**
 * Lowercase and strip diacritics, keeping curly apostrophes out of the way.
 * Used both for dictionary keys and for `addWords()` input.
 * @param {string} word
 * @returns {string}
 */
function normalizeWordKey(word) {
    return word
        .normalize('NFD')
        .replace(COMBINING_MARKS_RE, '')
        .replace(/\u2019/g, "'")
        .toLowerCase();
}

/**
 * Build an immutable cost table from a list of words.
 * @param {string[]} words Frequency ordered list of words (most common first)
 * @returns {{costs: Map<string, number>, maxLength: number, minCost: number}}
 */
function buildDictionary(words) {
    if (!Array.isArray(words)) {
        throw new TypeError('wordsninja: the dictionary must be an array of strings');
    }

    const costs = new Map();
    const logN = Math.log(Math.max(words.length, 2));
    let maxLength = 0;
    let minCost = Infinity;

    for (let i = 0; i < words.length; i++) {
        const raw = words[i];
        if (typeof raw !== 'string') {
            throw new TypeError('wordsninja: dictionary entries must be strings');
        }

        let word = SIMPLE_WORD_RE.test(raw) ? raw : raw.trim().toLowerCase();
        if (!word || costs.has(word)) continue;

        const cost = Math.log((i + 1) * Math.max(logN, 1));
        costs.set(word, cost);

        // Also index the accent-free form so a custom dictionary keeps
        // working when `normalizeAccents` is enabled (the default). The
        // bundled list is pure ASCII, so this is skipped there.
        if (NON_ASCII_RE.test(word)) {
            const key = normalizeWordKey(word);
            if (!costs.has(key)) costs.set(key, cost);
            if (key.length > maxLength) maxLength = key.length;
        }

        if (word.length > maxLength) maxLength = word.length;
        if (cost < minCost) minCost = cost;
    }

    return {costs, maxLength, minCost};
}

let sharedDictionary = null;

/**
 * Load the bundled English dictionary. `require()` is intentionally lazy so
 * importing the package stays cheap; the 1.8 MB JSON is only parsed on first
 * use.
 * @returns {{costs: Map<string, number>, maxLength: number, minCost: number}}
 */
function getSharedDictionary() {
    if (sharedDictionary === null) {
        sharedDictionary = buildDictionary(require('./words-en.json'));
    }
    return sharedDictionary;
}

/**
 * Resolve the `dictionary` constructor option: an array of words or a path to
 * a `.json` / newline separated `.txt` file.
 * @param {string[]|string} dictionary
 * @returns {string[]}
 */
function loadCustomDictionary(dictionary) {
    if (Array.isArray(dictionary)) return dictionary;
    if (typeof dictionary !== 'string') {
        throw new TypeError(
            'wordsninja: `dictionary` must be an array of words or a path to a .json/.txt file'
        );
    }

    const fs = nodeRequire === null ? null : nodeRequire('node:fs');
    const path = nodeRequire === null ? null : nodeRequire('node:path');

    if (fs === null || path === null) {
        throw new Error(
            'wordsninja: file-path dictionaries are only supported in Node.js. ' +
            'Pass an array of words instead.'
        );
    }

    const file = path.resolve(dictionary);
    const text = fs.readFileSync(file, 'utf8');

    if (/\.json$/i.test(file)) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
            throw new TypeError('wordsninja: a JSON dictionary must contain an array of strings');
        }
        return parsed;
    }

    return text.split(/\r?\n/);
}

/**
 * @param {string} input
 * @param {number} offset Absolute index of `piece` inside `input`
 * @param {{normalizeAccents: boolean}} options
 * @returns {{norm: string, starts: number[], ends: number[]}}
 */
function normalizePiece(piece, offset, options) {
    let norm = '';
    const starts = [];
    const ends = [];

    let index = offset;
    for (const char of piece) {
        let out;

        if (char.codePointAt(0) < 0x80) {
            // Fast path: ASCII.
            out = char >= 'A' && char <= 'Z' ? char.toLowerCase() : char;
        } else if (char === '\u2019') {
            out = "'";
        } else {
            out = char;
            if (options.normalizeAccents) {
                out = out.normalize('NFD').replace(COMBINING_MARKS_RE, '');
            }
            out = out.toLowerCase().replace(/\u2019/g, "'");
        }

        for (const normalized of out) {
            norm += normalized;
            starts.push(index);
            ends.push(index + char.length);
        }

        index += char.length;
    }

    return {norm, starts, ends};
}

function isUpper(char) {
    return char !== char.toLowerCase();
}

function isLower(char) {
    return char !== char.toUpperCase();
}

function isDigit(char) {
    return /\p{N}/u.test(char);
}

/**
 * Camel case boundaries: `XMLHttpRequest` -> `XML|Http|Request`,
 * `Note12` -> `Note|12`.
 * @param {string} run
 * @returns {Array<[number, number]>}
 */
function camelRanges(run) {
    const ranges = [];
    let start = 0;

    for (let i = 1; i < run.length; i++) {
        const prev = run[i - 1];
        const current = run[i];
        const next = i + 1 < run.length ? run[i + 1] : '';

        const lowerOrDigitBeforeUpper = (isLower(prev) || isDigit(prev)) && isUpper(current);
        const acronymBeforeWord = isUpper(prev) && isUpper(current) && isLower(next);
        const letterBeforeDigit = isLower(prev) && isDigit(current);

        if (lowerOrDigitBeforeUpper || acronymBeforeWord || letterBeforeDigit) {
            ranges.push([start, i]);
            start = i;
        }
    }

    ranges.push([start, run.length]);
    return ranges;
}

/**
 * Validate and normalize `splitSentence()` options.
 * @param {object|undefined} options
 * @returns {object}
 */
function normalizeOptions(options) {
    if (options === undefined || options === null) options = {};
    if (typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('wordsninja: options must be an object');
    }

    const normalized = {
        camelCaseSplitter: false,
        capitalizeFirstLetter: false,
        joinWords: false,
        withOffsets: false,
        normalizeAccents: true,
        mergeNumbers: true,
        mergeContractions: true,
        maxWordLength: DEFAULT_MAX_WORD_LENGTH,
        unknownWordPenalty: DEFAULT_UNKNOWN_WORD_PENALTY,
    };

    for (const name of BOOLEAN_OPTIONS) {
        const value = options[name];
        if (value === undefined) continue;
        if (typeof value !== 'boolean') {
            throw new TypeError(`wordsninja: option \`${name}\` must be a boolean`);
        }
        normalized[name] = value;
    }

    if (options.maxWordLength !== undefined) {
        const value = options.maxWordLength;
        if (!Number.isInteger(value) || value < 1) {
            throw new TypeError('wordsninja: option `maxWordLength` must be a positive integer');
        }
        normalized.maxWordLength = value;
    }

    if (options.unknownWordPenalty !== undefined) {
        const value = options.unknownWordPenalty;
        if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
            throw new TypeError(
                'wordsninja: option `unknownWordPenalty` must be a non-negative number or null'
            );
        }
        normalized.unknownWordPenalty = value;
    }

    return normalized;
}

/**
 * Merge adjacent tokens that belong together numerically (`1|2` -> `12`) or
 * grammatically (`wang|'s` -> `wang's`).
 * @param {string} input
 * @param {Array<{start: number, end: number}>} tokens
 * @param {object} options
 * @returns {Array<{word: string, start: number, end: number}>}
 */
function mergeTokens(input, tokens, options) {
    const merged = [];

    for (const token of tokens) {
        const word = input.slice(token.start, token.end);
        const previous = merged[merged.length - 1];

        if (previous && previous.end === token.start) {
            if (
                options.mergeNumbers &&
                DIGITS_RE.test(previous.word) &&
                DIGITS_RE.test(word)
            ) {
                previous.word += word;
                previous.end = token.end;
                continue;
            }

            const suffix = (
                word.charAt(0) === '\u2019' ? "'" + word.slice(1) : word
            ).toLowerCase();
            if (
                options.mergeContractions &&
                CONTRACTION_SUFFIXES.has(suffix) &&
                CONTRACTION_START_RE.test(previous.word)
            ) {
                previous.word += word;
                previous.end = token.end;
                continue;
            }
        }

        merged.push({word, start: token.start, end: token.end});
    }

    return merged;
}

function capitalizeFirstLetter(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

class WordsNinja {
    /**
     * @param {object} [options]
     * @param {string[]|string} [options.dictionary] Custom dictionary: an array
     *   of words or a path to a `.json`/`.txt` file. Defaults to the bundled
     *   English dictionary.
     */
    constructor(options = {}) {
        if (options === null || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('wordsninja: constructor options must be an object');
        }
        if (
            options.dictionary !== undefined &&
            !Array.isArray(options.dictionary) &&
            typeof options.dictionary !== 'string'
        ) {
            throw new TypeError(
                'wordsninja: `dictionary` must be an array of words or a path to a .json/.txt file'
            );
        }

        this._customDictionary = options.dictionary;
        this._base = null;
        this._ready = false;
        this._additions = new Map();
        this._additionsMaxLength = 0;
    }

    /**
     * Load the dictionary. This is optional: the dictionary is loaded lazily
     * on first use, so `await loadDictionary()` only exists for backwards
     * compatibility.
     * @returns {Promise<this>}
     */
    async loadDictionary() {
        this._ensureReady();
        return this;
    }

    /**
     * Whether the dictionary has been loaded.
     * @returns {boolean}
     */
    get ready() {
        return this._ready;
    }

    /**
     * Add word(s) to this instance's dictionary. Added words get the lowest
     * possible cost, so they win over bundled dictionary words.
     * @param {string|string[]} words
     * @returns {this}
     */
    addWords(words) {
        const list = typeof words === 'string' ? [words] : words;
        if (!Array.isArray(list)) {
            throw new TypeError('wordsninja: addWords() expects a string or an array of strings');
        }

        this._ensureReady();
        const cost = Number.isFinite(this._base.minCost) ? this._base.minCost : 0;

        for (const raw of list) {
            if (typeof raw !== 'string') {
                throw new TypeError('wordsninja: addWords() expects a string or an array of strings');
            }

            const word = raw.trim();
            if (!word) continue;
            if (/\s/u.test(word)) {
                throw new TypeError('wordsninja: a word cannot contain whitespace');
            }

            const lowercase = word.toLowerCase();
            const keys = new Set([lowercase, normalizeWordKey(word)]);

            for (const key of keys) {
                this._additions.set(key, cost);
                if (key.length > this._additionsMaxLength) {
                    this._additionsMaxLength = key.length;
                }
            }
        }

        return this;
    }

    /**
     * Split a string into words.
     *
     * @param {string} string The string to split
     * @param {object} [options]
     * @param {boolean} [options.camelCaseSplitter=false] Split camelCase/PascalCase
     *   boundaries (`XMLHttpRequest` -> `XML Http Request`)
     * @param {boolean} [options.capitalizeFirstLetter=false] Capitalize the first
     *   letter of every resulting word
     * @param {boolean} [options.joinWords=false] Return a space separated string
     *   instead of an array
     * @param {boolean} [options.withOffsets=false] Return `{word, start, end}`
     *   objects instead of strings. Ignored when `joinWords` is true.
     * @param {boolean} [options.normalizeAccents=true] Strip diacritics before
     *   matching (`café` matches `cafe`) while keeping the original text in the
     *   result
     * @param {boolean} [options.mergeNumbers=true] Merge adjacent digits
     *   (`1 2 3` -> `123`)
     * @param {boolean} [options.mergeContractions=true] Attach `'s`, `'re`,
     *   `'ll`, `'ve`, `'d`, `'m`, `'t` to the preceding word
     * @param {number} [options.maxWordLength=64] Maximum length of a dictionary
     *   word considered at each position. Lower values are faster; words longer
     *   than this are treated as unknown.
     * @param {number|null} [options.unknownWordPenalty=10] Cost per unmatched
     *   character. Unmatched characters are kept as tokens. Set to `null` to
     *   drop characters that cannot be segmented.
     * @returns {string[]|string|Array<{word: string, start: number, end: number}>}
     */
    splitSentence(string, options) {
        if (typeof string !== 'string') {
            throw new TypeError('wordsninja: splitSentence() expects a string');
        }

        const settings = normalizeOptions(options);
        this._ensureReady();

        const tokens = [];
        const maxWordLength = Math.min(
            Math.max(this._base.maxLength, this._additionsMaxLength),
            settings.maxWordLength
        );

        for (const match of string.matchAll(RUN_RE)) {
            const run = match[0];
            const runStart = match.index;
            const ranges = settings.camelCaseSplitter
                ? camelRanges(run)
                : [[0, run.length]];

            for (const [from, to] of ranges) {
                if (to <= from) continue;
                this._segmentRun(
                    run.slice(from, to),
                    runStart + from,
                    runStart + to,
                    settings,
                    maxWordLength,
                    tokens
                );
            }
        }

        const merged = mergeTokens(string, tokens, settings);
        const words = merged.map((token) =>
            settings.capitalizeFirstLetter
                ? capitalizeFirstLetter(token.word)
                : token.word
        );

        if (settings.joinWords) return words.join(' ');
        if (settings.withOffsets) {
            return merged.map((token, index) => ({
                word: words[index],
                start: token.start,
                end: token.end,
            }));
        }
        return words;
    }

    /**
     * Run the Viterbi search for a single alphanumeric run and append its
     * tokens (in source order) to `out`.
     * @private
     */
    _segmentRun(piece, absoluteStart, absoluteEnd, settings, maxWordLength, out) {
        const {norm, starts, ends} = normalizePiece(piece, absoluteStart, settings);
        const length = norm.length;
        if (length === 0) return;

        const best = new Float64Array(length + 1).fill(Infinity);
        const back = new Int32Array(length + 1);
        const kind = new Uint8Array(length + 1);
        best[0] = 0;

        const unknownCost =
            settings.unknownWordPenalty === null ? 1e6 : settings.unknownWordPenalty;

        for (let i = 1; i <= length; i++) {
            const limit = Math.min(maxWordLength, i);

            for (let k = 1; k <= limit; k++) {
                const cost = this._cost(norm.slice(i - k, i));
                if (cost === undefined) continue;

                const total = best[i - k] + cost;
                if (total < best[i]) {
                    best[i] = total;
                    back[i] = k;
                    kind[i] = KIND_WORD;
                }
            }

            // Every character can also be treated as unknown. This guarantees
            // termination for input the dictionary cannot cover.
            const unknownTotal = best[i - 1] + unknownCost;
            if (unknownTotal < best[i]) {
                best[i] = unknownTotal;
                back[i] = 1;
                kind[i] = KIND_UNKNOWN;
            }
        }

        const reversed = [];
        let i = length;

        while (i > 0) {
            const size = back[i];
            const boundary = i === length ? absoluteEnd : starts[i];
            const start = starts[i - size];
            let end = ends[i - 1];
            if (end > boundary) end = boundary;

            const unknown = kind[i] === KIND_UNKNOWN;
            const digits = DIGITS_RE.test(norm.slice(i - size, i));

            // `unknownWordPenalty: null` drops characters the dictionary
            // cannot cover instead of emitting them.
            if (start < end && (!unknown || settings.unknownWordPenalty !== null)) {
                const previous = reversed[reversed.length - 1];

                // Adjacent digits are left separate here so that
                // `mergeNumbers` stays in control of the final result.
                if (unknown && previous && previous.unknown && previous.start === end && !(previous.digits && digits)) {
                    previous.start = start;
                    previous.digits = previous.digits && digits;
                } else {
                    reversed.push({start, end, unknown, digits});
                }
            }

            i -= size;
        }

        for (let index = reversed.length - 1; index >= 0; index--) {
            out.push(reversed[index]);
        }
    }

    /**
     * @private
     * @param {string} word Lowercase, accent-free candidate
     * @returns {number|undefined}
     */
    _cost(word) {
        const addition = this._additions.get(word);
        if (addition !== undefined) return addition;
        return this._base.costs.get(word);
    }

    /**
     * Build (or reuse) the dictionary and mark the instance as ready.
     * @private
     */
    _ensureReady() {
        if (this._ready) return;

        this._base =
            this._customDictionary === undefined
                ? getSharedDictionary()
                : buildDictionary(loadCustomDictionary(this._customDictionary));

        this._ready = true;
    }
}

module.exports = WordsNinja;
module.exports.WordsNinja = WordsNinja;
module.exports.default = WordsNinja;
