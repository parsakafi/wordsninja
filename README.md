# WordsNinja 🐱‍👤
Split a English sentence without any spaces nor accents, into words.

## Install
```bash
npm install wordsninja --save
```
Load package
```js
const WordsNinjaPack = require('wordsninja');
const WordsNinja = new WordsNinjaPack();
```


Load dictionary

```js
await WordsNinja.loadDictionary(); // First load dictionary
```



Add word(s)

```js
WordsNinja.addWords('new word');
```
Parameters

- `word`: The word (string|array)



### Split sentence

```js
let words = WordsNinja.splitSentence(string, {camelCaseSplitter, capitalizeFirstLetter, joinWords});
```

Parameters
- `string`: The string for split
	- `options`
	  - `camelCaseSplitter`: Split by Camel Case, Default is `false` (optional)
	  - `capitalizeFirstLetter`: Capitalize First Letter, Default is `false` (optional)
	  - `joinWords`: Return join words as sentence, Default is `false` (optional)

Example

```js
(async () => {
    await WordsNinja.loadDictionary(); // First load dictionary
    let string = 'youneedtolearnfromyourmistakes';
    let words = WordsNinja.splitSentence(string);
    console.log(words);
})();
```

Result

```js
[ 'you', 'need', 'to', 'learn', 'from', 'your', 'mistakes' ]
```



#### More options

```js
let string = 'youneedtolearnfromyourmistakes';
let words = WordsNinja.splitSentence(string,
    {
        camelCaseSplitter: true,  // Frist camel case spliting
        capitalizeFirstLetter: true,  // Capitalize first letter of result
        joinWords: true  // Join words
    }
);
console.log(words);
```

Result

```
You Need To Learn From Your Mistakes
```



### Add Word(s)

You can add new word(s) to dictionary in runtime
```js
WordsNinja.addWords('Parsa');  // Add one word
WordsNinja.addWords(['Parsa', 'Kafi']); // Add one or more words
```

Example

```js
let string = 'parsayouneedtolearnfromyourmistakes';
WordsNinja.addWords('Parsa');
let words = WordsNinja.splitSentence(string,
    {
        capitalizeFirstLetter: true,  // Capitalize first letter of result
        joinWords: true  // Join words
    }
);
console.log(words);
```

Result

```
Parsa You Need To Learn From Your Mistakes
```




## Acknowledgement

Algorithm from [How to split text without spaces into list of words?](https://stackoverflow.com/questions/8870261/how-to-split-text-without-spaces-into-list-of-words). 
List of words from [wordninja](https://pypi.org/project/wordninja) python package. Camel case splitter based on [split-camelcase-to-words](https://www.npmjs.com/package/split-camelcase-to-words) package.