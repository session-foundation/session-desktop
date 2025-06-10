/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */
/* eslint-disable no-param-reassign */
/* eslint-disable import/no-mutable-exports  */
import { init, I18n } from 'emoji-mart';
import { FixedBaseEmoji, NativeEmojiData } from '../types/Reaction';
import { loadEmojiPanelI18n } from './i18n/emojiPanelI18n';

export type SizeClassType = 'default' | 'small' | 'medium' | 'large' | 'jumbo';

function getRegexUnicodeEmojis() {
  return /\p{Emoji_Presentation}/gu;
}

function getCountOfAllMatches(str: string) {
  const regex = getRegexUnicodeEmojis();

  const matches = str.match(regex);

  return matches?.length || 0;
}

function hasNormalCharacters(str: string) {
  const noEmoji = str.replace(getRegexUnicodeEmojis(), '').trim();
  return noEmoji.length > 0;
}

export function getEmojiSizeClass(str: string): SizeClassType {
  if (!str || !str.length) {
    return 'small';
  }
  if (hasNormalCharacters(str)) {
    return 'small';
  }

  const emojiCount = getCountOfAllMatches(str);
  if (emojiCount > 6) {
    return 'small';
  }
  if (emojiCount > 4) {
    return 'medium';
  }
  if (emojiCount > 2) {
    return 'large';
  }
  return 'jumbo';
}

export let nativeEmojiData: NativeEmojiData | null = null;
export let i18nEmojiData: typeof I18n | null = null;

export async function initialiseEmojiData(data: any): Promise<void> {
  const ariaLabels: Record<string, string> = {};
  const ids: Record<string, string> = {};
  Object.entries(data.emojis).forEach(([key, value]: [string, any]) => {
    value.search = `,${[
      [value.id, false],
      [value.name, true],
      [value.keywords, false],
      [value.emoticons, false],
    ]
      .map(([strings, split]) => {
        if (!strings) {
          return null;
        }
        return (Array.isArray(strings) ? strings : [strings])
          .map(string =>
            (split ? string.split(/[-|_|\s]+/) : [string]).map((s: string) => s.toLowerCase())
          )
          .flat();
      })
      .flat()
      .filter(a => a && a.trim())
      .join(',')})}`;

    (value as FixedBaseEmoji).skins.forEach(skin => {
      ariaLabels[skin.native] = value.name;
      ids[skin.native] = value.id;
    });

    data.emojis[key] = value;
  });

  data.ariaLabels = ariaLabels;
  data.ids = ids;
  nativeEmojiData = data;

  i18nEmojiData = await loadEmojiPanelI18n();
  // Data needs to be initialised once per page load for the emoji components
  // See https://github.com/missive/emoji-mart#%EF%B8%8F%EF%B8%8F-headless-search
  await init({ data, i18n: i18nEmojiData });
}

// Synchronous version of Emoji Mart's SearchIndex.search()
// If we upgrade the package things will probably break
export function searchSync(query: string, args?: any): Array<FixedBaseEmoji> {
  if (!nativeEmojiData) {
    window.log.error('No native emoji data found');
    return [];
  }

  if (!query || !query.trim().length) {
    return [];
  }

  const maxResults = args && args.maxResults ? args.maxResults : 90;
  const values = query
    .toLowerCase()
    .replace(/(\w)-/, '$1 ')
    .split(/[\s|,]+/)
    .filter((word: string, i: number, words: Array<string>) => {
      return word.trim() && words.indexOf(word) === i;
    });

  if (!values.length) {
    return [];
  }

  let pool: any = Object.values(nativeEmojiData.emojis);
  let results: Array<FixedBaseEmoji> = [];
  let scores: Record<string, number> = {};

  for (const value of values) {
    if (!pool.length) {
      break;
    }

    results = [];
    scores = {};

    for (const emoji of pool) {
      if (!emoji.search) {
        continue;
      }
      const score: number = emoji.search.indexOf(`,${value}`);
      if (score === -1) {
        continue;
      }

      results.push(emoji);
      scores[emoji.id] = scores[emoji.id] ? scores[emoji.id] : 0;
      scores[emoji.id] += emoji.id === value ? 0 : score + 1;
    }
    pool = results;
  }

  if (results.length < 2) {
    return results;
  }

  results.sort((a: FixedBaseEmoji, b: FixedBaseEmoji) => {
    const aScore = scores[a.id];
    const bScore = scores[b.id];

    if (aScore === bScore) {
      return a.id.localeCompare(b.id);
    }

    return aScore - bScore;
  });

  if (results.length > maxResults) {
    results = results.slice(0, maxResults);
  }
  return results;
}

enum EmojiMartLocalStorageKey {
  // Users frequently used emojis
  FREQUENTLY_USED = 'emoji-mart.frequently',
  // Last emoji the user used via emoji mart
  LAST = 'emoji-mart.last',
  // Skin tone preference the user set via emoji mart
  SKIN = 'emoji-mart.skin',
}

/**
 * Get the user's frequently used emojis from local storage.
 * This is sorted in descending order of frequency. This is a mirror of what emoji mart does internally.
 * TODO: consider if we need to cache the localStorage item
 */
export function getFrequentlyUsedEmojis(): Array<string> {
  try {
    const data = localStorage.getItem(EmojiMartLocalStorageKey.FREQUENTLY_USED);
    if (!data) {
      return [];
    }
    return Object.entries(JSON.parse(data) as Record<string, number>)
      .sort(([, a], [, b]) => b - a)
      .map(([key]) => key);
  } catch (e) {
    window.log.error(e);
    return [];
  }
}

enum EmojiMartSkinTone {
  // 👍
  Default = 0,
  // 👍🏻
  Light = 1,
  // 👍🏼
  MediumLight = 2,
  // 👍🏽
  Medium = 3,
  // 👍🏾
  MediumDark = 4,
  // 👍🏿
  Dark = 5,
}

const validSkinTones = Object.values(EmojiMartSkinTone) as Array<EmojiMartSkinTone>;

const isEmojiMartSkinTone = (tone: unknown): tone is EmojiMartSkinTone =>
  validSkinTones.includes(tone as EmojiMartSkinTone);

/**
 * Get the user's emoji skin tone preference from local storage.
 * NOTE: This value is the index in the emoji skin array.
 * TODO: consider if we need to cache the localStorage item
 */
export function getEmojiSkinTonePreferenceIndex(): EmojiMartSkinTone {
  try {
    const preference = localStorage.getItem(EmojiMartLocalStorageKey.SKIN);
    if (!preference) {
      return EmojiMartSkinTone.Default;
    }
    const num = Number(preference);
    if (Number.isNaN(num) || num < 1) {
      return EmojiMartSkinTone.Default;
    }

    // Emoji mart stores this as a number from 1 to 6, not the index, so we need to subtract 1.
    const idx = num - 1;

    return isEmojiMartSkinTone(idx) ? idx : EmojiMartSkinTone.Default;
  } catch (e) {
    window.log.error(e);
    return EmojiMartSkinTone.Default;
  }
}
