// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - TODO: add generic type to setupI18n to fix this

import { expect } from 'chai';
import { tr } from '../../../../../localization/localeTools';

describe('localised string: format message with args', () => {
  beforeEach(() => {});

  it('returns the message with args for a message', () => {
    const message = tr('Hello, {name}!', { name: 'Alice' });
    expect(message).to.equal('Hello, Alice!');
  });

  it('returns the message with args for a multi-arg message', () => {
    const message = tr('{found_count} of {count} match', { count: 1, found_count: 2 });
    expect(message).to.equal('2 of 1 match');
  });

  it("returns the message with args for plural message' with no args", () => {
    const message = tr('No args');
    expect(message).to.equal('No args');
  });

  it('returns the message with args for a token with args', () => {
    const message = tr('Hello, {name}!', { name: 'Alice' });
    expect(message).to.equal('Hello, Alice!');
  });

  it('returns the message with args for a token with a tag', () => {
    const message = tr('Hello, {name}! <b>Welcome!</b>', { name: 'Alice' });
    expect(message).to.equal('Hello, Alice! <b>Welcome!</b>');
  });

  it('returns the message with args for a token with a tag and args', () => {
    const message = tr('Hello, {name}! <b>Welcome, {arg}!</b>', { name: 'Alice', arg: 'Bob' });
    expect(message).to.equal('Hello, Alice! <b>Welcome, Bob!</b>');
  });
});
