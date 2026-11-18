'use strict';

const WordsNinja = require('./index.js');

(async () => {
    const ninja = new WordsNinja();

    // Optional: warm up the dictionary (it also loads lazily).
    await ninja.loadDictionary();

    // 1. Basic usage.
    console.log(ninja.splitSentence('youneedtolearnfromyourmistakes'));
    // [ 'you', 'need', 'to', 'learn', 'from', 'your', 'mistakes' ]

    // 2. Camel case, capitalization and joining.
    console.log(
        ninja.splitSentence('helloWorldHowAreYou', {
            camelCaseSplitter: true,
            capitalizeFirstLetter: true,
            joinWords: true,
        })
    ); // 'Hello World How Are You'

    // 3. Offsets into the original string.
    const input = 'Ihave2cats';
    const tokens = ninja.splitSentence(input, {withOffsets: true});
    console.log(tokens);
    console.log(tokens.map((token) => input.slice(token.start, token.end)));

    // 4. Add words to this instance.
    ninja.addWords(['parsa', 'kafi']);
    console.log(ninja.splitSentence('parsakafiwritescode'));

    // 5. A custom dictionary.
    const code = new WordsNinja({dictionary: ['code', 'ninja']});
    console.log(code.splitSentence('codeninja'));

    // 6. Text the dictionary cannot cover is kept as a token.
    console.log(ninja.splitSentence('\u0633\u0644\u0627\u0645\u062f\u0646\u06cc\u0627'));
})();
