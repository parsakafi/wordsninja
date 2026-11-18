'use strict';

const assert = require('node:assert/strict');
const {describe, it} = require('node:test');

const WordsNinja = require('../index.js');

describe('segmentation', () => {
    it('splits the canonical example', () => {
        const ninja = new WordsNinja();
        assert.deepEqual(ninja.splitSentence('youneedtolearnfromyourmistakes'), [
            'you',
            'need',
            'to',
            'learn',
            'from',
            'your',
            'mistakes',
        ]);
    });

    it('loads the dictionary lazily', () => {
        const ninja = new WordsNinja();
        assert.equal(ninja.ready, false);
        ninja.splitSentence('hellothere');
        assert.equal(ninja.ready, true);
    });

    it('keeps loadDictionary() working and idempotent', async () => {
        const ninja = new WordsNinja();
        const returned = await ninja.loadDictionary();
        assert.equal(returned, ninja);

        const first = ninja.splitSentence('youneedtolearnfromyourmistakes');
        await ninja.loadDictionary();
        assert.deepEqual(ninja.splitSentence('youneedtolearnfromyourmistakes'), first);
    });

    it('preserves the original case', () => {
        assert.deepEqual(new WordsNinja().splitSentence('Ihave2cats'), [
            'I',
            'have',
            '2',
            'cats',
        ]);
    });

    it('drops separators between words', () => {
        assert.deepEqual(new WordsNinja().splitSentence('hello, world!'), ['hello', 'world']);
        assert.deepEqual(new WordsNinja().splitSentence('hello\tworld\nagain'), [
            'hello',
            'world',
            'again',
        ]);
    });

    it('returns an empty array for empty or separator-only input', () => {
        const ninja = new WordsNinja();
        assert.deepEqual(ninja.splitSentence(''), []);
        assert.deepEqual(ninja.splitSentence('   '), []);
        assert.deepEqual(ninja.splitSentence('?!.,;'), []);
    });

    it('merges adjacent digits by default', () => {
        assert.deepEqual(new WordsNinja().splitSentence('call123now'), [
            'call',
            '123',
            'now',
        ]);
    });

    it('keeps digits separate when mergeNumbers is disabled', () => {
        assert.deepEqual(
            new WordsNinja().splitSentence('call123now', {mergeNumbers: false}),
            ['call', '1', '2', '3', 'now']
        );
    });

    it('merges possessives and contractions by default', () => {
        const ninja = new WordsNinja();
        assert.deepEqual(ninja.splitSentence("wang'sbook"), ["wang's", 'book']);
        assert.deepEqual(ninja.splitSentence("that'sallfolks"), ["that's", 'all', 'folks']);
        assert.deepEqual(ninja.splitSentence('don\u2019tstop'), ['don\u2019t', 'stop']);
    });

    it('does not merge contractions when disabled', () => {
        assert.deepEqual(
            new WordsNinja().splitSentence("wang'sbook", {mergeContractions: false}),
            ['wang', "'s", 'book']
        );
    });

    it('matches accented input but returns the original text', () => {
        assert.deepEqual(new WordsNinja().splitSentence('caf\u00e9latte'), [
            'caf\u00e9',
            'latte',
        ]);
    });

    it('keeps text the dictionary cannot cover', () => {
        const ninja = new WordsNinja();
        assert.deepEqual(ninja.splitSentence('\u0633\u0644\u0627\u0645\u062f\u0646\u06cc\u0627'), [
            '\u0633\u0644\u0627\u0645\u062f\u0646\u06cc\u0627',
        ]);
        assert.deepEqual(ninja.splitSentence('\u00e9'), ['\u00e9']);
    });
});

describe('options', () => {
    const ninja = new WordsNinja();

    it('splits camelCase and PascalCase', () => {
        assert.deepEqual(
            ninja.splitSentence('HelloWorldHowAreYou', {camelCaseSplitter: true}),
            ['Hello', 'World', 'How', 'Are', 'You']
        );
    });

    it('handles acronyms and digits in camelCase input', () => {
        assert.deepEqual(
            ninja.splitSentence('XMLHttpRequest', {camelCaseSplitter: true}),
            ['XML', 'Http', 'Request']
        );
        assert.deepEqual(
            ninja.splitSentence('Note12', {camelCaseSplitter: true}),
            ['Note', '12']
        );
    });

    it('capitalizes and joins words', () => {
        assert.equal(
            ninja.splitSentence('youneedtolearnfromyourmistakes', {
                capitalizeFirstLetter: true,
                joinWords: true,
            }),
            'You Need To Learn From Your Mistakes'
        );
        assert.deepEqual(
            ninja.splitSentence('helloworld', {capitalizeFirstLetter: true}),
            ['Helloworld']
        );
    });

    it('returns offsets that slice back to the words', () => {
        const input = 'Ihave2cats';
        const tokens = ninja.splitSentence(input, {withOffsets: true});

        assert.deepEqual(tokens, [
            {word: 'I', start: 0, end: 1},
            {word: 'have', start: 1, end: 5},
            {word: '2', start: 5, end: 6},
            {word: 'cats', start: 6, end: 10},
        ]);

        for (const token of tokens) {
            assert.equal(input.slice(token.start, token.end), token.word);
        }
    });

    it('keeps offsets valid when capitalizing', () => {
        const input = 'Ihave2cats';
        const tokens = ninja.splitSentence(input, {
            withOffsets: true,
            capitalizeFirstLetter: true,
        });

        assert.deepEqual(
            tokens.map((token) => token.word),
            ['I', 'Have', '2', 'Cats']
        );
        assert.equal(input.slice(tokens[1].start, tokens[1].end), 'have');
    });

    it('returns offsets into the original accented text', () => {
        const input = 'caf\u00e9latte';
        const tokens = ninja.splitSentence(input, {withOffsets: true});

        assert.deepEqual(tokens, [
            {word: 'caf\u00e9', start: 0, end: 4},
            {word: 'latte', start: 4, end: 9},
        ]);
        for (const token of tokens) {
            assert.equal(input.slice(token.start, token.end), token.word);
        }
    });

    it('lets joinWords win over withOffsets', () => {
        assert.equal(
            ninja.splitSentence('hello world', {joinWords: true, withOffsets: true}),
            'hello world'
        );
    });

    it('can disable accent normalization', () => {
        assert.deepEqual(
            ninja.splitSentence('caf\u00e9latte', {normalizeAccents: false}),
            ['caf', '\u00e9', 'latte']
        );
    });

    it('honours maxWordLength', () => {
        const custom = new WordsNinja({dictionary: ['abcdef']});

        assert.deepEqual(custom.splitSentence('abcdef', {maxWordLength: 3}), ['abcdef']);
        assert.deepEqual(
            custom.splitSentence('abcdef', {maxWordLength: 3, unknownWordPenalty: null}),
            []
        );
        assert.deepEqual(custom.splitSentence('abcdef', {maxWordLength: 6}), ['abcdef']);
    });

    it('can drop unknown characters', () => {
        const custom = new WordsNinja({dictionary: ['foo']});

        assert.deepEqual(custom.splitSentence('foobar'), ['foo', 'bar']);
        assert.deepEqual(custom.splitSentence('foobar', {unknownWordPenalty: null}), ['foo']);
    });

    it('validates options', () => {
        assert.throws(() => ninja.splitSentence('hello', 'nope'), TypeError);
        assert.throws(() => ninja.splitSentence('hello', {camelCaseSplitter: 'yes'}), TypeError);
        assert.throws(() => ninja.splitSentence('hello', {maxWordLength: 0}), TypeError);
        assert.throws(() => ninja.splitSentence('hello', {maxWordLength: 1.5}), TypeError);
        assert.throws(
            () => ninja.splitSentence('hello', {unknownWordPenalty: -1}),
            TypeError
        );
        assert.throws(
            () => ninja.splitSentence('hello', {unknownWordPenalty: Infinity}),
            TypeError
        );
    });

    it('validates the input', () => {
        assert.throws(() => ninja.splitSentence(null), TypeError);
        assert.throws(() => ninja.splitSentence(undefined), TypeError);
        assert.throws(() => ninja.splitSentence(42), TypeError);
        assert.throws(() => ninja.splitSentence(['hello']), TypeError);
    });
});

describe('addWords()', () => {
    it('adds a word and returns the instance', () => {
        const ninja = new WordsNinja();
        assert.equal(ninja.addWords('parsa'), ninja);
        assert.deepEqual(ninja.splitSentence('parsayouneedtolearnfromyourmistakes'), [
            'parsa',
            'you',
            'need',
            'to',
            'learn',
            'from',
            'your',
            'mistakes',
        ]);
    });

    it('adds words case-insensitively and accepts arrays', () => {
        const ninja = new WordsNinja().addWords(['Parsa', 'Kafi']);
        assert.deepEqual(ninja.splitSentence('parsakafi'), ['parsa', 'kafi']);
        assert.deepEqual(ninja.splitSentence('PARSAPLUSKAFI'), ['PARSA', 'PLUS', 'KAFI']);
    });

    it('does not leak words into other instances', () => {
        const first = new WordsNinja().addWords('mycustomword');
        const second = new WordsNinja();

        assert.deepEqual(first.splitSentence('mycustomword'), ['mycustomword']);
        assert.notDeepEqual(second.splitSentence('mycustomword'), ['mycustomword']);
    });

    it('ignores empty entries', () => {
        const ninja = new WordsNinja();
        assert.equal(ninja.addWords(['', '   ']), ninja);
        assert.deepEqual(ninja.splitSentence('hello'), ['hello']);
    });

    it('matches accented words with or without accents', () => {
        const ninja = new WordsNinja({dictionary: []});
        ninja.addWords('caf\u00e9');

        assert.deepEqual(ninja.splitSentence('caf\u00e9latte'), ['caf\u00e9', 'latte']);
        assert.deepEqual(ninja.splitSentence('cafelatte'), ['cafe', 'latte']);
        assert.deepEqual(
            ninja.splitSentence('caf\u00e9latte', {normalizeAccents: false}),
            ['caf\u00e9', 'latte']
        );
    });

    it('rejects invalid words', () => {
        const ninja = new WordsNinja();
        assert.throws(() => ninja.addWords(42), TypeError);
        assert.throws(() => ninja.addWords([null]), TypeError);
        assert.throws(() => ninja.addWords('two words'), TypeError);
    });
});

describe('custom dictionaries', () => {
    it('uses an array dictionary', () => {
        const ninja = new WordsNinja({dictionary: ['foo', 'bar']});
        assert.deepEqual(ninja.splitSentence('foobarfoofoo'), ['foo', 'bar', 'foo', 'foo']);
    });

    it('keeps instances independent', () => {
        const first = new WordsNinja({dictionary: ['foo']});
        const second = new WordsNinja({dictionary: ['bar']});

        assert.deepEqual(first.splitSentence('foo'), ['foo']);
        assert.deepEqual(second.splitSentence('foo'), ['foo']);
        assert.deepEqual(first.splitSentence('bar'), ['bar']);
    });

    it('accepts an empty dictionary', () => {
        const ninja = new WordsNinja({dictionary: []});
        assert.deepEqual(ninja.splitSentence('hello world'), ['hello', 'world']);
        assert.deepEqual(ninja.splitSentence('hello', {unknownWordPenalty: null}), []);
    });
});

describe('constructor', () => {
    it('works without arguments', () => {
        assert.ok(new WordsNinja() instanceof WordsNinja);
    });

    it('validates options', () => {
        assert.throws(() => new WordsNinja(null), TypeError);
        assert.throws(() => new WordsNinja('dictionary.txt'), TypeError);
        assert.throws(() => new WordsNinja([]), TypeError);
        assert.throws(() => new WordsNinja({dictionary: 42}), TypeError);
    });
});
