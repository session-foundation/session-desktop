import { getBrowserLocale } from '../shared';

/**
 * @returns a Intl formatter that can be used to do ["Alice", "Bob"].join(', ') in a locale dependent way.
 * i.e. the ', ' is not always what needs to be used to join strings together.
 */
export function getLocalizedStringListJoin() {
  return new Intl.ListFormat(getBrowserLocale(), {
    style: 'narrow',
    type: 'conjunction',
  });
}
