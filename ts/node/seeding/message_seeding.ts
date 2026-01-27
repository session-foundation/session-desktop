/* eslint-disable no-restricted-syntax */

import { enSimpleNoArgs } from '../../localization/generated/english';

function extractWords(translationsObject: Record<string, string>): Array<string> {
  const wordSet = new Set<string>();

  // Iterate through all translation values
  for (const value of Object.values(translationsObject)) {
    // Split on spaces and common punctuation, keeping words with letters
    const textWords = value
      .split(/[\s,.:;!?()[\]{}]+/)
      .filter(w => w.length > 0 && /[a-zA-Z]/.test(w));

    textWords.forEach(word => {
      wordSet.add(word.toLowerCase());
    });
  }

  return Array.from(wordSet);
}

const words = extractWords(enSimpleNoArgs);

function generateRandomText(minWords: number = 5, maxWords: number = 50): string {
  const wordCount = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
  const selectedWords: Array<string> = [];

  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    selectedWords.push(words[randomIndex]);
  }

  // Capitalize first word and add period at end
  const text = selectedWords.join(' ');
  return `${text.charAt(0).toUpperCase() + text.slice(1)}.`;
}

function generateBulkText(
  count: number,
  minWords: number = 5,
  maxWords: number = 100
): Array<string> {
  const texts: Array<string> = [];

  for (let i = 0; i < count; i++) {
    texts.push(generateRandomText(minWords, maxWords));
  }

  return texts;
}

export { generateBulkText, generateRandomText };
