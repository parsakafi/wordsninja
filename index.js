'use strict'

const fs = require("fs");
const path = require('path');
const splitRegex = new RegExp("[^a-zA-Z0-9']+", "g");
const FILE_WORDS = path.join(__dirname, 'words-en.txt');
let maxWordLen = 0;
let wordCost = {};
let maxCost = 9e999;

/**
 * WordsNinja, Split your string text without space to english words
 * @class
 */
class WordsNinja {
    /**
     * Load Dictionary
     * @return {Object} Objects of dictionary
     */
    loadDictionary() {
        return new Promise((resolve) => {
            fs.readFile(FILE_WORDS, 'utf8', function (err, data) {
                if (err)
                    throw err;

                let words = data.split('\n');

                words.forEach(function (word, index) {
                    wordCost[word] = Math.log((index + 1) * Math.log(words.length));
                    if (word.length > maxWordLen)
                        maxWordLen = word.length;
                    if (wordCost[word] < maxCost)
                        maxCost = wordCost[word];
                });
                resolve(wordCost);
            });
        });
    };

    /**
     * @param {string} string - The string for split
     * @param {object} options - The Options
     * @param {boolean} options.camelCaseSplitter - Split by Camel Case, Default false (optional)
     * @param {boolean} options.capitalizeFirstLetter - Capitalize First Letter, Default false (optional)
     * @param {boolean} options.joinWords - Return join words as sentence, Default false (optional)
     * @returns {Array|string} result - Split String
     */
    splitSentence(string, { camelCaseSplitter, capitalizeFirstLetter, joinWords } = {}) {
        let list = [];
        let that = this;
        camelCaseSplitter = camelCaseSplitter || false;
        capitalizeFirstLetter = capitalizeFirstLetter || false;
        joinWords = joinWords || false;
        if (camelCaseSplitter)
            string = this.camelCaseSplitter(string);

        string.split(splitRegex).forEach(function (sub) {
            that.splitWords(sub).forEach(function (word) {
                word = capitalizeFirstLetter ? that.capitalizeFirstLetter(word) : word;
                list.push(word);
            })
        })
        if (joinWords)
            return list.join(' ');
        else
            return list;
    }

    /**
     * Add words to dictionary
     * @param {Array|string} words Word(s) to add dictionary
     * @return {void}
     */
    addWords(words) {
        if (Array.isArray(words)) {
            for (let value of words)
                this.addWords(value);
        } else {
            let word = words.toLocaleLowerCase();
            wordCost[word] = maxCost;
            if (word.length > maxWordLen)
                maxWordLen = word.length;
        }
    }

    /**
     * Split Words
     * @private
     * @param {string} s Input String
     * @return {Array} Splited Words
     */
    splitWords(s) {
        let cost = [0];

        function best_match(i) {
            let candidates = cost.slice(Math.max(0, i - maxWordLen), i).reverse();
            let minPair = [Number.MAX_SAFE_INTEGER, 0];
            candidates.forEach(function (c, k) {
                let ccost;
                if (wordCost[s.substring(i - k - 1, i).toLowerCase()]) {
                    ccost = c + wordCost[s.substring(i - k - 1, i).toLowerCase()];
                } else {
                    ccost = Number.MAX_SAFE_INTEGER;
                }
                if (ccost < minPair[0]) {
                    minPair = [ccost, k + 1];
                }
            })
            return minPair;
        }

        for (let i = 1; i < s.length + 1; i++) {
            cost.push(best_match(i)[0]);
        }

        let out = [];
        let i = s.length;
        while (i > 0) {
            let c = best_match(i)[0];
            let k = best_match(i)[1];
            //if (c == cost[i])
            //    console.log("Alert: " + c);

            let newToken = true;
            if (s.slice(i - k, i) != "'") {
                if (out.length > 0) {
                    if (out[-1] == "'s" || (Number.isInteger(s[i - 1]) && Number.isInteger(out[-1][0]))) {
                        out[-1] = s.slice(i - k, i) + out[-1];
                        newToken = false;
                    }
                }
            }

            if (newToken) {
                out.push(s.slice(i - k, i))
            }

            i -= k
        }

        return out.reverse();
    }

    /**
     * Camel Case Splitter
     * Based on 'split-camelcase-to-words' package, https://www.npmjs.com/package/split-camelcase-to-words
     * @private
     * @param {string} inputString 
     * @return {string} String
     */
    camelCaseSplitter(inputString) {
        let notNullString = inputString || '';
        let trimmedString = notNullString.trim();
        let arrayOfStrings = trimmedString.split(' ');

        let splitStringsArray = [];
        arrayOfStrings.forEach(tempString => {
            if (tempString != '') {
                let splitWords = tempString.split(/(?=[A-Z])/).join(" ");
                splitStringsArray.push(splitWords);
            }
        });

        return splitStringsArray.join(" ");
    }

    /**
     * Capitalize First Letter
     * @private
     * @param {string} string - String to Capitalize First Letter
     * @return {string} result
     */
    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}

module.exports = WordsNinja;
