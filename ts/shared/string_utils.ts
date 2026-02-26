import { compact, uniq } from 'lodash';

/**
 * Returns a compact list of all the items present in all those arrays, once each only.
 */
export function uniqFromListOfList<T extends string>(list: Array<Array<T>>): Array<T> {
  return uniq(compact(list.flat()));
}

/**
 * Collapses a string by replacing characters between the leading and trailing characters with a triple ellipsis unicode character (length 1).
 * The final length of the string will be the sum of the leading and trailing characters plus 1 (or 3 if spacesAroundEllipsis is true).
 * @param str - The input string to collapse.
 * @param leadingChars - The number of characters to keep at the beginning of the string.
 * @param trailingChars - The number of characters to keep at the end of the string.
 * @param spacesAroundEllipsis - Whether to add spaces around the ellipsis.
 * @param separator - The separator to use between the leading and trailing characters.
 * @returns The collapsed string.
 */
export const collapseString = (
  str: string,
  leadingChars = 6,
  trailingChars = 4,
  spacesAroundEllipsis = false,
  separator = '…'
): string => {
  if (str.length <= leadingChars + trailingChars + 1 + (spacesAroundEllipsis ? 2 : 0)) {
    return str;
  }
  const ellipsis = spacesAroundEllipsis ? ` ${separator} ` : separator;
  return `${str.slice(0, leadingChars)}${ellipsis}${str.slice(-trailingChars)}`;
};
