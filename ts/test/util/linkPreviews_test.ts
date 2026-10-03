import { expect } from 'chai';

import { LinkPreviews } from '../../util/linkPreviews';

describe('LinkPreviews.findLinks', () => {
  const odyseeUrl = "https://odysee.com/@spacebusters:c9/It's-beginning-to-look...:1";

  it('keeps the complete Odysee URL after consecutive dots and a colon', () => {
    expect(LinkPreviews.findLinks(odyseeUrl)).to.deep.equal([odyseeUrl]);
  });

  it('keeps query parameters and fragments after the colon suffix', () => {
    const url = `${odyseeUrl}?t=42#comments`;

    expect(LinkPreviews.findLinks(url)).to.deep.equal([url]);
  });

  it('excludes surrounding parentheses and trailing sentence punctuation', () => {
    expect(LinkPreviews.findLinks(`See (${odyseeUrl}).`)).to.deep.equal([odyseeUrl]);
    expect(LinkPreviews.findLinks(`${odyseeUrl}... more text`)).to.deep.equal([odyseeUrl]);
  });

  it('excludes trailing dots and a colon without a following path character', () => {
    const url = 'https://example.com/path';

    expect(LinkPreviews.findLinks(`${url}...`)).to.deep.equal([url]);
    expect(LinkPreviews.findLinks(`${url}...:`)).to.deep.equal([url]);
  });

  it('preserves consecutive dots inside existing paths and query parameters', () => {
    const urls = [
      'https://github.com/example/repo/compare/main...branch',
      'https://example.com/path?x=9..&y=1',
    ];

    expect(LinkPreviews.findLinks(urls.join(' and '))).to.deep.equal(urls);
  });

  it('continues recognizing domains without a protocol', () => {
    expect(LinkPreviews.findLinks('Visit example.com and www.example.org.')).to.deep.equal([
      'example.com',
      'www.example.org',
    ]);
  });

  it('recognizes colon suffixes in domains without a protocol', () => {
    const url = 'example.com/video...:1';

    expect(LinkPreviews.findLinks(url)).to.deep.equal([url]);
  });

  it('respects the caret while editing the colon suffix', () => {
    const text = `${odyseeUrl} more text`;

    expect(LinkPreviews.findLinks(text, odyseeUrl.length - 1)).to.deep.equal([]);
    expect(LinkPreviews.findLinks(text, odyseeUrl.length + 1)).to.deep.equal([odyseeUrl]);
    expect(LinkPreviews.findLinks(odyseeUrl, odyseeUrl.length)).to.deep.equal([odyseeUrl]);
  });
});
