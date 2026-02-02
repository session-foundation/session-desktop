/* eslint-disable no-unused-expressions */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

// Can't import type as StringUtils.Encoding
import { toSearchableString } from '../../../../session/searchableString';

chai.use(chaiAsPromised as any);

const { expect } = chai;

describe('Searchable string', () => {
  it('should remove diacritics from Latin characters', () => {
    expect(toSearchableString('Éric')).to.equal('eric');
    expect(toSearchableString('ÉRIC')).to.equal('eric');
    expect(toSearchableString('ÉrIc')).to.equal('eric');
    expect(toSearchableString('Eric')).to.equal('eric');
    expect(toSearchableString('eric')).to.equal('eric');
  });

  it('should lowercase Cyrillic characters', () => {
    expect(toSearchableString('Привет')).to.equal('привет');
    expect(toSearchableString('привет')).to.equal('привет');
    expect(toSearchableString('ПРИВЕТ')).to.equal('привет');

    expect(toSearchableString('БОРИС')).to.equal('борис');
    expect(toSearchableString('борис')).to.equal('борис');
    expect(toSearchableString('борис')).to.equal('борис');
  });
});
