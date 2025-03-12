// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - TODO: add generic type to setupI18n to fix this

import { expect } from 'chai';
import { initI18n } from './util';

describe('getRawMessage', () => {
  it('returns the raw message for a token', () => {
    const rawMessage = initI18n().getRawMessage('en', 'adminPromoteDescription', { name: 'Alice' });
    expect(rawMessage).to.equal(
      'Are you sure you want to promote <b>{name}</b> to admin? Admins cannot be removed.'
    );
  });

  it('returns the raw message for a plural token', () => {
    const rawMessage = initI18n().getRawMessage('en', 'searchMatches', {
      count: 1,
      found_count: 2,
    });
    expect(rawMessage).to.equal('{found_count} of {count} match');
  });

  it('returns the raw message for a token with no args', () => {
    const rawMessage = initI18n().getRawMessage('en', 'adminCannotBeRemoved');
    expect(rawMessage).to.equal('Admins cannot be removed.');
  });

  it('returns the raw message for a token with args', () => {
    const rawMessage = initI18n().getRawMessage('en', 'adminPromotionFailedDescription', {
      name: 'Alice',
      group_name: 'Group',
    });
    expect(rawMessage).to.equal('Failed to promote {name} in {group_name}');
  });

  it('returns the raw message for a token with a tag', () => {
    const message = initI18n().getRawMessage('en', 'screenshotTaken', { name: 'Alice' });
    expect(message).to.equal('<b>{name}</b> took a screenshot.');
  });

  it('returns the raw message for a token with a tag and args', () => {
    const message = initI18n().getRawMessage('en', 'adminPromoteTwoDescription', {
      name: 'Alice',
      other_name: 'Bob',
    });
    expect(message).to.equal(
      'Are you sure you want to promote <b>{name}</b> and <b>{other_name}</b> to admin? Admins cannot be removed.'
    );
  });
});
