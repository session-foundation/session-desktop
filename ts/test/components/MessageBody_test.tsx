/* eslint-disable import/no-extraneous-dependencies */
import { cleanup } from '@testing-library/react';
import { expect } from 'chai';
import Sinon from 'sinon';

import { TestUtils } from '../test-utils';
import { findAllByTagName, renderComponent } from './renderComponent';
import { MessageBody } from '../../components/conversation/message/message-content/MessageBody';
import { LinkPreviews } from '../../util/linkPreviews';

describe('MessageBody links', () => {
  beforeEach(() => {
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    cleanup();
    Sinon.restore();
  });

  it('renders the complete Odysee URL used by link previews', () => {
    const url = "https://odysee.com/@spacebusters:c9/It's-beginning-to-look...:1";
    const text = `See (${url}).`;
    const result = renderComponent(
      <MessageBody
        text={text}
        disableRichContent={false}
        disableJumbomoji={true}
        isGroup={false}
        isPublic={false}
      />
    );
    const links = findAllByTagName<HTMLAnchorElement>(result, 'a');

    expect(links.length).to.equal(1);
    expect(links[0].getAttribute('href')).to.equal(url);
    expect(links[0].textContent).to.equal(url);
    expect(result.container.textContent).to.equal(text);
    expect(LinkPreviews.findLinks(text)).to.deep.equal([url]);
  });

  it('keeps trailing dots outside links while preserving the message text', () => {
    const url = 'https://example.com/path';
    const text = `${url}... more text`;
    const result = renderComponent(
      <MessageBody
        text={text}
        disableRichContent={false}
        disableJumbomoji={true}
        isGroup={false}
        isPublic={false}
      />
    );
    const links = findAllByTagName<HTMLAnchorElement>(result, 'a');

    expect(links.length).to.equal(1);
    expect(links[0].getAttribute('href')).to.equal(url);
    expect(links[0].textContent).to.equal(url);
    expect(result.container.textContent).to.equal(text);
  });
});
