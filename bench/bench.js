'use strict';

/**
 * Quick benchmark for the segmentation hot path.
 *
 *   npm run bench
 */

const WordsNinja = require('..');

function measure(label, fn, runs = 3) {
    let result;
    let best = Infinity;

    for (let i = 0; i < runs; i++) {
        const start = process.hrtime.bigint();
        result = fn();
        const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
        if (elapsed < best) best = elapsed;
    }

    console.log(
        `${label.padEnd(28)} ${best.toFixed(1).padStart(7)} ms   (${result.length} tokens)`
    );
    return result;
}

const started = process.hrtime.bigint();
const ninja = new WordsNinja();
const loadStart = process.hrtime.bigint();
ninja.loadDictionary();
const loaded = process.hrtime.bigint();

console.log(
    `dictionary load${''.padEnd(14)} ${(Number(loaded - loadStart) / 1e6).toFixed(1).padStart(7)} ms`
);

const sample = 'youneedtolearnfromyourmistakes';

measure('short (26 chars)', () => ninja.splitSentence(sample));
measure('4k chars', () => ninja.splitSentence(sample.repeat(150)));
measure('20k chars', () => ninja.splitSentence(sample.repeat(700)));
measure('offsets, 4k chars', () =>
    ninja.splitSentence(sample.repeat(150), {withOffsets: true})
);

const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
console.log(`total wall time${''.padEnd(12)} ${elapsed.toFixed(1)} ms`);
console.log(`heap used${''.padEnd(18)} ${(process.memoryUsage().heapUsed / 1048576).toFixed(1)} MB`);
