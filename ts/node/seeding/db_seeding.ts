/* eslint-disable no-restricted-syntax */

import { chunk } from 'lodash';
import { v4 } from 'uuid';
import { enSimpleNoArgs } from '../../localization/generated/english';
import type { MessageAttributes } from '../../models/messageType';
import { getLoggedInUserConvoDuringMigration } from '../migration/utils';
import { assertGlobalInstance } from '../sqlInstance';
import { toSqliteBoolean } from '../database_utility';
import type { ConversationAttributes } from '../../models/conversationAttributes';
import { ConversationTypeEnum } from '../../models/types';
import { sqlNode } from '../sql';

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

export function seedMessages({
  count,
  minWords,
  maxWords,
  conversationId,
  source,
}: {
  count: number;
  minWords: number;
  maxWords: number;
  conversationId: string | null;
  source: string | null;
}) {
  const now = Date.now();
  console.log(`about to seed ${count} messages`);

  const isOutgoing = Math.random() < 0.5;

  const bulkText = generateBulkText(count, minWords, maxWords);

  const ourPk = getLoggedInUserConvoDuringMigration(assertGlobalInstance())?.ourKeys.publicKeyHex;

  if (!ourPk) {
    return;
  }

  const messageAttrsOpts: Array<MessageAttributes> = bulkText.map(body => {
    return {
      id: v4(),
      source: source ?? ourPk,
      type: isOutgoing ? 'outgoing' : 'incoming',
      direction: isOutgoing ? 'outgoing' : 'incoming',
      timestamp: Date.now(),
      conversationId: conversationId ?? ourPk,
      body,
      received_at: Date.now(),
      serverTimestamp: Date.now(),
      expireTimer: 0,
      expirationStartTimestamp: 0,
      read_by: [],
      unread: toSqliteBoolean(false),
      sent_to: [],
      sent: true,
      sentSync: true,
      synced: true,
      sync: false,
    };
  });

  let seededCount = 0;
  chunk(messageAttrsOpts, 1000).forEach(item => {
    sqlNode.saveMessages(item);
    seededCount += item.length;
    console.log(`seeded so far ${seededCount} out of ${count} messages in ${Date.now() - now}ms`);
  });

  console.log(`seeded ${count} messages in ${Date.now() - now}ms`);
}

/**
 * Generate random hex string for Session public key (66 chars: 05 prefix + 64 hex chars)
 */
function generateRandomSessionId(): string {
  const hexChars = '0123456789abcdef';
  let result = '05'; // Standard Session pubkey prefix
  for (let i = 0; i < 64; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a bunch of random private conversations with messages in them.
 * Note: if any changes are made, a libsession config sync will be done
 * and all of those conversations will get removed (slowly)
 */
export function seedPrivateConversations({
  conversationCount,
  messagesPerConversation,
  minWords,
  maxWords,
}: {
  conversationCount: number;
  messagesPerConversation: number;
  minWords: number;
  maxWords: number;
}) {
  const now = Date.now();
  console.log(
    `about to seed ${conversationCount} private conversations with ${messagesPerConversation} messages each`
  );

  const ourPk = getLoggedInUserConvoDuringMigration(assertGlobalInstance())?.ourKeys.publicKeyHex;

  if (!ourPk) {
    console.warn('Cannot seed private conversations: no logged in user found');
    return;
  }

  for (let i = 0; i < conversationCount; i++) {
    const contactPubkey = generateRandomSessionId();
    const conversationTimestamp = Date.now();

    // Create the conversation
    const conversationAttrs: ConversationAttributes = {
      id: contactPubkey,
      type: ConversationTypeEnum.PRIVATE,
      active_at: conversationTimestamp,
      lastMessage: null,
      lastMessageStatus: undefined,
      lastMessageInteractionType: null,
      lastMessageInteractionStatus: null,
      left: false,
      isTrustedForAttachmentDownload: false,
      lastJoinedTimestamp: 0,
      expireTimer: 0,
      expirationMode: 'off',
      members: [],
      groupAdmins: [],
      triggerNotificationsFor: 'all',
      priority: 0,
      isApproved: true,
      didApproveMe: true,
      markedAsUnread: false,
      blocksSogsMsgReqsTimestamp: 0,
    };

    sqlNode.saveConversation(conversationAttrs);

    seedMessages({
      count: messagesPerConversation,
      minWords,
      maxWords,
      conversationId: contactPubkey,
      source: ourPk,
    });

    console.log(
      `seeded conversation ${i + 1}/${conversationCount} with ${messagesPerConversation} messages`
    );
  }

  console.log(
    `seeded ${conversationCount} private conversations with ${messagesPerConversation} messages each in ${Date.now() - now}ms`
  );
}
