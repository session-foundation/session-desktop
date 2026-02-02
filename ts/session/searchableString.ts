/**
 * When searching contacts and group, some of those can have accents, capital letters, and characters that our locale won't match
 * with a search term.
 *
 * We want to be able to find a contact with the name "Éric" even if the user searches for "eric". (so incorrect case and missing accents)
 * Same for other languages using the Cyrillic alphabet, `Привет` should match `привет`
 * This function
 * - convert to lowercase,
 * - removes diacritics from Latin characters
 *
 * So
 * - Éric, ERIC, ÉRIC, éric, ... will all be returned as eric
 * - Привет, привет, ПРИВЕТ, привет, ... will all be returned as привет
 *
 * The search term should go through the same function.
 */
export function toSearchableString(str?: string): string {
  if (!str) {
    return '';
  }
  return str
    .toLocaleLowerCase('en-US')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
