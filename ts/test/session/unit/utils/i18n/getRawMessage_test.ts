// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - TODO: add generic type to setupI18n to fix this

import { expect } from 'chai';
import { initI18n } from './util';
import { getRawMessage } from '../../../../../localization/localeTools';

describe('getRawMessage', () => {
  beforeEach(() => {
    initI18n();
  });
  it('returns the raw message for a token', () => {
    const rawMessage = getRawMessage('en', 'adminPromoteDescription', { name: 'Alice' });
    expect(rawMessage).to.equal(
      'Are you sure you want to promote <b>{name}</b> to admin? Admins cannot be removed.'
    );
  });

  it('returns the raw message for a plural token', () => {
    const rawMessage = getRawMessage('en', 'searchMatches', {
      count: 1,
      found_count: 2,
    });
    expect(rawMessage).to.equal('{found_count} of {count} match');
  });

  it('returns the raw message for a token with no args', () => {
    const rawMessage = getRawMessage('en', 'adminCannotBeRemoved');
    expect(rawMessage).to.equal('Admins cannot be removed.');
  });

  it('returns the raw message for a token with args', () => {
    const rawMessage = getRawMessage('en', 'adminPromotionFailedDescription', {
      name: 'Alice',
      group_name: 'Group',
    });
    expect(rawMessage).to.equal('Failed to promote {name} in {group_name}');
  });

  it('returns the raw message for a token with a tag', () => {
    const message = getRawMessage('en', 'screenshotTaken', { name: 'Alice' });
    expect(message).to.equal('<b>{name}</b> took a screenshot.');
  });

  it('returns the raw message for a token with a tag and args', () => {
    const message = getRawMessage('en', 'adminPromoteTwoDescription', {
      name: 'Alice',
      other_name: 'Bob',
    });
    expect(message).to.equal(
      'Are you sure you want to promote <b>{name}</b> and <b>{other_name}</b> to admin? Admins cannot be removed.'
    );
  });
});
