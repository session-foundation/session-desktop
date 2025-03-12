// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - TODO: add generic type to setupI18n to fix this

import { expect } from 'chai';
import { initI18n } from './util';

describe('stripped', () => {
  it('returns the stripped message for a token', () => {
    const message = initI18n().stripped('search');
    expect(message).to.equal('Search');
  });

  it('returns the stripped message for a plural token', () => {
    const message = initI18n().stripped('searchMatches', { count: 1, found_count: 2 });
    expect(message).to.equal('2 of 1 match');
  });

  it('returns the stripped message for a token with the tags stripped', () => {
    const message = initI18n().stripped('messageRequestYouHaveAccepted', { name: 'Alice' });
    expect(message).to.equal('You have accepted the message request from Alice.');
  });

  it('returns the stripped message for a token with the tags stripped', () => {
    const message = initI18n().stripped('adminPromoteTwoDescription', {
      name: 'Alice',
      other_name: 'Bob',
    });
    expect(message).to.equal(
      'Are you sure you want to promote Alice and Bob to admin? Admins cannot be removed.'
    );
  });
});
