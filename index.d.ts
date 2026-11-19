declare namespace WordsNinja {
    interface Options {
        /**
         * Custom dictionary: an array of words or a path to a `.json` / `.txt`
         * file. Defaults to the bundled English dictionary.
         */
        dictionary?: string[] | string;
    }

    interface SplitOptions {
        /** Split camelCase / PascalCase boundaries. Defaults to `false`. */
        camelCaseSplitter?: boolean;
        /** Capitalize the first letter of every word. Defaults to `false`. */
        capitalizeFirstLetter?: boolean;
        /** Return a space separated string instead of an array. Defaults to `false`. */
        joinWords?: boolean;
        /**
         * Return `{ word, start, end }` objects instead of strings. Offsets are
         * UTF-16 indices into the input string. Ignored when `joinWords` is `true`.
         */
        withOffsets?: boolean;
        /**
         * Strip diacritics before matching (`café` matches `cafe`) while keeping
         * the original text in the result. Defaults to `true`.
         */
        normalizeAccents?: boolean;
        /**
         * Merge adjacent digit tokens (`call116116now` ->
         * `['call', '116116', 'now']`). Merging never crosses a separator, so
         * `1 2 3` stays three tokens. Defaults to `true`.
         */
        mergeNumbers?: boolean;
        /**
         * Attach `'s`, `'re`, `'ll`, `'ve`, `'d`, `'m` and `'t` to the preceding
         * word (`wang'sbook` -> `["wang's", 'book']`); `wang 's` stays two
         * tokens. Defaults to `true`.
         */
        mergeContractions?: boolean;
        /**
         * Maximum length of a dictionary word considered at each position.
         * Lower values are faster; longer words are treated as unknown.
         * Defaults to `64`.
         */
        maxWordLength?: number;
        /**
         * Cost per unmatched character. Unmatched characters are kept as tokens.
         * Set to `null` to drop characters that cannot be segmented. In the
         * bundled dictionary, a lone letter other than `a` or `i` counts as
         * unmatched text. Defaults to `10`.
         */
        unknownWordPenalty?: number | null;
    }

    interface WordToken {
        /** The matched text, sliced from the original input. */
        word: string;
        /** Inclusive UTF-16 start offset. */
        start: number;
        /** Exclusive UTF-16 end offset. */
        end: number;
    }

    interface SplitWithOffsetsOptions extends SplitOptions {
        withOffsets: true;
        joinWords?: false;
    }

    interface SplitJoinedOptions extends SplitOptions {
        joinWords: true;
    }
}

declare class WordsNinja {
    /**
     * @param options Custom dictionary configuration.
     */
    constructor(options?: WordsNinja.Options);

    /** Whether the dictionary has been loaded. */
    readonly ready: boolean;

    /**
     * Load the dictionary. Optional: the dictionary is loaded lazily on first
     * use. Kept for backwards compatibility with v1.
     */
    loadDictionary(): Promise<this>;

    /**
     * Add word(s) to this instance's dictionary. Added words get the lowest
     * possible cost, so they win over bundled dictionary words.
     */
    addWords(words: string | string[]): this;

    /** Split a string into words. */
    splitSentence(input: string, options: WordsNinja.SplitJoinedOptions): string;
    splitSentence(input: string, options: WordsNinja.SplitWithOffsetsOptions): WordsNinja.WordToken[];
    splitSentence(input: string, options?: WordsNinja.SplitOptions): string[];
}

export = WordsNinja;
