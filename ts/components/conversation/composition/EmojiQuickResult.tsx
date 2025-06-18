import { SearchIndex } from 'emoji-mart';
import styled from 'styled-components';
import { getEmojiSkinTonePreferenceIndex, searchSync } from '../../../util/emoji';
import type { SessionSuggestionDataItem } from './types';
import type { FixedBaseEmoji } from '../../../types/Reaction';

const EmojiQuickResult = styled.span`
  display: flex;
  align-items: center;
  min-width: 250px;
  width: 100%;
  padding-inline-end: 20px;
  padding-inline-start: 10px;
`;
const EmojiQuickResultIcon = styled.span`
  padding-inline-end: 20px;
  padding-inline-start: 10px;
  font-size: 1.4rem;
`;

export const renderEmojiQuickResultRow = (id: string, display: string) => {
  return (
    <EmojiQuickResult>
      <EmojiQuickResultIcon>{id}</EmojiQuickResultIcon>
      <span>{display}</span>
    </EmojiQuickResult>
  );
};

export const searchEmojiForQuery = (
  query: string,
  maxResults: number
): Array<SessionSuggestionDataItem> => {
  if (query.length === 0 || !SearchIndex) {
    return [];
  }

  const results1 = searchSync(`:${query}`);
  const results2 = searchSync(query);

  const addedIds = new Set<string>();
  const results: Array<FixedBaseEmoji> = [];

  function parseResults(res: Array<FixedBaseEmoji>) {
    for (let i = 0; i < res.length; i++) {
      const emoji = res[i];
      if (!addedIds.has(emoji.id)) {
        results.push(emoji);
        addedIds.add(emoji.id);
      }
    }
  }

  parseResults(results1);
  parseResults(results2);

  if (!results.length) {
    return [];
  }

  const skinToneIdx = getEmojiSkinTonePreferenceIndex();

  return results
    .map((emoji: FixedBaseEmoji) => {
      const skin = emoji.skins[skinToneIdx] ?? emoji.skins[0];
      return {
        id: skin.native,
        display: `:${emoji.id}:`,
      };
    })
    .slice(0, maxResults);
};
