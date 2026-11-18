'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {after, describe, it} = require('node:test');

const WordsNinja = require('../index.js');
const wordList = require('../words-en.json');

const RUN_ONLY_RE = /[^\p{L}\p{N}'\u2019]+/gu;

function mulberry32(seed) {
    return function random() {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function assertOffsets(input, tokens, label) {
    let previousEnd = 0;

    for (const token of tokens) {
        assert.equal(typeof token.word, 'string', label);
        assert.ok(Number.isInteger(token.start), label);
        assert.ok(Number.isInteger(token.end), label);
        assert.ok(token.start >= previousEnd, `${label}: tokens overlap at ${token.start}`);
        assert.ok(token.end > token.start, `${label}: empty token at ${token.start}`);
        assert.ok(token.end <= input.length, `${label}: offset out of range`);
        assert.equal(input.slice(token.start, token.end), token.word, label);
        previousEnd = token.end;
    }
}

describe('dictionary data', () => {
    it('is clean', () => {
        assert.ok(Array.isArray(wordList));
        assert.ok(wordList.length > 100000);

        const seen = new Set();
        for (const word of wordList) {
            assert.equal(typeof word, 'string');
            assert.match(word, /^[a-z0-9']+$/);
            assert.equal(seen.has(word), false, `duplicate word: ${word}`);
            seen.add(word);
        }
    });
});

describe('dictionary files', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordsninja-'));

    after(() => {
        fs.rmSync(directory, {recursive: true, force: true});
    });

    it('loads a JSON dictionary', () => {
        const file = path.join(directory, 'words.json');
        fs.writeFileSync(file, JSON.stringify(['foo', 'bar']));

        const ninja = new WordsNinja({dictionary: file});
        assert.deepEqual(ninja.splitSentence('foobar'), ['foo', 'bar']);
    });

    it('loads a newline separated dictionary', () => {
        const file = path.join(directory, 'words.txt');
        fs.writeFileSync(file, 'foo\r\nbar\r\n');

        const ninja = new WordsNinja({dictionary: file});
        assert.deepEqual(ninja.splitSentence('foobar'), ['foo', 'bar']);
    });

    it('rejects invalid dictionary files', () => {
        const invalidJson = path.join(directory, 'invalid.json');
        fs.writeFileSync(invalidJson, '{not json');
        assert.throws(() => new WordsNinja({dictionary: invalidJson}).splitSentence('x'));

        const objectJson = path.join(directory, 'object.json');
        fs.writeFileSync(objectJson, JSON.stringify({words: ['foo']}));
        assert.throws(
            () => new WordsNinja({dictionary: objectJson}).splitSentence('x'),
            TypeError
        );

        const nonStringJson = path.join(directory, 'numbers.json');
        fs.writeFileSync(nonStringJson, JSON.stringify(['foo', 42]));
        assert.throws(
            () => new WordsNinja({dictionary: nonStringJson}).splitSentence('x'),
            TypeError
        );

        assert.throws(
            () =>
                new WordsNinja({dictionary: path.join(directory, 'missing.json')}).splitSentence(
                    'x'
                )
        );
    });
});

describe('fuzzing', () => {
    const alphabet = [
        'a',
        'b',
        'c',
        'x',
        'z',
        'A',
        'B',
        'Z',
        '0',
        '1',
        '9',
        ' ',
        ',',
        '.',
        '-',
        '!',
        "'",
        '\u2019',
        '\u00e9',
        '\u00fc',
        '\u0130',
        '\u4f60',
        '\u597d',
        '\u0633',
        '\u0644',
        '\ud83c\udf89',
        '\n',
        '\t',
        '\u0301',
    ];

    it('always terminates and keeps offsets consistent', () => {
        const ninja = new WordsNinja();
        const random = mulberry32(20260101);

        for (let iteration = 0; iteration < 250; iteration++) {
            const length = Math.floor(random() * 300);
            let input = '';
            for (let index = 0; index < length; index++) {
                input += alphabet[Math.floor(random() * alphabet.length)];
            }

            const label = `input #${iteration}: ${JSON.stringify(input)}`;
            const words = ninja.splitSentence(input);

            assert.ok(Array.isArray(words), label);
            assert.ok(words.every((word) => typeof word === 'string'), label);

            if (iteration % 5 === 0) {
                const camelWords = ninja.splitSentence(input, {camelCaseSplitter: true});
                assert.ok(Array.isArray(camelWords), label);
                assert.equal(camelWords.join(''), input.replace(RUN_ONLY_RE, ''), label);
                assertOffsets(
                    input,
                    ninja.splitSentence(input, {camelCaseSplitter: true, withOffsets: true}),
                    label
                );
            }

            if (iteration % 10 === 0) {
                assert.ok(
                    Array.isArray(ninja.splitSentence(input, {unknownWordPenalty: null})),
                    label
                );
            }

            // With the default options every non-separator character must be
            // present exactly once, in order.
            assert.equal(words.join(''), input.replace(RUN_ONLY_RE, ''), label);

            const tokens = ninja.splitSentence(input, {withOffsets: true});
            assertOffsets(input, tokens, label);
        }
    });
});

describe('pathological input', () => {
    const ninja = new WordsNinja();

    it('handles long repeated characters', () => {
        for (const character of ['a', '1', "'", '\u4f60']) {
            const input = character.repeat(2000);
            assert.ok(Array.isArray(ninja.splitSentence(input)));
            assert.ok(Array.isArray(ninja.splitSentence(input, {unknownWordPenalty: null})));
        }
    });

    it('handles emoji and punctuation only input', () => {
        assert.deepEqual(ninja.splitSentence('\ud83c\udf89\ud83c\udf89'), []);
        assert.deepEqual(ninja.splitSentence('----'), []);
    });

    it('stays within a reasonable time budget', () => {
        const input = 'youneedtolearnfromyourmistakes'.repeat(400);
        const start = process.hrtime.bigint();
        const words = ninja.splitSentence(input);
        const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

        assert.ok(words.length > 0);
        assert.ok(elapsed < 3000, `segmentation took ${elapsed.toFixed(1)} ms`);
    });

    it('stays within a reasonable time budget with offsets', () => {
        const input = 'youneedtolearnfromyourmistakes'.repeat(200);
        const start = process.hrtime.bigint();
        const tokens = ninja.splitSentence(input, {withOffsets: true});
        const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

        assert.ok(tokens.length > 0);
        assert.ok(elapsed < 3000, `segmentation took ${elapsed.toFixed(1)} ms`);
    });
});

describe('module shape', () => {
    it('exports a class through CommonJS', () => {
        assert.equal(typeof WordsNinja, 'function');
        assert.equal(WordsNinja.WordsNinja, WordsNinja);
        assert.equal(WordsNinja.default, WordsNinja);
    });

    it('exports a default and named binding through ESM', async () => {
        const module = await import('../index.mjs');

        assert.equal(module.default, WordsNinja);
        assert.equal(module.WordsNinja, WordsNinja);
        assert.deepEqual(
            new module.default().splitSentence('helloworld'),
            new WordsNinja().splitSentence('helloworld')
        );
    });
});
