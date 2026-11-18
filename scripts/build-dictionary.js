'use strict';

/**
 * Rebuild `words-en.json`.
 *
 * The bundled list comes from the Python `wordninja` project and is ordered by
 * frequency. This script validates it, removes duplicates while preserving the
 * first (most frequent) occurrence, and writes it back in a stable format.
 *
 *   npm run build:dictionary
 */

const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'words-en.json');
const raw = fs.readFileSync(file, 'utf8');
const words = JSON.parse(raw);

if (!Array.isArray(words)) {
    throw new Error('words-en.json must contain a JSON array');
}

const seen = new Set();
const cleaned = [];
let removed = 0;

for (const word of words) {
    if (typeof word !== 'string') {
        throw new Error(`words-en.json contains a non-string entry: ${JSON.stringify(word)}`);
    }

    const value = word.trim().toLowerCase();
    if (!value) {
        removed++;
        continue;
    }
    if (seen.has(value)) {
        removed++;
        continue;
    }

    seen.add(value);
    cleaned.push(value);
}

if (cleaned.length !== words.length) {
    fs.writeFileSync(file, JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
}

console.log(
    `words-en.json: ${cleaned.length} words, ${removed} duplicate/empty entries removed`
);
