import { expect } from 'chai';
import { isLinkPreviewDateValid } from '../../util/isLinkPreviewDateValid';

describe('isLinkPreviewDateValid', () => {
  it('returns false for non-numbers', () => {
    expect(isLinkPreviewDateValid(null)).to.be.eq(false);
    expect(isLinkPreviewDateValid(undefined)).to.be.eq(false);
    expect(isLinkPreviewDateValid(Date.now().toString())).to.be.eq(false);
    expect(isLinkPreviewDateValid(new Date())).to.be.eq(false);
  });

  it('returns false for zero', () => {
    expect(isLinkPreviewDateValid(0)).to.be.eq(false);
    expect(isLinkPreviewDateValid(-0)).to.be.eq(false);
  });

  it('returns false for NaN', () => {
    expect(isLinkPreviewDateValid(0 / 0)).to.be.eq(false);
  });

  it('returns false for any infinite value', () => {
    expect(isLinkPreviewDateValid(Infinity)).to.be.eq(false);
    expect(isLinkPreviewDateValid(-Infinity)).to.be.eq(false);
  });

  it('returns false for timestamps more than a day from now', () => {
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    expect(isLinkPreviewDateValid(Date.now() + twoDays)).to.be.eq(false);
  });

  it('returns true for timestamps before tomorrow', () => {
    expect(isLinkPreviewDateValid(Date.now())).to.be.eq(true);
    expect(isLinkPreviewDateValid(Date.now() + 123)).to.be.eq(true);
    expect(isLinkPreviewDateValid(Date.now() - 123)).to.be.eq(true);
    expect(isLinkPreviewDateValid(new Date(1995, 3, 20).valueOf())).to.be.eq(true);
    expect(isLinkPreviewDateValid(new Date(1970, 3, 20).valueOf())).to.be.eq(true);
    expect(isLinkPreviewDateValid(new Date(1969, 3, 20).valueOf())).to.be.eq(true);
    expect(isLinkPreviewDateValid(1)).to.be.eq(true);
  });
});
