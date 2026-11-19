'use strict';

/**
 * Ground-truth accuracy benchmark.
 *
 * Each corpus file holds one sentence per line with the intended word
 * boundaries. The harness removes the spaces and scores the segmentation
 * against those words:
 *
 *   - exact: the whole sentence split correctly
 *   - precision / recall / F1 at word level (longest-common-subsequence
 *     alignment, so one boundary error does not count twice)
 *   - stray single letters: emitted one-character tokens that are not part of
 *     the intended split (`sand` -> `s and` is one stray letter)
 *
 * `corpus.txt` is the hand-written set used while tuning the cost model.
 * `prose.txt` is held out: sentences from public-domain novels that should not
 * be edited to make a change pass.
 *
 *   npm run bench:accuracy
 *   node bench/accuracy.js --verbose
 *   node bench/accuracy.js --min-exact=87 --min-prose-exact=78
 */

const fs = require('node:fs');
const path = require('node:path');
const WordsNinja = require('../index.js');

const corpora = [
    {file: 'corpus.txt', flag: '--min-exact', floor: null},
    {file: 'prose.txt', flag: '--min-prose-exact', floor: null},
];

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

for (const corpus of corpora) {
    const arg = args.find((value) => value.startsWith(`${corpus.flag}=`));
    if (arg === undefined) continue;

    corpus.floor = Number(arg.slice(corpus.flag.length + 1));
    if (!Number.isFinite(corpus.floor)) {
        throw new Error(`wordsninja: ${corpus.flag} needs a number, e.g. ${corpus.flag}=87`);
    }
}

function readCorpus(file) {
    return fs
        .readFileSync(path.join(__dirname, file), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function lcsLength(a, b) {
    const width = b.length + 1;
    let previous = new Uint32Array(width);
    let current = new Uint32Array(width);

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            current[j] =
                a[i - 1] === b[j - 1]
                    ? previous[j - 1] + 1
                    : Math.max(previous[j], current[j - 1]);
        }
        [previous, current] = [current, previous];
    }

    return previous[b.length];
}

function evaluate(ninja, lines) {
    const misses = [];
    let exact = 0;
    let matched = 0;
    let emittedWords = 0;
    let intendedWords = 0;
    let stray = 0;

    for (const line of lines) {
        const intended = line.toLowerCase().split(/\s+/);
        const emitted = ninja.splitSentence(intended.join('')).map((word) => word.toLowerCase());

        intendedWords += intended.length;
        emittedWords += emitted.length;
        matched += lcsLength(intended, emitted);
        stray += emitted.filter(
            (word) => word.length === 1 && !intended.includes(word)
        ).length;

        if (
            intended.length === emitted.length &&
            intended.every((word, index) => word === emitted[index])
        ) {
            exact++;
        } else {
            misses.push(`${intended.join(' ')} -> ${emitted.join(' ')}`);
        }
    }

    const precision = matched / emittedWords;
    const recall = matched / intendedWords;

    return {
        total: lines.length,
        exact,
        intendedWords,
        precision,
        recall,
        f1: (2 * precision * recall) / (precision + recall),
        stray,
        misses,
    };
}

const percent = (value) => `${(value * 100).toFixed(1)}%`;
const ninja = new WordsNinja();
const failures = [];

for (const corpus of corpora) {
    const result = evaluate(ninja, readCorpus(corpus.file));
    const ratio = result.exact / result.total;
    const row = (label, value) => console.log(`${label.padEnd(21)}${value}`);

    row(corpus.file, `${result.total} sentences, ${result.intendedWords} words`);
    row('exact match', `${result.exact}/${result.total} (${percent(ratio)})`);
    row('word precision', percent(result.precision));
    row('word recall', percent(result.recall));
    row('word f1', percent(result.f1));
    row('stray single letters', result.stray);

    if (verbose) {
        for (const miss of result.misses) console.log(`  miss: ${miss}`);
    }

    console.log('');

    if (corpus.floor !== null && ratio * 100 < corpus.floor) {
        failures.push(
            `${corpus.file}: exact match ${percent(ratio)} is below the ${corpus.floor}% floor`
        );
    }
}

if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
}
