import { Constants } from '..';

/**
 * returns at most Constants.CONVERSATION.MAX_SHORTENED_NAME_LENGTH (10 char)
 * characters of the displayName, adds `…` if needed
 */
export function shortenDisplayName(displayName: string) {
  return `${displayName.slice(0, Constants.CONVERSATION.MAX_SHORTENED_NAME_LENGTH)}${displayName.length > Constants.CONVERSATION.MAX_SHORTENED_NAME_LENGTH ? '…' : ''}`;
}
