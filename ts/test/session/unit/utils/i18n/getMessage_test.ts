// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - TODO: add generic type to setupI18n to fix this

import { expect } from 'chai';
import { tr } from '../../../../../localization/localeTools';

describe('getMessage', () => {
  it('returns the message for a token', () => {
    const message = tr('searchContacts');
    expect(message).to.equal('Search Contacts');
  });

  it('returns the message for a plural token', () => {
    const message = tr('searchMatches', { count: 1, found_count: 2 });
    expect(message).to.equal('2 of 1 match');
  });

  it('returns the message for a token with no args', () => {
    const message = tr('adminPromote');
    expect(message).to.equal('Promote Admins');
  });

  it('returns the message for a token with a tag and args', () => {
    const message = tr('adminPromotedToAdmin', { name: 'Alice' });
    expect(message).to.equal('<b>Alice</b> was promoted to Admin.');
  });
});
